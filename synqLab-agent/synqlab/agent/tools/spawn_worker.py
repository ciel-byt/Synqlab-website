"""spawn_worker — coordinator tool that creates a specialist sub-agent.

The coordinator calls this tool to delegate a research task to a worker.
The worker runs in a background asyncio.Task and its results are collected
via the TaskManager.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class SpawnWorkerInput(BaseModel):
    agent_type: str = Field(
        description=(
            "Worker type to spawn. One of: folding_worker, literature_worker, "
            "analysis_worker, sequence_worker, general_worker"
        ),
    )
    goal: str = Field(
        description="Natural-language description of the task for the worker",
    )
    model: str = Field(
        default="gpt-4o",
        description="LLM model for the worker (default: gpt-4o)",
    )


async def _spawn_worker_call(args: dict[str, Any], context: Any) -> ToolResult:
    """Create a sub-agent task and run it in the background."""
    from synqlab.agent.context import AgentContext
    from synqlab.agent.engine import AgentConfig, AgentEngine, AgentEventType
    from synqlab.agent.tools import get_worker_tools

    ctx: AgentContext = context

    if not ctx.task_manager:
        return ToolResult.fail("spawn_worker is only available in coordinator sessions")

    agent_type = args["agent_type"]
    goal = args["goal"]
    model = args.get("model", "gpt-4o")

    # Create the task record.
    task = await ctx.task_manager.create_task(agent_type=agent_type, goal=goal)

    # Build worker context (inherits identity from coordinator).
    worker_ctx = AgentContext(
        session_id=f"worker-{task.id[:8]}",
        user_id=ctx.user_id,
        org_id=ctx.org_id,
        project_id=ctx.project_id,
        parent_task_id=task.id,
        tool_registry={"agent_type": agent_type},
    )

    # Build worker config and engine.
    worker_config = AgentConfig(model=model, autonomy_mode="autonomous")
    worker_tools = get_worker_tools()
    worker_engine = AgentEngine(
        config=worker_config, tools=worker_tools, context=worker_ctx,
    )

    # Background coroutine that runs the worker to completion.
    async def _run_worker() -> None:
        try:
            await ctx.task_manager.start_task(task.id)

            # Emit task_spawned event via callback.
            if ctx.task_manager.on_task_event:
                await ctx.task_manager.on_task_event({
                    "type": "task_spawned",
                    "task": task.to_dict(),
                })

            collected_text: list[str] = []
            async for event in worker_engine.submit_message(goal):
                if event.type == AgentEventType.TEXT_DONE:
                    collected_text.append(event.data.get("content", ""))
                elif event.type == AgentEventType.ERROR:
                    raise RuntimeError(event.data.get("message", "Worker error"))

            result_data = {
                "text": "\n\n".join(collected_text),
                "tool_calls": worker_engine.total_tool_calls,
                "tokens_used": (
                    worker_engine.total_input_tokens
                    + worker_engine.total_output_tokens
                ),
            }
            completed = await ctx.task_manager.complete_task(task.id, result_data)

            if ctx.task_manager.on_task_event:
                await ctx.task_manager.on_task_event({
                    "type": "task_completed",
                    "task": completed.to_dict(),
                })

        except asyncio.CancelledError:
            logger.info("Worker task %s cancelled", task.id[:8])
        except Exception as exc:
            logger.exception("Worker task %s failed", task.id[:8])
            failed = await ctx.task_manager.fail_task(task.id, str(exc))
            if ctx.task_manager.on_task_event:
                await ctx.task_manager.on_task_event({
                    "type": "task_updated",
                    "task": failed.to_dict(),
                })

    # Launch background task and register.
    bg = asyncio.create_task(_run_worker())
    ctx.task_manager.register_worker(task.id, worker_engine, bg)

    return ToolResult.ok({
        "task_id": task.id,
        "agent_type": agent_type,
        "goal": goal,
        "state": "running",
        "message": f"Worker '{agent_type}' spawned. Use list_tasks to check progress.",
    })


spawn_worker_tool = build_tool(AgentToolDef(
    name="spawn_worker",
    description=(
        "Spawn a specialist worker agent to perform a research sub-task. "
        "Returns immediately with a task_id — the worker runs in the background. "
        "Use list_tasks to check progress and results."
    ),
    input_schema=SpawnWorkerInput,
    call=_spawn_worker_call,
))
