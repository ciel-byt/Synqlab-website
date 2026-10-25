"""Thin LLM wrapper for chat tool-calling.

Uses OpenAI client (openai>=1.0) configured via OPENAI_API_KEY + OPENAI_BASE_URL.
Falls back to echo mode when the key is absent (useful for local dev / tests).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are SynqLab Assistant — an expert in computational protein design, \
molecular biology, and scientific experiment management.

You help scientists:
- Design, evaluate, and iterate on protein/peptide sequences.
- Understand experiment results and pipeline runs.
- Query the knowledge store and suggest next steps.

Be concise, scientific, and precise. When uncertain, say so.
"""

_TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_experiments",
            "description": "List recent experiment runs from the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results to return (default 10)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_experiment",
            "description": "Get details about a specific experiment by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "experiment_id": {"type": "string", "description": "The experiment ID"},
                },
                "required": ["experiment_id"],
            },
        },
    },
]


def _get_client():
    try:
        from openai import OpenAI
        api_key = os.environ.get("OPENAI_API_KEY", "")
        base_url = os.environ.get("OPENAI_BASE_URL") or None
        return OpenAI(api_key=api_key, base_url=base_url)
    except ImportError:
        return None


def chat_complete(
    messages: list[dict],
    model: str | None = None,
    tools: bool = True,
) -> dict[str, Any]:
    """Send messages to the LLM and return the assistant reply dict.

    Returns:
        {"role": "assistant", "content": str, "tool_calls": list | None}
    """
    client = _get_client()
    effective_model = model or os.environ.get("SYNQLAB_CHAT_MODEL", "gpt-4o-mini")

    if client is None or not os.environ.get("OPENAI_API_KEY"):
        logger.warning("OPENAI_API_KEY not set; returning echo response.")
        user_content = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return {
            "role": "assistant",
            "content": f"[Echo mode — no API key] You said: {user_content}",
            "tool_calls": None,
        }

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    kwargs: dict[str, Any] = {"model": effective_model, "messages": full_messages}
    if tools:
        kwargs["tools"] = _TOOL_DEFINITIONS
        kwargs["tool_choice"] = "auto"

    response = client.chat.completions.create(**kwargs)
    choice = response.choices[0].message

    tool_calls_raw = None
    if choice.tool_calls:
        tool_calls_raw = [
            {
                "id": tc.id,
                "name": tc.function.name,
                "arguments": json.loads(tc.function.arguments or "{}"),
            }
            for tc in choice.tool_calls
        ]

    return {
        "role": "assistant",
        "content": choice.content or "",
        "tool_calls": tool_calls_raw,
    }
