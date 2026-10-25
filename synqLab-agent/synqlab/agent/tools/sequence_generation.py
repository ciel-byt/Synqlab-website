"""Agent tool: Protein sequence generation (ProtGPT2).

Requires SYNQLAB_PROTGPT2_URL to be configured.
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

logger = logging.getLogger(__name__)


class SequenceGenerationInput(BaseModel):
    """Input schema for protein sequence generation."""

    prompt_sequence: str = Field(
        default="",
        description="Optional seed/template sequence to condition generation on",
    )
    num_sequences: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of sequences to generate (1-50)",
    )
    max_length: int = Field(
        default=80,
        ge=20,
        le=400,
        description=(
            "Token budget for generation (BPE tokens, ~3-4 residues per token). "
            "80 ≈ 20-30 residue sequences, 200 ≈ 50-80 residues. "
            "Prefer smaller values on CPU — each token is an autoregressive step."
        ),
    )
    temperature: float = Field(
        default=1.0,
        ge=0.1,
        le=2.0,
        description="Sampling temperature (higher = more diverse)",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Submit a sequence generation job to the ProtGPT2 service."""
    base_url = os.environ.get("SYNQLAB_PROTGPT2_URL", "")
    if not base_url:
        return ToolResult.fail(
            "Sequence generation service not configured. Set SYNQLAB_PROTGPT2_URL environment variable."
        )

    # Map the tool-level input schema onto the adapter's expected field names.
    # ProtGPT2Adapter.run reads inputs["n_sequences"] / ["max_length"] / ["temperature"],
    # and also accepts an optional "prompt_sequence" seed.
    adapter_inputs: dict[str, Any] = {
        "n_sequences": int(inputs.get("num_sequences", 5)),
        "max_length": int(inputs.get("max_length", 200)),
        "temperature": float(inputs.get("temperature", 1.0)),
    }
    prompt_sequence = inputs.get("prompt_sequence")
    if prompt_sequence:
        adapter_inputs["prompt_sequence"] = prompt_sequence

    try:
        # model_service wraps the body into a ToolRequest — send the envelope.
        result = await post_json(
            f"{base_url}/predict",
            {
                "tool_id": "protgpt2_generate",
                "inputs": adapter_inputs,
                "experiment_id": ctx.session_id or "agent",
                "round_id": "sequence_generation",
            },
            timeout=300.0,
        )

        if not result.get("success", False):
            return ToolResult.fail(
                result.get("error_message")
                or result.get("error")
                or "ProtGPT2 service returned an error."
            )

        outputs = result.get("outputs", {}) or {}
        sequences = outputs.get("sequences", [])
        return ToolResult.ok({
            "sequences": sequences,
            "count": len(sequences),
            "model": "ProtGPT2",
            "status": "completed",
            "generation_metadata": outputs.get("generation_metadata"),
        })
    except httpx.HTTPError as exc:
        logger.error("ProtGPT2 service HTTP error: %s", exc)
        return ToolResult.fail(f"Sequence generation service unavailable: {exc}")
    except Exception as exc:
        logger.error("ProtGPT2 service error: %s", exc)
        return ToolResult.fail(f"Sequence generation service error: {exc}")


sequence_generation_tool = build_tool(AgentToolDef(
    name="generate_sequences",
    description=(
        "Generate novel protein sequences using ProtGPT2, a language model "
        "trained on UniRef50. Can generate de novo or condition on a seed "
        "sequence. Returns a list of generated amino acid sequences."
    ),
    input_schema=SequenceGenerationInput,
    call=_call,
    search_hint="generate protein sequence ProtGPT2 de novo design",
))
