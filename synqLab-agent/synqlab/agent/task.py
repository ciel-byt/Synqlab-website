"""Task model — sub-agent work units with lifecycle management.

Mirrors Claude Code's ``Task.ts``:
- TaskState enum with full lifecycle (pending → running → completed/failed/killed)
- Task dataclass holding worker metadata and results
- TaskManager for in-memory + DB task lifecycle operations
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task state machine
# ---------------------------------------------------------------------------

class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    KILLED = "killed"


# ---------------------------------------------------------------------------
# Task dataclass
# ---------------------------------------------------------------------------

@dataclass
class Task:
    """A single unit of work delegated to a sub-agent worker.

    Created by the coordinator's ``spawn_worker`` tool.
    """

    id: str
    parent_session_id: str
    agent_type: str  # e.g. "folding_worker", "literature_worker"
    goal: str  # natural-language description
    state: TaskState = TaskState.PENDING
    result: dict[str, Any] | None = None
    error: str | None = None
    worker_session_id: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "parent_session_id": self.parent_session_id,
            "agent_type": self.agent_type,
            "goal": self.goal,
            "state": self.state.value,
            "result": self.result,
            "error": self.error,
            "worker_session_id": self.worker_session_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Task manager
# ---------------------------------------------------------------------------

class TaskManager:
    """In-memory task lifecycle manager for a coordinator session.

    One TaskManager per coordinator session — tracks all spawned workers.
    """

    def __init__(self, parent_session_id: str):
        self.parent_session_id = parent_session_id
        self._tasks: dict[str, Task] = {}
        self._worker_engines: dict[str, Any] = {}  # task_id -> AgentEngine
        self._worker_tasks: dict[str, asyncio.Task[Any]] = {}  # task_id -> asyncio.Task
        self._lock = asyncio.Lock()
        # Callback for event forwarding (set by the API layer).
        self.on_task_event: Any = None

    async def create_task(
        self,
        agent_type: str,
        goal: str,
    ) -> Task:
        """Create a new pending task."""
        task = Task(
            id=str(uuid.uuid4()),
            parent_session_id=self.parent_session_id,
            agent_type=agent_type,
            goal=goal,
        )
        async with self._lock:
            self._tasks[task.id] = task
        logger.info("Task %s created: agent_type=%s", task.id[:8], agent_type)
        return task

    async def start_task(self, task_id: str) -> Task:
        """Transition a task to running state."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")
            task.state = TaskState.RUNNING
            task.updated_at = datetime.now(timezone.utc)
        return task

    async def complete_task(self, task_id: str, result: dict[str, Any]) -> Task:
        """Mark a task as completed with results."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")
            task.state = TaskState.COMPLETED
            task.result = result
            task.updated_at = datetime.now(timezone.utc)
        logger.info("Task %s completed", task_id[:8])
        return task

    async def fail_task(self, task_id: str, error: str) -> Task:
        """Mark a task as failed with error message."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")
            task.state = TaskState.FAILED
            task.error = error
            task.updated_at = datetime.now(timezone.utc)
        logger.warning("Task %s failed: %s", task_id[:8], error)
        return task

    async def kill_task(self, task_id: str) -> Task:
        """Kill a running task and its worker engine."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")
            task.state = TaskState.KILLED
            task.updated_at = datetime.now(timezone.utc)

            # Abort the worker engine if running.
            engine = self._worker_engines.get(task_id)
            if engine:
                engine.context.request_abort()

            # Cancel the asyncio task if running.
            bg_task = self._worker_tasks.get(task_id)
            if bg_task and not bg_task.done():
                bg_task.cancel()

        logger.info("Task %s killed", task_id[:8])
        return task

    async def get_task(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    async def list_tasks(self) -> list[Task]:
        return list(self._tasks.values())

    def register_worker(self, task_id: str, engine: Any, bg_task: asyncio.Task[Any]) -> None:
        """Register a worker engine and its background asyncio.Task."""
        self._worker_engines[task_id] = engine
        self._worker_tasks[task_id] = bg_task

    def get_worker_engine(self, task_id: str) -> Any | None:
        return self._worker_engines.get(task_id)
