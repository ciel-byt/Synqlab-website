"""Token budget enforcement and cost estimation.

Provides per-session token budgets with soft/hard limits and
model-specific cost estimation for the agent system.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ── Model pricing (USD per 1M tokens) ──────────────────────────────────────

MODEL_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    # Fallback for unknown models.
    "_default": {"input": 2.50, "output": 10.00},
}


# ── Data model ──────────────────────────────────────────────────────────────


@dataclass
class TokenBudget:
    """Token budget configuration for a session."""

    session_limit: int = 500_000         # max tokens per session
    org_monthly_limit: int = 10_000_000  # max tokens per org per month
    soft_ratio: float = 0.8             # warn at 80% usage

    @property
    def soft_limit(self) -> int:
        return int(self.session_limit * self.soft_ratio)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_limit": self.session_limit,
            "org_monthly_limit": self.org_monthly_limit,
            "soft_ratio": self.soft_ratio,
            "soft_limit": self.soft_limit,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TokenBudget:
        return cls(
            session_limit=data.get("session_limit", 500_000),
            org_monthly_limit=data.get("org_monthly_limit", 10_000_000),
            soft_ratio=data.get("soft_ratio", 0.8),
        )


class BudgetStatus(str, Enum):
    OK = "ok"
    SOFT_LIMIT = "soft_limit"
    HARD_LIMIT = "hard_limit"


@dataclass
class UsageSnapshot:
    """Point-in-time usage snapshot."""

    input_tokens: int = 0
    output_tokens: int = 0
    tool_calls: int = 0
    model: str = ""
    estimated_cost_usd: float = 0.0
    status: BudgetStatus = BudgetStatus.OK


# ── Tracker ─────────────────────────────────────────────────────────────────


class BudgetTracker:
    """Tracks cumulative token usage against a budget."""

    def __init__(self, budget: TokenBudget | None = None):
        self.budget = budget or TokenBudget()
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.tool_calls: int = 0
        self._cost_usd: float = 0.0
        self._model_usage: dict[str, dict[str, int]] = {}
        self._soft_warned: bool = False

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def record_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str = "",
        tool_calls: int = 0,
    ) -> BudgetStatus:
        """Record token usage and return budget status."""
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.tool_calls += tool_calls

        # Track per-model usage.
        if model:
            if model not in self._model_usage:
                self._model_usage[model] = {"input": 0, "output": 0}
            self._model_usage[model]["input"] += input_tokens
            self._model_usage[model]["output"] += output_tokens

        # Update cost.
        self._cost_usd += self._compute_cost(input_tokens, output_tokens, model)

        # Check limits.
        total = self.total_tokens

        if total >= self.budget.session_limit:
            logger.warning(
                "Hard budget limit reached: %d / %d tokens",
                total, self.budget.session_limit,
            )
            return BudgetStatus.HARD_LIMIT

        if total >= self.budget.soft_limit and not self._soft_warned:
            self._soft_warned = True
            logger.info(
                "Soft budget limit reached: %d / %d tokens (%.0f%%)",
                total, self.budget.session_limit,
                (total / self.budget.session_limit) * 100,
            )
            return BudgetStatus.SOFT_LIMIT

        return BudgetStatus.OK

    def estimate_cost(self) -> float:
        """Return estimated cost in USD."""
        return round(self._cost_usd, 4)

    @property
    def usage_ratio(self) -> float:
        """Usage as a fraction of session limit (0.0 – 1.0+)."""
        if self.budget.session_limit <= 0:
            return 0.0
        return self.total_tokens / self.budget.session_limit

    @property
    def usage_summary(self) -> dict[str, Any]:
        """Current usage stats for API responses / events."""
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "tool_calls": self.tool_calls,
            "estimated_cost_usd": self.estimate_cost(),
            "budget_limit": self.budget.session_limit,
            "budget_used_ratio": round(self.usage_ratio, 3),
            "status": (
                BudgetStatus.HARD_LIMIT.value if self.total_tokens >= self.budget.session_limit
                else BudgetStatus.SOFT_LIMIT.value if self._soft_warned
                else BudgetStatus.OK.value
            ),
            "model_breakdown": dict(self._model_usage),
        }

    def snapshot(self, model: str = "") -> UsageSnapshot:
        """Create a usage snapshot for persistence."""
        return UsageSnapshot(
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            tool_calls=self.tool_calls,
            model=model,
            estimated_cost_usd=self.estimate_cost(),
            status=BudgetStatus.HARD_LIMIT if self.total_tokens >= self.budget.session_limit
                   else BudgetStatus.SOFT_LIMIT if self._soft_warned
                   else BudgetStatus.OK,
        )

    @staticmethod
    def _compute_cost(input_tokens: int, output_tokens: int, model: str) -> float:
        """Compute cost for a single usage increment."""
        pricing = MODEL_PRICING.get(model, MODEL_PRICING["_default"])
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
