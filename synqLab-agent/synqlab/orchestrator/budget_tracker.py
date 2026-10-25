"""BudgetTracker — tracks resource consumption across a pipeline run."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BudgetTracker:
    """Tracks candidate counts and elapsed time for a single experiment run."""

    n_generated: int = 0
    n_to_structure: int = 0
    n_passed_gate1: int = 0
    n_to_scoring: int = 0
    n_passed_gate2: int = 0
    n_to_reranker: int = 0
    n_top_k: int = 0
    _start_time: float = field(default_factory=time.monotonic, repr=False)

    def elapsed_seconds(self) -> float:
        """Return seconds elapsed since the tracker was created."""
        return time.monotonic() - self._start_time

    def summary(self) -> dict:
        """Return a JSON-serialisable summary dict."""
        return {
            "n_generated": self.n_generated,
            "n_to_structure": self.n_to_structure,
            "n_passed_gate1": self.n_passed_gate1,
            "n_to_scoring": self.n_to_scoring,
            "n_passed_gate2": self.n_passed_gate2,
            "n_to_reranker": self.n_to_reranker,
            "n_top_k": self.n_top_k,
            "elapsed_seconds": round(self.elapsed_seconds(), 2),
        }

    def log(self) -> None:
        logger.info("Budget summary: %s", self.summary())
