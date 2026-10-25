"""send_message — send a follow-up message to a running worker agent."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class SendMessageInput(BaseModel):
    task_id: str = Field(description="ID of the worker task to message")
    message: str = Field(description="Message to send to the worker")


async def _send_message_call(args: dict[str, Any], context: Any) -> ToolResult:
    from synqlab.agent.context import AgentContext
    from synqlab.agent.engine import AgentEventType

    ctx: AgentContext = context

    if not ctx.task_manager:
        return ToolResult.fail("send_message is only available in coordinator sessions")

    task_id = args["task_id"]
    message = args["message"]

    task = await ctx.task_manager.get_task(task_id)
    if not task:
        return ToolResult.fail(f"Task {task_id} not found")

    if task.state.value != "running":
        return ToolResult.fail(f"Task {task_id} is not running (state: {task.state.value})")

    engine = ctx.task_manager.get_worker_engine(task_id)
    if not engine:
        return ToolResult.fail(f"Worker engine for task {task_id} not found")

    # Run the message through the worker engine and collect response.
    collected: list[str] = []
    try:
        async for event in engine.submit_message(message):
            if event.type == AgentEventType.TEXT_DONE:
                collected.append(event.data.get("content", ""))
    except Exception as exc:
        return ToolResult.fail(f"Failed to send message: {exc}")

    return ToolResult.ok({
        "task_id": task_id,
        "response": "\n\n".join(collected) if collected else "(no text response)",
    })


send_message_tool = build_tool(AgentToolDef(
    name="send_message",
    description=(
        "Send a follow-up message or instruction to a running worker agent. "
        "Returns the worker's response text."
    ),
    input_schema=SendMessageInput,
    call=_send_message_call,
))
