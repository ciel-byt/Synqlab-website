"""R6: Context faithfulness evaluation.

Scores whether agent text responses are grounded in tool outputs.
Uses code-based metrics for v1 (no LLM judge yet):

1. Numerical faithfulness — all numbers in response traceable to tool outputs
2. Claim density — ratio of grounded vs. ungrounded assertions
3. Keyword coverage — key terms from tool outputs reflected in response

Usage:
    python -m evals.eval_faithfulness        # run on sample data
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from synqlab.agent.guardrails import extract_numbers, extract_tool_numbers


# ── Faithfulness scorer ─────────────────────────────────────────────────────

@dataclass
class FaithfulnessResult:
    """Score for a single response against its tool context."""
    response_numbers: set[str] = field(default_factory=set)
    tool_numbers: set[str] = field(default_factory=set)
    grounded_numbers: set[str] = field(default_factory=set)
    ungrounded_numbers: set[str] = field(default_factory=set)
    keyword_overlap: float = 0.0
    numerical_faithfulness: float = 1.0
    overall_score: float = 1.0


def _extract_keywords(text: str, min_len: int = 4) -> set[str]:
    """Extract meaningful keywords from text (lowercase, min length)."""
    words = re.findall(r"[a-zA-Z]{%d,}" % min_len, text.lower())
    # Exclude common stop words.
    stop = {"this", "that", "with", "from", "have", "been", "were", "will",
            "your", "their", "about", "which", "would", "could", "should",
            "these", "those", "after", "before", "between", "through",
            "during", "other", "some", "such", "than", "then", "also",
            "more", "most", "very", "just", "only", "into", "over"}
    return {w for w in words if w not in stop}


def score_faithfulness(
    agent_response: str,
    messages: list[dict[str, Any]],
) -> FaithfulnessResult:
    """Score how faithful the agent response is to tool outputs.

    Returns a FaithfulnessResult with component and overall scores.
    """
    result = FaithfulnessResult()

    # 1. Numerical faithfulness.
    result.response_numbers = extract_numbers(agent_response)
    result.tool_numbers = extract_tool_numbers(messages)
    if result.response_numbers:
        result.grounded_numbers = result.response_numbers & result.tool_numbers
        result.ungrounded_numbers = result.response_numbers - result.tool_numbers
        result.numerical_faithfulness = (
            len(result.grounded_numbers) / len(result.response_numbers)
            if result.response_numbers else 1.0
        )
    else:
        result.numerical_faithfulness = 1.0  # No numbers to check.

    # 2. Keyword coverage — are tool output terms reflected in the response?
    tool_text = " ".join(
        msg.get("content", "") for msg in messages if msg.get("role") == "tool"
    )
    if tool_text.strip():
        tool_keywords = _extract_keywords(tool_text)
        response_keywords = _extract_keywords(agent_response)
        if tool_keywords:
            overlap = tool_keywords & response_keywords
            result.keyword_overlap = len(overlap) / len(tool_keywords)
        else:
            result.keyword_overlap = 1.0
    else:
        result.keyword_overlap = 1.0  # No tool context to compare.

    # 3. Overall — weighted average.
    result.overall_score = (
        0.6 * result.numerical_faithfulness
        + 0.4 * result.keyword_overlap
    )

    return result


# ── Test cases ──────────────────────────────────────────────────────────────

SAMPLE_CASES = [
    {
        "name": "Perfect faithfulness",
        "response": "The predicted structure has a pLDDT of 85.3 and the ΔΔG for mutation A23G is -2.1 kcal/mol.",
        "messages": [
            {"role": "tool", "content": '{"plddt": 85.3, "model": "OmegaFold"}'},
            {"role": "tool", "content": '{"ddg": -2.1, "mutation": "A23G"}'},
        ],
    },
    {
        "name": "Hallucinated number",
        "response": "The pLDDT score is 92.7 which indicates a high-confidence prediction.",
        "messages": [
            {"role": "tool", "content": '{"plddt": 85.3, "model": "OmegaFold"}'},
        ],
    },
    {
        "name": "No tool context",
        "response": "Protein folding is the process by which a protein assumes its functional shape.",
        "messages": [],
    },
    {
        "name": "Partial faithfulness",
        "response": "The stability analysis shows ΔΔG of -2.1 kcal/mol. The melting temperature is 67.5°C.",
        "messages": [
            {"role": "tool", "content": '{"ddg": -2.1, "mutation": "K27R"}'},
        ],
    },
]


def run_samples() -> None:
    """Run faithfulness scoring on sample cases."""
    print("\n" + "=" * 60)
    print("  CONTEXT FAITHFULNESS EVALUATION")
    print("=" * 60)

    for case in SAMPLE_CASES:
        result = score_faithfulness(case["response"], case["messages"])
        status = "PASS" if result.overall_score >= 0.8 else "WARN" if result.overall_score >= 0.5 else "FAIL"
        print(f"\n  {status} {case['name']}")
        print(f"     Numerical faithfulness: {result.numerical_faithfulness:.0%}")
        print(f"     Keyword overlap:        {result.keyword_overlap:.0%}")
        print(f"     Overall score:          {result.overall_score:.0%}")
        if result.ungrounded_numbers:
            print(f"     Ungrounded numbers:     {result.ungrounded_numbers}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    run_samples()
