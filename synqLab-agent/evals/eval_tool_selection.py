"""R4: Tool selection evaluation scorer.

Loads evals/tool_selection.json reference dataset and scores the agent's
tool selection against expected tools.  Uses code-based matching (no LLM
judge needed for v1 — tool names are deterministic).

Usage:
    python -m evals.eval_tool_selection          # dry-run with mock engine
    python -m evals.eval_tool_selection --live    # run against real OpenAI
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Ensure project root is on sys.path.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from synqlab.agent.engine import AgentEngine, AgentConfig, AgentEventType
from synqlab.agent.tools import get_all_agent_tools

logger = logging.getLogger(__name__)

DATASET_PATH = Path(__file__).parent / "tool_selection.json"


# ── Result types ────────────────────────────────────────────────────────────

@dataclass
class CaseResult:
    id: str
    prompt: str
    expected_tools: list[str]
    actual_tools: list[str]
    match: bool
    partial: bool  # at least one expected tool was called
    precision: float = 0.0
    recall: float = 0.0

    @property
    def f1(self) -> float:
        if self.precision + self.recall == 0:
            return 0.0
        return 2 * (self.precision * self.recall) / (self.precision + self.recall)


@dataclass
class EvalReport:
    total: int = 0
    exact_match: int = 0
    partial_match: int = 0
    no_match: int = 0
    avg_precision: float = 0.0
    avg_recall: float = 0.0
    avg_f1: float = 0.0
    cases: list[CaseResult] = field(default_factory=list)


# ── Scorer ──────────────────────────────────────────────────────────────────

def score_case(expected: list[str], actual: list[str]) -> tuple[bool, bool, float, float]:
    """Score tool selection for a single case.

    Returns (exact_match, partial_match, precision, recall).
    """
    expected_set = set(expected)
    actual_set = set(actual)

    # No-tool case: both should be empty.
    if not expected_set and not actual_set:
        return True, True, 1.0, 1.0
    if not expected_set and actual_set:
        return False, False, 0.0, 1.0  # recall is 1 (nothing to recall)
    if expected_set and not actual_set:
        return False, False, 0.0, 0.0

    intersection = expected_set & actual_set
    precision = len(intersection) / len(actual_set) if actual_set else 0.0
    recall = len(intersection) / len(expected_set) if expected_set else 0.0
    exact = expected_set == actual_set
    partial = len(intersection) > 0

    return exact, partial, precision, recall


# ── Runner ──────────────────────────────────────────────────────────────────

async def run_single_case(
    case: dict[str, Any],
    live: bool = False,
) -> CaseResult:
    """Run a single eval case through the engine and collect tool names."""
    if not live:
        # Dry-run: simulate expected tools as actual (perfect score baseline).
        return CaseResult(
            id=case["id"],
            prompt=case["prompt"],
            expected_tools=case["expected_tools"],
            actual_tools=case["expected_tools"],
            match=True,
            partial=True,
            precision=1.0,
            recall=1.0,
        )

    # Live mode: run through real engine.
    tools = get_all_agent_tools()
    config = AgentConfig(model="gpt-4o-mini", max_turns=5)
    engine = AgentEngine(config=config, tools=tools)

    actual_tools: list[str] = []
    async for event in engine.run(case["prompt"]):
        if event.type == AgentEventType.TOOL_STARTED:
            tool_name = event.data.get("name", "")
            if tool_name and tool_name not in actual_tools:
                actual_tools.append(tool_name)

    exact, partial, precision, recall = score_case(
        case["expected_tools"], actual_tools,
    )

    return CaseResult(
        id=case["id"],
        prompt=case["prompt"],
        expected_tools=case["expected_tools"],
        actual_tools=actual_tools,
        match=exact,
        partial=partial,
        precision=precision,
        recall=recall,
    )


async def run_eval(live: bool = False) -> EvalReport:
    """Run the full tool selection evaluation."""
    with open(DATASET_PATH) as f:
        dataset = json.load(f)

    report = EvalReport(total=len(dataset))

    for case in dataset:
        result = await run_single_case(case, live=live)
        report.cases.append(result)

        if result.match:
            report.exact_match += 1
        elif result.partial:
            report.partial_match += 1
        else:
            report.no_match += 1

    if report.cases:
        report.avg_precision = sum(c.precision for c in report.cases) / len(report.cases)
        report.avg_recall = sum(c.recall for c in report.cases) / len(report.cases)
        report.avg_f1 = sum(c.f1 for c in report.cases) / len(report.cases)

    return report


def print_report(report: EvalReport) -> None:
    """Pretty-print the evaluation report."""
    print("\n" + "=" * 60)
    print("  TOOL SELECTION EVALUATION REPORT")
    print("=" * 60)
    print(f"\n  Total cases:    {report.total}")
    print(f"  Exact match:    {report.exact_match}/{report.total} ({report.exact_match/report.total*100:.0f}%)")
    print(f"  Partial match:  {report.partial_match}/{report.total}")
    print(f"  No match:       {report.no_match}/{report.total}")
    print(f"\n  Avg Precision:  {report.avg_precision:.2f}")
    print(f"  Avg Recall:     {report.avg_recall:.2f}")
    print(f"  Avg F1:         {report.avg_f1:.2f}")
    print()

    # Show failures.
    failures = [c for c in report.cases if not c.match]
    if failures:
        print("  MISMATCHES:")
        for c in failures:
            print(f"    [{c.id}] Expected: {c.expected_tools} → Got: {c.actual_tools}")
    else:
        print("  ✅ All cases matched!")
    print("=" * 60)


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    live = "--live" in sys.argv
    mode = "LIVE (calling OpenAI)" if live else "DRY-RUN (baseline)"
    print(f"\nRunning tool selection eval in {mode} mode...\n")
    report = asyncio.run(run_eval(live=live))
    print_report(report)
