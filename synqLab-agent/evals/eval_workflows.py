"""R5: End-to-end workflow evaluation.

Loads evals/workflows.json and scores completion of research workflows
through the agent engine.  Checks tool sequence, response quality,
and domain-specific markers (pLDDT, ΔΔG mentions).

Usage:
    python -m evals.eval_workflows           # dry-run baseline
    python -m evals.eval_workflows --live     # run against real OpenAI
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from synqlab.agent.engine import AgentEngine, AgentConfig, AgentEventType
from synqlab.agent.tools import get_all_agent_tools

DATASET_PATH = Path(__file__).parent / "workflows.json"


@dataclass
class WorkflowResult:
    id: str
    name: str
    tools_called: list[str] = field(default_factory=list)
    text_responses: list[str] = field(default_factory=list)
    turns: int = 0
    passed_criteria: dict[str, bool] = field(default_factory=dict)

    @property
    def score(self) -> float:
        if not self.passed_criteria:
            return 0.0
        return sum(self.passed_criteria.values()) / len(self.passed_criteria)

    @property
    def passed(self) -> bool:
        return all(self.passed_criteria.values())


def check_criteria(
    result: WorkflowResult,
    criteria: dict[str, Any],
    expected_tools: list[str],
) -> dict[str, bool]:
    """Evaluate completion criteria against actual results."""
    checks: dict[str, bool] = {}
    full_text = " ".join(result.text_responses).lower()

    # Tools called check.
    if "tools_called" in criteria:
        expected_set = set(criteria["tools_called"])
        actual_set = set(result.tools_called)
        checks["tools_called"] = expected_set.issubset(actual_set)

    # Has text response.
    if criteria.get("has_text_response"):
        checks["has_text_response"] = len(full_text.strip()) > 20

    # No tools used (knowledge-only).
    if criteria.get("no_tools_used"):
        checks["no_tools_used"] = len(result.tools_called) == 0

    # Domain markers.
    if criteria.get("mentions_plddt"):
        checks["mentions_plddt"] = bool(re.search(r"plddt|confidence|score", full_text))

    if criteria.get("mentions_ddg"):
        checks["mentions_ddg"] = bool(re.search(r"δδg|ddg|stability|kcal|energy", full_text))

    if criteria.get("report_generated"):
        checks["report_generated"] = "write_report" in result.tools_called

    return checks


async def run_workflow(
    case: dict[str, Any],
    live: bool = False,
) -> WorkflowResult:
    """Run a single workflow scenario."""
    result = WorkflowResult(id=case["id"], name=case["name"])

    if not live:
        # Dry-run: simulate perfect completion.
        result.tools_called = case["expected_tool_sequence"]
        result.text_responses = [
            f"Mock response for {case['name']}. "
            f"pLDDT score: 85.2. ΔΔG: -2.1 kcal/mol. "
            f"Report generated successfully."
        ]
        result.turns = len(case["expected_tool_sequence"]) + 1
    else:
        # Live mode.
        tools = get_all_agent_tools()
        config = AgentConfig(
            model="gpt-4o-mini",
            max_turns=case.get("max_turns", 10),
        )
        engine = AgentEngine(config=config, tools=tools)

        async for event in engine.run(case["prompt"]):
            if event.type == AgentEventType.TOOL_STARTED:
                name = event.data.get("name", "")
                if name:
                    result.tools_called.append(name)
            elif event.type == AgentEventType.TEXT_DONE:
                content = event.data.get("content", "")
                if content:
                    result.text_responses.append(content)
            elif event.type == AgentEventType.TURN_DONE:
                result.turns += 1

    result.passed_criteria = check_criteria(
        result, case["completion_criteria"], case["expected_tool_sequence"],
    )
    return result


async def run_eval(live: bool = False) -> list[WorkflowResult]:
    """Run all workflow evaluations."""
    with open(DATASET_PATH) as f:
        dataset = json.load(f)

    results = []
    for case in dataset:
        result = await run_workflow(case, live=live)
        results.append(result)

    return results


def print_report(results: list[WorkflowResult]) -> None:
    """Pretty-print workflow evaluation results."""
    print("\n" + "=" * 60)
    print("  END-TO-END WORKFLOW EVALUATION REPORT")
    print("=" * 60)

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    avg_score = sum(r.score for r in results) / total if total else 0

    print(f"\n  Workflows:  {passed}/{total} passed ({passed/total*100:.0f}%)")
    print(f"  Avg score:  {avg_score:.2f}")
    print()

    for r in results:
        status = "✅" if r.passed else "❌"
        print(f"  {status} [{r.id}] {r.name} — {r.score:.0%}")
        for crit, ok in r.passed_criteria.items():
            mark = "✓" if ok else "✗"
            print(f"       {mark} {crit}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    live = "--live" in sys.argv
    mode = "LIVE" if live else "DRY-RUN"
    print(f"\nRunning workflow eval in {mode} mode...\n")
    results = asyncio.run(run_eval(live=live))
    print_report(results)
