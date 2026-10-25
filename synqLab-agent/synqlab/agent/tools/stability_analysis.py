"""Agent tool: Protein stability analysis (FoldX ΔΔG).

Phase 13: this tool now accepts artifact_id (D-05) instead of a filesystem
path. The gateway resolves artifact_id → file_path via the database before
POSTing to foldx-svc; the LLM never sees a filesystem path (D-06, D-13).

Requires SYNQLAB_FOLDX_URL to be configured.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool
from synqlab.agent.tools._http import post_json
from synqlab.agent.tools._persist import ARTIFACT_DIR
from synqlab.storage.artifact_paths import FOLDX, build_agent_artifact_path

logger = logging.getLogger(__name__)


# ── DB session getter, isolated for monkey-patching in tests ──────────────

def get_db_session():
    """Defer the import so test fixtures can monkey-patch this symbol."""
    from synqlab.storage.db import get_session as _get_session
    return _get_session()


class StabilityAnalysisInput(BaseModel):
    """Input schema for stability analysis (Phase 13 — artifact_id-only)."""

    artifact_id: str = Field(
        ...,
        description=(
            "Artifact handle for the PDB structure to analyze. Use "
            "list_pdb_samples to discover bundled samples, or pass the "
            "artifact_id returned by predict_structure. Filesystem paths "
            "are not accepted."
        ),
    )
    mutations: list[str] = Field(
        default_factory=list,
        description="Optional list of mutations to evaluate (e.g. ['A42G', 'L55V'])",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Submit a stability analysis job to the FoldX service."""
    artifact_id = inputs.get("artifact_id", "")
    mutations = inputs.get("mutations", [])

    if not artifact_id:
        return ToolResult.fail(
            "artifact_id is required. Use list_pdb_samples to discover "
            "bundled samples or use an artifact_id returned by another tool."
        )

    # ── D-13: resolve artifact_id → file_path via DB before HTTP POST ─
    from synqlab.agent.models import AgentArtifact

    db = get_db_session()
    try:
        row = db.query(AgentArtifact).filter_by(id=artifact_id).first()
        if not row:
            return ToolResult.fail(
                f"Artifact '{artifact_id}' not found. "
                f"Use list_pdb_samples to discover bundled samples, or list "
                f"this session's artifacts first."
            )
        # Visibility checks (D-08): session/project rows are scoped, global is open.
        if row.scope == "session":
            if row.session_id != ctx.session_id:
                return ToolResult.fail(
                    "Artifact not accessible from this session."
                )
        elif row.scope == "project":
            ctx_project_id = getattr(ctx, "project_id", None)
            if ctx_project_id is None or row.project_id != ctx_project_id:
                return ToolResult.fail(
                    "Artifact not accessible from this session."
                )
        # scope == "global" is always visible — no further check
        # Type check: only PDB structures are valid input.
        if row.artifact_type != "pdb_structure":
            return ToolResult.fail(
                f"analyze_stability requires a pdb_structure artifact, "
                f"got '{row.artifact_type}'."
            )
        # File-path requirement: inline-stored PDBs are not yet supported.
        if not row.file_path:
            return ToolResult.fail(
                "Inline-stored PDBs are not yet supported by analyze_stability. "
                "The artifact must have a file_path."
            )
        resolved_path = row.file_path
    finally:
        db.close()

    base_url = os.environ.get("SYNQLAB_FOLDX_URL", "")
    if not base_url:
        return ToolResult.fail(
            "Stability analysis service not configured. "
            "Set SYNQLAB_FOLDX_URL environment variable."
        )

    try:
        # foldx-svc still expects `inputs.pdb_path` (string filesystem path).
        # That contract is unchanged in Phase 13 — only the gateway-side
        # input shape changed (artifact_id → resolved_path here).
        result = await post_json(
            f"{base_url}/predict",
            {
                "tool_id": "foldx_stability",
                "inputs": {
                    "pdb_path": resolved_path,
                    "mutations": mutations,
                    "artifact_dir": str(
                        build_agent_artifact_path(ARTIFACT_DIR, FOLDX)
                    ),
                },
                "experiment_id": ctx.session_id or "agent",
                "round_id": "stability_analysis",
            },
            timeout=180.0,
        )

        if not result.get("success", False):
            return ToolResult.fail(
                result.get("error_message")
                or result.get("error")
                or "FoldX analysis failed"
            )

        outputs = result.get("outputs", {})
        ddg = outputs.get("ddg")

        stability_class = "unknown"
        if ddg is not None:
            if ddg < -1.0:
                stability_class = "stabilizing"
            elif ddg > 1.0:
                stability_class = "destabilizing"
            else:
                stability_class = "neutral"

        return ToolResult.ok({
            "total_energy": ddg,
            "ddg": ddg,
            "ddg_values": [ddg] if ddg is not None else [],
            "stability_class": stability_class,
            "artifact_id": artifact_id,             # ← returned for traceability
            "mutations": mutations,
            "raw_output_path": outputs.get("raw_output_path"),
            "status": "completed",
        })
    except httpx.HTTPError as exc:
        logger.error("FoldX service HTTP error: %s", exc)
        return ToolResult.fail(
            f"Stability analysis service unavailable: {exc}"
        )
    except Exception as exc:
        logger.error("FoldX service error: %s", exc)
        return ToolResult.fail(f"Stability analysis service error: {exc}")


stability_analysis_tool = build_tool(AgentToolDef(
    name="analyze_stability",
    description=(
        "Analyze protein stability using FoldX. Computes total energy and "
        "ΔΔG values for wild-type or mutant structures. Useful for "
        "evaluating whether designed mutations improve thermodynamic "
        "stability. Input is an artifact_id — discover bundled samples via "
        "list_pdb_samples or use the artifact_id returned by predict_structure."
    ),
    input_schema=StabilityAnalysisInput,
    call=_call,
    search_hint="stability FoldX ddG thermodynamic energy mutation",
))
