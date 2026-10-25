"""list_tasks — list all sub-agent tasks for the current coordinator session."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class ListTasksInput(BaseModel):
    """No parameters needed — lists all tasks for the current session."""
    pass


async def _list_tasks_call(args: dict[str, Any], context: Any) -> ToolResult:
    from synqlab.agent.context import AgentContext

    ctx: AgentContext = context

    if not ctx.task_manager:
        return ToolResult.fail("list_tasks is only available in coordinator sessions")

    tasks = await ctx.task_manager.list_tasks()

    task_summaries = []
    for t in tasks:
        summary: dict[str, Any] = {
            "task_id": t.id,
            "agent_type": t.agent_type,
            "goal": t.goal[:200],  # truncate long goals
            "state": t.state.value,
        }
        if t.result:
            # Include a preview of the result text.
            text = t.result.get("text", "")
            summary["result_preview"] = text[:500] if text else "(no text)"
            summary["tool_calls"] = t.result.get("tool_calls", 0)
        if t.error:
            summary["error"] = t.error[:200]
        task_summaries.append(summary)

    return ToolResult.ok({
        "total_tasks": len(task_summaries),
        "tasks": task_summaries,
    })


list_tasks_tool = build_tool(AgentToolDef(
    name="list_tasks",
    description=(
        "List all sub-agent tasks for the current session. "
        "Shows each task's ID, type, goal, state, and result preview."
    ),
    input_schema=ListTasksInput,
    call=_list_tasks_call,
    is_read_only=True,
))
