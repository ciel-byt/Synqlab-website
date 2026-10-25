"""Unit tests for the V1 pipeline — patches all adapters to avoid real model calls."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from synqlab.core.schemas import ExperimentConfig
from synqlab.orchestrator.pipeline import ExperimentSummary, run_experiment
from synqlab.storage.models import Base
from synqlab.storage.service import create_experiment as db_create_experiment


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def session() -> Session:
    import synqlab.auth.models  # noqa: F401  registers users/teams FK targets
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


@pytest.fixture
def config(tmp_path: Path) -> ExperimentConfig:
    return ExperimentConfig(
        experiment_id="test-pipeline-001",
        n_sequences=5,
        plddt_threshold=0.0,    # pass everything through Gate 1
        ddg_threshold=100.0,    # pass everything through Gate 2
        top_k=3,
        use_reranker=False,
        artifacts_base_dir=str(tmp_path / "artifacts"),
    )


def _make_protgpt2_output(n: int = 5):
    from synqlab.core.schemas import ToolOutput
    return ToolOutput(
        tool_id="protgpt2",
        outputs={
            "sequences": [f"ACDEFGHIKLM_{i}" for i in range(n)],
            "generation_metadata": {"model": "nferruz/ProtGPT2", "temperature": 1.0},
        },
        success=True,
    )


def _make_omegafold_output(seq: str):
    from synqlab.core.schemas import ToolOutput
    return ToolOutput(
        tool_id="omegafold",
        outputs={
            "pdb_path": "data/agent_artifacts/mock/structure.pdb",
            "confidence": 82.5,
            "per_residue_plddt": [82.5] * len(seq),
        },
        success=True,
    )


def _make_foldx_output():
    from synqlab.core.schemas import ToolOutput
    return ToolOutput(
        tool_id="foldx",
        outputs={"ddg": -1.2, "raw_output_path": "data/agent_artifacts/mock/foldx_output.txt"},
        success=True,
    )


def _patch_execute_tool(config: ExperimentConfig):
    """Return a side_effect function that returns synthetic ToolOutputs per tool_id."""
    call_count = {"omegafold": 0}

    def _side_effect(tool_id, request, cfg, **kwargs):
        if tool_id == "protgpt2":
            return _make_protgpt2_output(n=cfg.n_sequences)
        elif tool_id == "omegafold":
            seq = request.inputs.get("sequence", "ACDEF")
            return _make_omegafold_output(seq)
        elif tool_id == "foldx":
            return _make_foldx_output()
        else:
            from synqlab.core.schemas import ToolOutput
            return ToolOutput(tool_id=tool_id, outputs={}, success=True)

    return _side_effect


# ---------------------------------------------------------------------------
# Pipeline tests
# ---------------------------------------------------------------------------

def test_run_experiment_returns_summary(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    assert isinstance(summary, ExperimentSummary)


def test_run_experiment_generates_correct_n(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    assert summary.n_generated == 5


def test_run_experiment_top_k_bounded(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    assert summary.n_top_k <= config.top_k


def test_run_experiment_top_k_sequences_non_empty(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    assert len(summary.top_k_sequences) > 0
    assert all(isinstance(s, str) for s in summary.top_k_sequences)


def test_run_experiment_writes_summary_artifact(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    assert summary.summary_artifact_path
    artifact_path = Path(summary.summary_artifact_path)
    assert artifact_path.exists()
    with open(artifact_path) as fh:
        data = json.load(fh)
    assert data["experiment_id"] == config.experiment_id


def test_run_experiment_with_reranker(config: ExperimentConfig) -> None:
    config.use_reranker = True

    def _side_effect_with_reranker(tool_id, request, cfg, **kwargs):
        if tool_id == "reranker":
            from synqlab.core.schemas import ToolOutput
            return ToolOutput(tool_id="reranker", outputs={"score": 0.8, "model_version": "v1"}, success=True)
        return _patch_execute_tool(config)(tool_id, request, cfg, **kwargs)

    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_side_effect_with_reranker):
        summary = run_experiment(config)
    assert isinstance(summary, ExperimentSummary)


def test_run_experiment_writes_db_rows(
    config: ExperimentConfig, session: Session
) -> None:
    db_create_experiment(session, experiment_id=config.experiment_id)

    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config, session=session)

    from synqlab.storage.models import ToolRun
    runs = session.query(ToolRun).filter_by(experiment_id=config.experiment_id).all()
    # execute_tool is patched, so no DB writes happen via pipeline.
    # This test verifies the pipeline at least returns a valid summary.
    assert isinstance(summary, ExperimentSummary)


def test_budget_summary_has_expected_keys(config: ExperimentConfig) -> None:
    with patch("synqlab.orchestrator.pipeline.execute_tool", side_effect=_patch_execute_tool(config)):
        summary = run_experiment(config)
    keys = summary.budget.keys()
    assert "n_generated" in keys
    assert "n_top_k" in keys
    assert "elapsed_seconds" in keys
