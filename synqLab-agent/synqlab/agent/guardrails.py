"""Post-response guardrails for the agent system.

Provides validation layers that check agent output quality
before returning to users. Currently implements:

1. Numerical claim verification — checks that numbers in agent
   text match numbers from tool outputs in the conversation.
2. Dead-artifact-claim stripping — removes hallucinated "view here /
   download here / link provided" phrasing when no tool in the most
   recent turn actually produced an artifact_id.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


# ── Numerical claim guardrail ───────────────────────────────────────────────

# Regex to find numbers that look like scientific measurements.
_NUMBER_PATTERN = re.compile(
    r"""
    (?:^|(?<=[\s(,:\[]))   # start of string or preceded by whitespace/punct
    -?                      # optional negative
    \d+                     # integer part
    (?:\.\d+)?              # optional decimal
    (?:[eE][+-]?\d+)?       # optional scientific notation
    """,
    re.VERBOSE,
)


def extract_numbers(text: str) -> set[str]:
    """Extract all numeric strings from text."""
    matches = _NUMBER_PATTERN.findall(text)
    # Normalize: strip leading/trailing whitespace, skip trivially small integers.
    results = set()
    for m in matches:
        m = m.strip()
        if not m:
            continue
        try:
            val = float(m)
            # Skip integers 0-9 (too common/noise).
            if val == int(val) and abs(val) < 10:
                continue
            results.add(m)
        except ValueError:
            continue
    return results


def extract_tool_numbers(messages: list[dict[str, Any]]) -> set[str]:
    """Extract numbers from all tool result messages in the conversation."""
    numbers: set[str] = set()
    for msg in messages:
        if msg.get("role") == "tool":
            content = msg.get("content", "")
            if isinstance(content, str):
                numbers |= extract_numbers(content)
    return numbers


def check_numerical_claims(
    agent_response: str,
    messages: list[dict[str, Any]],
) -> list[str]:
    """Check if numbers in the agent response match numbers from tool outputs.

    Returns a list of warning strings for ungrounded numerical claims.
    """
    if not agent_response:
        return []

    response_numbers = extract_numbers(agent_response)
    if not response_numbers:
        return []

    tool_numbers = extract_tool_numbers(messages)
    if not tool_numbers:
        # No tool outputs to compare against.
        return []

    # Find numbers in the response that don't appear in any tool output.
    ungrounded = response_numbers - tool_numbers
    if not ungrounded:
        return []

    warnings = []
    for num in sorted(ungrounded):
        warnings.append(
            f"Numerical claim '{num}' not found in tool outputs — may be ungrounded"
        )

    if len(warnings) > 5:
        warnings = warnings[:5]
        warnings.append(f"... and {len(ungrounded) - 5} more ungrounded values")

    return warnings


# ── Dead-artifact-claim guardrail ──────────────────────────────────────────

# Sentence-level pattern: catches phrases that imply a clickable artifact
# link, including raw markdown link forms (`[view here](...)`) the model
# emits with empty / fake URLs that MarkdownContent then strips, leaving
# the user with no affordance.
_LINK_HALLUCINATION_RE = re.compile(
    r"""(?ix)
    [^.!?\n]*                                          # sentence body
    (?:
        \[\s*(?:view(?:\s+here)?|download(?:\s+here)?|read\s+more)\s*\]\([^)]*\)  # bracketed markdown link
      | \bview\s+(?:and\s+download\s+)?(?:the\s+)?(?:full\s+)?(?:report|file|artifact|document)\b
      | \bdownload\s+(?:the\s+)?(?:full\s+)?(?:report|file|artifact|document)\b
      | \b(?:via|using|with|through|from)\s+(?:the\s+)?link\s+(?:provided|below|here|above)
      | \blink\s+provided\b
      | \bhere(?:'s|\s+is)\s+the\s+(?:report|link|file|artifact)\b
    )
    [^.!?\n]*[.!?]?
    """,
)


def _last_turn_artifact_ids(messages: list[dict[str, Any]]) -> set[str]:
    """Collect artifact_ids surfaced by tool calls in the most recent turn.

    Walks messages backwards. Skips a trailing assistant message (the one
    we're guardrailing). Returns artifact_ids found in the most recent
    contiguous block of tool messages.
    """
    ids: set[str] = set()
    in_block = False
    skipped_trailing_assistant = False
    for msg in reversed(messages):
        role = msg.get("role")
        if role == "assistant" and not in_block and not skipped_trailing_assistant:
            skipped_trailing_assistant = True
            continue
        if role == "tool":
            in_block = True
            content = msg.get("content", "")
            if isinstance(content, str):
                m = re.search(r'"artifact_id"\s*:\s*"([^"]+)"', content)
                if m:
                    ids.add(m.group(1))
        elif in_block:
            break
    return ids


_DEAD_LINK_NOTE = (
    "(Note: I did not create a downloadable artifact this turn — "
    "ask me to use the write_report tool if you want a saved report.)"
)


def check_dead_artifact_claims(
    agent_response: str,
    messages: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    """Strip hallucinated link/download sentences when no artifact was produced.

    Returns ``(possibly_modified_response, warnings)``. If the most recent
    tool turn included a successful tool result with ``artifact_id``, the
    response is returned unchanged.
    """
    if not agent_response:
        return agent_response, []

    matches = list(_LINK_HALLUCINATION_RE.finditer(agent_response))
    if not matches:
        return agent_response, []

    if _last_turn_artifact_ids(messages):
        # An artifact really exists — let the chat client render its chip.
        return agent_response, []

    warnings = [
        f"Stripped hallucinated link phrase: {m.group(0).strip()!r}"
        for m in matches
    ]
    cleaned = _LINK_HALLUCINATION_RE.sub("", agent_response)
    # Collapse whitespace introduced by the strip, then trim.
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    if not cleaned:
        return _DEAD_LINK_NOTE, warnings
    return f"{cleaned}\n\n{_DEAD_LINK_NOTE}", warnings


# ── Combined guardrail pass ────────────────────────────────────────────────


def run_guardrails(
    agent_response: str,
    messages: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    """Run all guardrails on agent response.

    Returns:
        (possibly_modified_response, list_of_warnings)
    """
    warnings: list[str] = []

    # 1. Strip hallucinated artifact-link claims when no artifact was produced.
    agent_response, dead_link_warnings = check_dead_artifact_claims(
        agent_response, messages,
    )
    warnings.extend(dead_link_warnings)

    # 2. Check numerical claims (run after strip so warnings only cite
    #    surviving sentences).
    claim_warnings = check_numerical_claims(agent_response, messages)
    warnings.extend(claim_warnings)

    return agent_response, warnings
