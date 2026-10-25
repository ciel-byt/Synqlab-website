"""Score GFP11/GFP1-10 interaction using FoldX.

Ported from feature branch tools.py:_score_with_pdb.
Now relies on the local foldx-svc instead of the defunct IRB Barcelona SPServer.
Enforces PDB dependency rule: pdb_path must be in ctx.known_pdb_paths.
"""

from __future__ import annotations

import os
import logging

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)



class ScoreInteractionInput(BaseModel):
    pdb_path: str = Field(
        ...,
        description=(
            "Path to a PDB file of the complex, produced by a prior "
            "predict_structure or validate_complex call."
        ),
    )


async def _score_interaction_call(
    inputs: dict, ctx,
) -> ToolResult:
    pdb_path = str(inputs.get("pdb_path", "")).strip()
    if not pdb_path or pdb_path.startswith("{{"):
        return ToolResult.fail(
            "pdb_path is required and must be resolved — call predict_structure or validate_complex first. Upstream node may have failed."
        )

    # PDB dependency enforcement (ported from GFP11 ToolDispatcher)
    if hasattr(ctx, "known_pdb_paths") and pdb_path not in ctx.known_pdb_paths:
        return ToolResult.fail(
            f"pdb_path '{pdb_path}' was not produced by a prior "
            "predict_structure / validate_complex call in this session. "
            "Fold the candidate first and reuse the returned pdb_path."
        )

    url = os.environ.get("SYNQLAB_FOLDX_URL", "")
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
                    json={"inputs": {"pdb_path": pdb_path, "mode": "interface_dg"}},
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
            "interaction_score": outputs.get("interface_dg", outputs.get("ddg", outputs.get("score"))),
            "details": outputs.get("details", "Scored locally via FoldX"),
        })
    return ToolResult.fail(
        data.get("error_message", "FoldX interaction scoring failed")
    )


score_interaction_tool = build_tool(AgentToolDef(
    name="score_interaction",
    description=(
        "Score the GFP11/GFP1-10 interaction locally using FoldX AnalyseComplex. REQUIRES "
        "a pdb_path of the complex produced by a prior predict_structure "
        "or validate_complex call."
    ),
    input_schema=ScoreInteractionInput,
    call=_score_interaction_call,
))
