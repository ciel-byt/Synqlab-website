"""stop_task — kill a running worker task."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class StopTaskInput(BaseModel):
    task_id: str = Field(description="ID of the worker task to stop")


async def _stop_task_call(args: dict[str, Any], context: Any) -> ToolResult:
    from synqlab.agent.context import AgentContext

    ctx: AgentContext = context

    if not ctx.task_manager:
        return ToolResult.fail("stop_task is only available in coordinator sessions")

    task_id = args["task_id"]

    task = await ctx.task_manager.get_task(task_id)
    if not task:
        return ToolResult.fail(f"Task {task_id} not found")

    if task.state.value in ("completed", "failed", "killed"):
        return ToolResult.ok({
            "task_id": task_id,
            "state": task.state.value,
            "message": f"Task already in terminal state: {task.state.value}",
        })

    killed = await ctx.task_manager.kill_task(task_id)

    if ctx.task_manager.on_task_event:
        await ctx.task_manager.on_task_event({
            "type": "task_updated",
            "task": killed.to_dict(),
        })

    return ToolResult.ok({
        "task_id": task_id,
        "state": "killed",
        "message": "Worker task has been stopped.",
    })


stop_task_tool = build_tool(AgentToolDef(
    name="stop_task",
    description="Stop a running worker task. The worker will be aborted.",
    input_schema=StopTaskInput,
    call=_stop_task_call,
))
