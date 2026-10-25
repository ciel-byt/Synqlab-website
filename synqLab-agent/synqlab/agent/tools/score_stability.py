"""Score stability (ΔΔG) of a folded structure using FoldX.

Ported from feature branch tools.py:_score_with_pdb.
Uses foldx-svc:8003 instead of PyRosetta (D-21: skip PyRosetta).
Enforces PDB dependency rule.
"""

from __future__ import annotations

import os
import logging

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)

_DEFAULT_URL = ""


class ScoreStabilityInput(BaseModel):
    pdb_path: str = Field(
        ...,
        description="Path to a PDB file produced by predict_structure.",
    )
    mode: str = Field(
        default="stability",
        description="Scoring mode: 'stability' (total energy) or 'interface_dg' (interface ΔG).",
    )


async def _score_stability_call(
    inputs: dict, ctx,
) -> ToolResult:
    pdb_path = str(inputs.get("pdb_path", "")).strip()
    mode = str(inputs.get("mode", "stability")).strip()
    if not pdb_path or pdb_path.startswith("{{"):
        return ToolResult.fail(
            "pdb_path is required and must be resolved — call predict_structure first. Upstream node may have failed."
        )

    # PDB dependency enforcement
    if hasattr(ctx, "known_pdb_paths") and pdb_path not in ctx.known_pdb_paths:
        return ToolResult.fail(
            f"pdb_path '{pdb_path}' was not produced by a prior "
            "predict_structure / validate_complex call in this session. "
            "Fold the candidate first and reuse the returned pdb_path."
        )

    url = os.environ.get("SYNQLAB_FOLDX_URL", _DEFAULT_URL)
    if not url:
        return ToolResult.fail(
            "SYNQLAB_FOLDX_URL not configured. Cannot reach FoldX service."
        )
    timeout_s = int(os.environ.get("SYNQLAB_FOLDX_TIMEOUT_S", "900"))
    max_retries = 3
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(
                    f"{url}/predict",
                    json={"inputs": {"pdb_path": pdb_path, "mode": mode}},
                )
                resp.raise_for_status()
                data = resp.json()
                break
        except httpx.HTTPError as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                wait = 5 * (2 ** attempt)  # 5s, 10s
                logger.warning("foldx-svc attempt %d/%d failed (%s), retrying in %ds", attempt + 1, max_retries, exc, wait)
                import asyncio
                await asyncio.sleep(wait)
            else:
                return ToolResult.fail(f"foldx-svc unreachable after {max_retries} attempts: {last_exc}")

    if data.get("success"):
        outputs = data["outputs"]
        return ToolResult.ok({
            "interface_dg": outputs.get("interface_dg", outputs.get("ddg", outputs.get("score"))),
            "total_energy": outputs.get("total_energy"),
            "details": outputs.get("details"),
        })
    return ToolResult.fail(
        data.get("error_message", "FoldX stability scoring failed")
    )


score_stability_tool = build_tool(AgentToolDef(
    name="score_stability",
    description=(
        "Compute the stability (ΔΔG) of a protein structure using FoldX. "
        "REQUIRES a pdb_path produced by a prior predict_structure call."
    ),
    input_schema=ScoreStabilityInput,
    call=_score_stability_call,
))
