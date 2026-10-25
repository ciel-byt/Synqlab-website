"""Score GFP11 brightness using ESM-2 embeddings + trained classifier.

Ported from feature branch tools.py:_score_brightness.
Calls brightness-svc:8007 via HTTP instead of adapter.run() directly.
"""

from __future__ import annotations

import os
import logging

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)

_DEFAULT_URL = "http://brightness-svc:8007"


class ScoreBrightnessInput(BaseModel):
    sequence: str = Field(
        ..., description="GFP11 candidate sequence (single-letter amino acids)."
    )
    tool_scores: dict = Field(
        default_factory=dict,
        description=(
            "Optional structural feature scores from upstream tools "
            "(e.g. ddg from FoldX, interaction from SPServer, plddt from folding). "
            "When provided, the brightness model can use hybrid feature mode."
        ),
    )


async def _score_brightness_call(
    inputs: dict, ctx,
) -> ToolResult:
    url = os.environ.get("SYNQLAB_BRIGHTNESS_URL", _DEFAULT_URL)
    sequence = str(inputs.get("sequence", "")).strip()
    tool_scores = inputs.get("tool_scores", {}) or {}
    if not sequence:
        return ToolResult.fail("sequence is required")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{url}/predict",
                json={
                    "inputs": {
                        "sequence": sequence,
                        "tool_scores": tool_scores,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("brightness-svc error: %s", exc)
        return ToolResult.fail(
            f"Brightness scoring failed: brightness-svc returned {exc}. "
            "Ensure the service is running and the model is deployed."
        )

    if data.get("success"):
        p_hit = data["outputs"].get("p_hit")
        pred_bright = data["outputs"].get("predicted_brightness")
        
        if p_hit is not None:
            p_hit = round(float(p_hit), 4)
        if pred_bright is not None:
            pred_bright = round(float(pred_bright), 4)
            
        return ToolResult.ok({
            "p_hit": p_hit,
            "predicted_brightness": pred_bright,
            "model_version": data["outputs"].get("model_version"),
        })
    return ToolResult.fail(
        data.get("error_message", "Brightness scoring failed")
    )


score_brightness_tool = build_tool(AgentToolDef(
    name="score_brightness",
    description=(
        "Score a GFP11 candidate sequence for predicted fluorescence "
        "brightness. Returns p_hit ∈ [0,1] and predicted_brightness."
    ),
    input_schema=ScoreBrightnessInput,
    call=_score_brightness_call,
))
