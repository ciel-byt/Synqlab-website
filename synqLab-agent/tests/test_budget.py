"""Tests for the token budget engine."""

import pytest

from synqlab.agent.budget import BudgetStatus, BudgetTracker, TokenBudget


class TestTokenBudget:
    def test_defaults(self):
        budget = TokenBudget()
        assert budget.session_limit == 500_000
        assert budget.org_monthly_limit == 10_000_000
        assert budget.soft_ratio == 0.8
        assert budget.soft_limit == 400_000

    def test_custom(self):
        budget = TokenBudget(session_limit=100_000, soft_ratio=0.9)
        assert budget.soft_limit == 90_000

    def test_round_trip(self):
        budget = TokenBudget(session_limit=200_000)
        d = budget.to_dict()
        restored = TokenBudget.from_dict(d)
        assert restored.session_limit == 200_000
        assert restored.soft_limit == budget.soft_limit


class TestBudgetTracker:
    def test_initial_state(self):
        tracker = BudgetTracker()
        assert tracker.total_tokens == 0
        assert tracker.estimate_cost() == 0.0
        assert tracker.usage_ratio == 0.0

    def test_record_usage_ok(self):
        tracker = BudgetTracker(TokenBudget(session_limit=100_000))
        status = tracker.record_usage(1000, 500, model="gpt-4o")
        assert status == BudgetStatus.OK
        assert tracker.total_tokens == 1500
        assert tracker.input_tokens == 1000
        assert tracker.output_tokens == 500

    def test_soft_limit_triggers_once(self):
        tracker = BudgetTracker(TokenBudget(session_limit=10_000, soft_ratio=0.5))
        # First call pushes past 50%.
        status = tracker.record_usage(3000, 3000, model="gpt-4o")
        assert status == BudgetStatus.SOFT_LIMIT
        # Second call should return OK (already warned).
        status = tracker.record_usage(500, 500, model="gpt-4o")
        assert status == BudgetStatus.OK

    def test_hard_limit(self):
        tracker = BudgetTracker(TokenBudget(session_limit=1000))
        status = tracker.record_usage(600, 500, model="gpt-4o")
        assert status == BudgetStatus.HARD_LIMIT

    def test_cost_estimation_gpt4o(self):
        tracker = BudgetTracker()
        tracker.record_usage(1_000_000, 0, model="gpt-4o")
        # gpt-4o input: $2.50 per 1M tokens.
        assert tracker.estimate_cost() == pytest.approx(2.5, abs=0.01)

    def test_cost_estimation_gpt4o_mini(self):
        tracker = BudgetTracker()
        tracker.record_usage(0, 1_000_000, model="gpt-4o-mini")
        # gpt-4o-mini output: $0.60 per 1M tokens.
        assert tracker.estimate_cost() == pytest.approx(0.6, abs=0.01)

    def test_model_breakdown(self):
        tracker = BudgetTracker()
        tracker.record_usage(100, 50, model="gpt-4o")
        tracker.record_usage(200, 100, model="gpt-4o-mini")
        summary = tracker.usage_summary
        assert "gpt-4o" in summary["model_breakdown"]
        assert "gpt-4o-mini" in summary["model_breakdown"]
        assert summary["model_breakdown"]["gpt-4o"]["input"] == 100

    def test_usage_ratio(self):
        tracker = BudgetTracker(TokenBudget(session_limit=1000))
        tracker.record_usage(250, 250)
        assert tracker.usage_ratio == pytest.approx(0.5)

    def test_snapshot(self):
        tracker = BudgetTracker(TokenBudget(session_limit=1000))
        tracker.record_usage(100, 50, model="gpt-4o", tool_calls=3)
        snap = tracker.snapshot(model="gpt-4o")
        assert snap.input_tokens == 100
        assert snap.output_tokens == 50
        assert snap.tool_calls == 3
        assert snap.status == BudgetStatus.OK
