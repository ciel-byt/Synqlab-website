"""V1 pipeline — run_experiment(config) → ExperimentSummary.

Stage 1: Generate N sequences via ProtGPT2
Stage 2: Predict structure via OmegaFold; apply Gate 1 (pLDDT)
Stage 3: Score survivors via FoldX; apply Gate 2 (ΔΔG)
Stage 4: Optionally apply Reranker (skipped if no model artifact)
Stage 5: Select top-k; persist summary artifact
"""

from __future__ import annotations

import argparse
import json
import logging
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

from synqlab.core.config import load_config
from synqlab.core.schemas import ExperimentConfig, ToolRequest
from synqlab.core.tool_definition import ToolDefinition
from synqlab.engine.adapter_resolver import resolve_adapter
from synqlab.engine.executor import execute_tool
from synqlab.orchestrator.budget_tracker import BudgetTracker
from synqlab.orchestrator.policy import Candidate, V1Policy
from synqlab.registry.loader import load_registry
from synqlab.storage.artifact_paths import build_artifact_path

logger = logging.getLogger(__name__)



@dataclass
class ExperimentSummary:
    """Serialisable summary of a completed experiment run."""

    experiment_id: str
    round_id: str
    n_generated: int
    n_passed_gate1: int
    n_passed_gate2: int
    n_top_k: int
    top_k_sequences: list[str]
    top_k_scores: list[dict[str, Any]]
    budget: dict[str, Any]
    summary_artifact_path: str = ""


def _make_request(
    tool_id: str,
    inputs: dict[str, Any],
    config: ExperimentConfig,
    round_id: str,
) -> ToolRequest:
    return ToolRequest(
        tool_id=tool_id,
        inputs=inputs,
        experiment_id=config.experiment_id,
        round_id=round_id,
    )


def run_experiment(
    config: ExperimentConfig,
    session: Any = None,
    round_id: Optional[str] = None,
    progress_callback: Optional[Any] = None,
) -> ExperimentSummary:
    """Run a full V1 design round."""
    if round_id is None:
        round_id = f"round_{str(uuid.uuid4())[:8]}"

    logging.basicConfig(level=getattr(logging, config.log_level, logging.INFO))
    logger.info("Starting experiment %s | round %s", config.experiment_id, round_id)

    budget = BudgetTracker()
    policy = V1Policy(
        plddt_threshold=config.plddt_threshold,
        ddg_threshold=config.ddg_threshold,
    )

    # ── Create experiment record in DB (required for FK on tool_runs) ────────
    if session is not None:
        try:
            from synqlab.storage.service import create_experiment
            create_experiment(
                session,
                experiment_id=config.experiment_id,
                name=f"V1 pipeline · {config.n_sequences} seqs",
                config={k: v for k, v in asdict(config).items() if k != "experiment_id"},
            )
        except Exception as exc:
            logger.warning("Failed to create experiment record: %s", exc)

    # ── Resolve adapters (local or remote depending on env) ─────────────────
    try:
        # Docker container: registry is mounted at /registry/
        registry_path = "/registry/tools.yaml"
        if not Path(registry_path).exists():
            # Local dev: relative to source tree
            registry_path = str(Path(__file__).resolve().parents[2] / "registry" / "tools.yaml")
        tool_defs = load_registry(registry_path)
    except Exception:
        tool_defs = {}

    def _resolve(tool_id: str, **extra: Any) -> Any:
        if tool_id in tool_defs:
            return resolve_adapter(tool_defs[tool_id], adapter_kwargs=extra)
        # Fallback: build a minimal ToolDefinition for the resolver
        class_name = {
            "protgpt2": "ProtGPT2Adapter",
            "omegafold": "OmegaFoldAdapter",
            "foldx": "FoldXAdapter",
            "reranker": "RerankerAdapter",
        }.get(tool_id, "")
        td = ToolDefinition(
            id=tool_id,
            name=tool_id,
            adapter_class=class_name,
            category="",
            status="active",
            adapter=class_name,
            execution_mode="local",
            inputs=[],
            outputs=[],
        )
        return resolve_adapter(td, adapter_kwargs=extra)

    protgpt2 = _resolve("protgpt2")
    omegafold = _resolve("omegafold")
    foldx = _resolve("foldx")
    reranker = _resolve("reranker")

    # ── Progress helper ──────────────────────────────────────────────────────
    def _progress(stage: int, total: int, label: str, detail: str = "") -> None:
        if progress_callback:
            progress_callback(stage=stage, total=total, label=label, detail=detail)

    # ── Stage 1: Generate ────────────────────────────────────────────────────
    _progress(1, 4, "Generating sequences", f"{config.n_sequences} via ProtGPT2")
    logger.info("Stage 1: Generating %d sequences via ProtGPT2.", config.n_sequences)
    gen_output = execute_tool(
        "protgpt2",
        _make_request("protgpt2", {"n_sequences": config.n_sequences, "max_length": 100}, config, round_id),
        config,
        adapter=protgpt2,
        session=session,
    )
    sequences: list[str] = gen_output.outputs.get("sequences", [])
    budget.n_generated = len(sequences)
    budget.n_to_structure = len(sequences)
    logger.info("Stage 1 complete: %d sequences generated.", budget.n_generated)

    # ── Stage 2: Structure Prediction + Gate 1 ───────────────────────────────
    _progress(2, 4, "Folding structures", f"0/{len(sequences)} via OmegaFold")
    logger.info("Stage 2: Running OmegaFold on %d sequences.", len(sequences))
    candidates: list[Candidate] = []
    for i, seq in enumerate(sequences):
        _progress(2, 4, "Folding structures", f"{i+1}/{len(sequences)} via OmegaFold")
        of_output = execute_tool(
            "omegafold",
            _make_request("omegafold", {"sequence": seq}, config, round_id),
            config,
            adapter=omegafold,
            session=session,
        )
        c = Candidate(
            sequence=seq,
            pdb_path=of_output.outputs.get("pdb_path", ""),
            confidence=float(of_output.outputs.get("confidence", 0.0)),
            per_residue_plddt=list(of_output.outputs.get("per_residue_plddt", [])),
        )
        candidates.append(c)

    passed_gate1 = policy.apply_gate1(candidates)
    budget.n_passed_gate1 = len(passed_gate1)
    budget.n_to_scoring = len(passed_gate1)
    logger.info("Stage 2 complete: %d/%d passed Gate 1.", budget.n_passed_gate1, budget.n_generated)

    # ── Stage 3: Stability Scoring + Gate 2 ─────────────────────────────────
    _progress(3, 4, "Scoring stability", f"0/{len(passed_gate1)} via FoldX")
    logger.info("Stage 3: Running FoldX on %d candidates.", len(passed_gate1))
    for i, c in enumerate(passed_gate1):
        _progress(3, 4, "Scoring stability", f"{i+1}/{len(passed_gate1)} via FoldX")
        fx_output = execute_tool(
            "foldx",
            _make_request("foldx", {"pdb_path": c.pdb_path, "mutations": []}, config, round_id),
            config,
            adapter=foldx,
            session=session,
        )
        c.ddg = float(fx_output.outputs.get("ddg", 0.0))

    passed_gate2 = policy.apply_gate2(passed_gate1)
    budget.n_passed_gate2 = len(passed_gate2)
    budget.n_to_reranker = len(passed_gate2)
    logger.info("Stage 3 complete: %d/%d passed Gate 2.", budget.n_passed_gate2, budget.n_passed_gate1)

    # ── Stage 4: Reranker (optional) ─────────────────────────────────────────
    if config.use_reranker:
        logger.info("Stage 4: Running Reranker on %d candidates.", len(passed_gate2))
        for c in passed_gate2:
            rr_output = execute_tool(
                "reranker",
                _make_request(
                    "reranker",
                    {"feature_vector": {"plddt": c.confidence, "ddg": c.ddg}},
                    config,
                    round_id,
                ),
                config,
                adapter=reranker,
                session=session,
            )
            score = rr_output.outputs.get("score")
            if score is not None:
                c.reranker_score = float(score)
    else:
        logger.info("Stage 4: Reranker skipped (use_reranker=False).")

    # ── Stage 5: Top-k selection and summary ────────────────────────────────
    _progress(4, 4, "Selecting top-k", f"top-{config.top_k} from {len(passed_gate2)} candidates")
    top_k = policy.select_top_k(passed_gate2, k=config.top_k, use_reranker=config.use_reranker)
    budget.n_top_k = len(top_k)
    budget.log()

    top_k_sequences = [c.sequence for c in top_k]
    top_k_scores = [
        {"confidence": c.confidence, "ddg": c.ddg, "reranker_score": c.reranker_score}
        for c in top_k
    ]

    summary = ExperimentSummary(
        experiment_id=config.experiment_id,
        round_id=round_id,
        n_generated=budget.n_generated,
        n_passed_gate1=budget.n_passed_gate1,
        n_passed_gate2=budget.n_passed_gate2,
        n_top_k=budget.n_top_k,
        top_k_sequences=top_k_sequences,
        top_k_scores=top_k_scores,
        budget=budget.summary(),
    )

    summary_path = build_artifact_path(
        config.experiment_id, round_id, "pipeline", "summary", "experiment_summary.json",
        base_dir=config.artifacts_base_dir,
    )
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w") as fh:
        json.dump(
            {
                **{k: v for k, v in asdict(summary).items() if k != "summary_artifact_path"},
                "summary_artifact_path": str(summary_path),
            },
            fh,
            indent=2,
        )
    summary.summary_artifact_path = str(summary_path)
    logger.info("Experiment summary written to %s.", summary_path)

    return summary

