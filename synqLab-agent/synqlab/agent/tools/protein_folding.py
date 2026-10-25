"""Agent tool: Protein structure prediction (OmegaFold / ESMFold).

Bridges the agent to the existing ``synqlab.engine.executor`` for folding.
Requires SYNQLAB_OMEGAFOLD_URL to be configured.

Phase 13: predict_structure auto-persists its OmegaFold output via
``persist_artifact()`` and returns ``artifact_id`` (not ``pdb_path``)
in ToolResult.ok so downstream tools (analyze_stability, etc.) can
reference the result by handle (D-01, D-02, D-03).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
import uuid

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool
from synqlab.agent.tools._http import post_json
from synqlab.agent.tools._persist import ARTIFACT_DIR, persist_artifact
from synqlab.storage.artifact_paths import FOLDING, build_agent_artifact_path

logger = logging.getLogger(__name__)


class ProteinFoldingInput(BaseModel):
    """Input schema for protein structure prediction."""

    sequence: str = Field(..., description="Amino acid sequence to fold (single-letter codes)")
    method: str = Field(
        default=os.environ.get("SYNQLAB_DEFAULT_FOLD_BACKEND", "omegafold"),
        description="Folding method: 'omegafold' or 'esmfold'",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Submit a folding job to the compute infrastructure."""
    sequence = inputs["sequence"]
    method = inputs.get("method", os.environ.get("SYNQLAB_DEFAULT_FOLD_BACKEND", "omegafold"))

    # Validate sequence.
    valid_aa = set("ACDEFGHIKLMNPQRSTVWY")
    if not all(c in valid_aa for c in sequence.upper()):
        return ToolResult.fail("Invalid amino acid sequence: contains non-standard residues")

    if len(sequence) < 10:
        return ToolResult.fail("Sequence too short (minimum 10 residues)")

    if len(sequence) > 2000:
        return ToolResult.fail("Sequence too long (maximum 2000 residues for online prediction)")

    # Route to the correct backend based on method.
    if method == "esmfold":
        base_url = os.environ.get("SYNQLAB_ESMFOLD_URL", "")
        env_hint = "SYNQLAB_ESMFOLD_URL"
    else:
        base_url = os.environ.get("SYNQLAB_OMEGAFOLD_URL", "")
        env_hint = "SYNQLAB_OMEGAFOLD_URL"

    if not base_url:
        return ToolResult.fail(
            f"Folding service not configured. Set {env_hint} environment variable."
        )

    try:
        # model_service wraps the body into a ToolRequest — send the envelope.
        result = await post_json(
            f"{base_url}/predict",
            {
                "tool_id": f"{method}_fold",
                "inputs": {
                    "sequence": sequence,
                    "method": method,
                    "artifact_dir": str(
                        build_agent_artifact_path(ARTIFACT_DIR, FOLDING, method)
                    ),
                    "output_tag": f"{method}_{uuid.uuid4().hex[:8]}",
                },
                "experiment_id": ctx.session_id or "agent",
                "round_id": "protein_folding",
            },
            timeout=float(os.environ.get("SYNQLAB_FOLD_TIMEOUT_S", "3600")),
        )

        if not result.get("success", False):
            return ToolResult.fail(
                result.get("error_message")
                or result.get("error")
                or "Folding service returned an error."
            )

        outputs = result.get("outputs", {}) or {}

        # ── Phase 13 auto-persist: read the OmegaFold output file from disk
        # and persist it as an agent_artifacts row so downstream tools can
        # reference it by artifact_id (D-01, D-02, D-03). Best-effort: if
        # persistence fails, return the result without artifact_id.
        returned_path = outputs.get("pdb_path")
        artifact_id: str | None = None
        if returned_path:
            try:
                pdb_text = Path(returned_path).read_text(encoding="utf-8")
                artifact_id = await persist_artifact(
                    content=pdb_text,
                    name=f"{method}_{(ctx.session_id or 'agent')[:8]}.pdb",
                    artifact_type="pdb_structure",
                    ctx=ctx,
                    metadata={
                        "plddt_mean": outputs.get("plddt_mean"),
                        "method": method,
                        "sequence_length": len(sequence),
                    },
                )
            except (OSError, ValueError) as exc:
                logger.warning(
                    "Auto-persist of folded structure failed: %s. "
                    "Returning result without artifact_id.", exc,
                )
                artifact_id = None

        payload_out: dict[str, Any] = {
            "method": method,
            "sequence_length": len(sequence),
            "plddt_mean": outputs.get("plddt_mean"),
            "status": "completed",
        }
        if artifact_id:
            payload_out["artifact_id"] = artifact_id
        return ToolResult.ok(payload_out)
    except httpx.HTTPError as exc:
        logger.error("Folding service HTTP error: %s", exc)
        return ToolResult.fail(f"Folding service unavailable: {exc}")
    except Exception as exc:
        logger.error("Folding service error: %s", exc)
        return ToolResult.fail(f"Folding service error: {exc}")


protein_folding_tool = build_tool(AgentToolDef(
    name="predict_structure",
    description=(
        "Predict the 3D structure of a protein from its amino acid sequence "
        "using OmegaFold or ESMFold. Returns the predicted structure as an "
        "artifact_id (pass to analyze_stability or any PDB-consuming tool) "
        "and quality metrics (pLDDT score)."
    ),
    input_schema=ProteinFoldingInput,
    call=_call,
    search_hint="fold protein structure prediction pLDDT PDB",
))
