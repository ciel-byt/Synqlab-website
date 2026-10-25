"""Phase 8 Plan 1: Multi-session concurrency stress tests.

Validates that ``AgentContext`` and the surrounding agent system maintain
per-session isolation under concurrent multi-user load.

Closes the v1 milestone audit gap that flagged REQ-07 (multi-user sessions)
as ``partial`` because the isolation model was implemented but never proven
under concurrency.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import patch

import pytest

from synqlab.agent.budget import BudgetTracker, TokenBudget
from synqlab.agent.context import AgentContext
from synqlab.agent.task import TaskManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ctx(session_id: str, user_id: str = "u", org_id: str = "org") -> AgentContext:
    """Build an AgentContext with explicit, instance-scoped collections."""
    return AgentContext(
        session_id=session_id,
        user_id=user_id,
        org_id=org_id,
        tool_registry={},
    )


# ---------------------------------------------------------------------------
# Task 3: AgentContext field independence assertions (synchronous)
# ---------------------------------------------------------------------------

class TestAgentContextIsolation:
    """Per-session field independence — defends against dataclass default-mutable bugs."""

    def test_mutable_defaults_are_independent(self):
        """Verify dataclass mutable defaults create fresh instances."""
        ctx_a = AgentContext(
            session_id="a", org_id="org", user_id="u1", tool_registry={},
        )
        ctx_b = AgentContext(
            session_id="b", org_id="org", user_id="u2", tool_registry={},
        )

        ctx_a.tool_results.append({"test": "a"})
        assert len(ctx_b.tool_results) == 0  # must not leak

        ctx_a.active_skills.append("skill-a")
        assert len(ctx_b.active_skills) == 0

        # tool_registry is also a default_factory dict — verify same property.
        ctx_a.tool_registry["agent_type"] = "coordinator"
        assert ctx_b.tool_registry == {}

    def test_pending_approvals_are_independent(self):
        """The ``_pending_approvals`` futures dict must be per-instance."""
        ctx_a = _make_ctx("a")
        ctx_b = _make_ctx("b")

        # Both start empty and identifiers are not the same dict object.
        assert ctx_a._pending_approvals is not ctx_b._pending_approvals
        assert ctx_a._pending_approvals == {}
        assert ctx_b._pending_approvals == {}


# ---------------------------------------------------------------------------
# Task 1: Concurrent session isolation under load
# ---------------------------------------------------------------------------

class TestConcurrentSessionIsolation:
    """Stress tests that run multiple simulated sessions in parallel."""

    @pytest.mark.asyncio
    async def test_parallel_context_creation(self):
        """Five contexts created in parallel keep distinct identity."""

        async def _build(i: int) -> AgentContext:
            await asyncio.sleep(0)  # yield to scheduler
            return _make_ctx(f"sess-{i}", user_id=f"u-{i}", org_id=f"org-{i}")

        contexts = await asyncio.gather(*(_build(i) for i in range(5)))

        # All identities are unique.
        assert len({c.session_id for c in contexts}) == 5
        assert len({c.user_id for c in contexts}) == 5
        assert len({c.org_id for c in contexts}) == 5

        # And no shared collections — mutating one must not bleed into others.
        contexts[0].tool_results.append({"sess": "0"})
        for c in contexts[1:]:
            assert c.tool_results == []

    @pytest.mark.asyncio
    async def test_concurrent_tool_results_isolation(self):
        """Concurrent ``tool_results`` writes stay scoped to their context."""

        contexts = [_make_ctx(f"sess-{i}", user_id=f"u-{i}") for i in range(5)]

        async def _simulated_tool(ctx: AgentContext) -> None:
            # Yield several times so coroutines truly interleave.
            for n in range(10):
                await asyncio.sleep(0)
                ctx.tool_results.append({
                    "session": ctx.session_id,
                    "iteration": n,
                })

        await asyncio.gather(*(_simulated_tool(c) for c in contexts))

        for ctx in contexts:
            # Exactly the ten results we wrote, all bearing this session's id.
            assert len(ctx.tool_results) == 10
            assert all(r["session"] == ctx.session_id for r in ctx.tool_results)

    @pytest.mark.asyncio
    async def test_concurrent_budget_isolation(self):
        """Per-session ``BudgetTracker`` instances accumulate independently."""
        budgets: list[BudgetTracker] = []
        for i in range(5):
            tracker = BudgetTracker(TokenBudget(session_limit=10_000))
            budgets.append(tracker)

        async def _record(idx: int, tracker: BudgetTracker) -> None:
            for _ in range(3):
                await asyncio.sleep(0)
                tracker.record_usage(
                    input_tokens=100 * (idx + 1),
                    output_tokens=50 * (idx + 1),
                    model="gpt-4o",
                )

        await asyncio.gather(*(
            _record(i, tracker) for i, tracker in enumerate(budgets)
        ))

        # Each tracker accumulates 3 * (input + output) for its own multiplier.
        for i, tracker in enumerate(budgets):
            expected = 3 * (100 * (i + 1) + 50 * (i + 1))
            assert tracker.total_tokens == expected
            assert tracker.input_tokens == 3 * 100 * (i + 1)
            assert tracker.output_tokens == 3 * 50 * (i + 1)

    @pytest.mark.asyncio
    async def test_task_manager_listings_are_scoped(self):
        """Two coordinators with their own TaskManagers see only their own tasks."""
        tm_a = TaskManager(parent_session_id="coord-a")
        tm_b = TaskManager(parent_session_id="coord-b")

        # Create tasks on each manager concurrently.
        async def _spawn(tm: TaskManager, prefix: str, n: int) -> None:
            for i in range(n):
                await tm.create_task(
                    agent_type="folding_worker",
                    goal=f"{prefix}-task-{i}",
                )

        await asyncio.gather(_spawn(tm_a, "A", 3), _spawn(tm_b, "B", 4))

        a_tasks = await tm_a.list_tasks()
        b_tasks = await tm_b.list_tasks()

        assert len(a_tasks) == 3
        assert len(b_tasks) == 4
        assert all(t.parent_session_id == "coord-a" for t in a_tasks)
        assert all(t.parent_session_id == "coord-b" for t in b_tasks)

        # Cross-check: no task ID overlap between managers.
        a_ids = {t.id for t in a_tasks}
        b_ids = {t.id for t in b_tasks}
        assert a_ids.isdisjoint(b_ids)


# ---------------------------------------------------------------------------
# Task 2: Abort signal isolation
# ---------------------------------------------------------------------------

class TestAbortSignalIsolation:
    """Aborts must affect only the targeted session's context."""

    def test_abort_does_not_leak_across_sessions(self):
        """Aborting one context leaves siblings' ``abort`` flag untouched."""
        ctxs = [_make_ctx(f"sess-{i}") for i in range(3)]

        ctxs[1].request_abort()

        assert ctxs[0].abort is False
        assert ctxs[1].abort is True
        assert ctxs[2].abort is False

    @pytest.mark.asyncio
    async def test_abort_resolves_only_local_pending_approvals(self):
        """``request_abort`` resolves pending futures on its own context only."""
        ctx_a = _make_ctx("a")
        ctx_b = _make_ctx("b")
        ctx_c = _make_ctx("c")

        # Create pending approval futures on each context.
        loop = asyncio.get_running_loop()
        fut_a = loop.create_future()
        fut_b = loop.create_future()
        fut_c = loop.create_future()
        ctx_a._pending_approvals["call-a"] = fut_a
        ctx_b._pending_approvals["call-b"] = fut_b
        ctx_c._pending_approvals["call-c"] = fut_c

        # Abort only B.
        ctx_b.request_abort()

        # Only B's future is resolved (with False because it was an abort).
        assert fut_b.done()
        assert fut_b.result() is False

        # The other two are still pending and the contexts themselves are not aborted.
        assert not fut_a.done()
        assert not fut_c.done()
        assert ctx_a.abort is False
        assert ctx_c.abort is False
