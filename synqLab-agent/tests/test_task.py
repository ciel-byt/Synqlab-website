"""Tests for the TaskManager lifecycle."""

import asyncio

import pytest

from synqlab.agent.task import Task, TaskManager, TaskState


class TestTask:
    def test_initial_state(self):
        task = Task(
            id="t1",
            parent_session_id="s1",
            agent_type="folding_worker",
            goal="Fold a protein",
        )
        assert task.state == TaskState.PENDING
        assert task.result is None
        assert task.error is None

    def test_to_dict(self):
        task = Task(id="t1", parent_session_id="s1", agent_type="worker", goal="test")
        d = task.to_dict()
        assert d["id"] == "t1"
        assert d["state"] == "pending"


class TestTaskManager:
    @pytest.mark.asyncio
    async def test_create_task(self):
        mgr = TaskManager(parent_session_id="s1")
        task = await mgr.create_task("folding_worker", "Fold protein X")
        assert task.state == TaskState.PENDING
        assert task.agent_type == "folding_worker"

    @pytest.mark.asyncio
    async def test_full_lifecycle(self):
        mgr = TaskManager(parent_session_id="s1")
        task = await mgr.create_task("worker", "Do work")

        started = await mgr.start_task(task.id)
        assert started.state == TaskState.RUNNING

        completed = await mgr.complete_task(task.id, {"result": "done"})
        assert completed.state == TaskState.COMPLETED
        assert completed.result == {"result": "done"}

    @pytest.mark.asyncio
    async def test_fail_task(self):
        mgr = TaskManager(parent_session_id="s1")
        task = await mgr.create_task("worker", "Fail")
        await mgr.start_task(task.id)
        failed = await mgr.fail_task(task.id, "Timeout")
        assert failed.state == TaskState.FAILED
        assert failed.error == "Timeout"

    @pytest.mark.asyncio
    async def test_kill_task(self):
        mgr = TaskManager(parent_session_id="s1")
        task = await mgr.create_task("worker", "Kill me")
        await mgr.start_task(task.id)
        killed = await mgr.kill_task(task.id)
        assert killed.state == TaskState.KILLED

    @pytest.mark.asyncio
    async def test_list_tasks(self):
        mgr = TaskManager(parent_session_id="s1")
        await mgr.create_task("w1", "Goal 1")
        await mgr.create_task("w2", "Goal 2")
        tasks = await mgr.list_tasks()
        assert len(tasks) == 2

    @pytest.mark.asyncio
    async def test_unknown_task_raises(self):
        mgr = TaskManager(parent_session_id="s1")
        with pytest.raises(ValueError, match="not found"):
            await mgr.start_task("nonexistent-id")
