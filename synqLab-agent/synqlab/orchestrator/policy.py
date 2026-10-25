"""V1Policy — rule-based gating: pLDDT threshold, ΔΔG threshold, top-k selection."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Candidate:
    """A design candidate with accumulated tool scores."""

    sequence: str
    pdb_path: str = ""
    confidence: float = 0.0          # mean pLDDT
    per_residue_plddt: list[float] = None  # type: ignore[assignment]
    ddg: float = 0.0
    reranker_score: float | None = None
    passed_gate1: bool = False
    passed_gate2: bool = False
    metadata: dict[str, Any] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.per_residue_plddt is None:
            self.per_residue_plddt = []
        if self.metadata is None:
            self.metadata = {}


class V1Policy:
    """Rule-based orchestration policy for V1.

    Gates:
      - Gate 1: pLDDT ≥ plddt_threshold → candidate advances to stability scoring
      - Gate 2: ΔΔG ≤ ddg_threshold → candidate advances to reranker / top-k selection
    """

    def __init__(self, plddt_threshold: float = 70.0, ddg_threshold: float = 2.0) -> None:
        self.plddt_threshold = plddt_threshold
        self.ddg_threshold = ddg_threshold

    def apply_gate1(self, candidates: list[Candidate]) -> list[Candidate]:
        """Filter candidates by pLDDT threshold (Gate 1).

        Args:
            candidates: All candidates after structure prediction.

        Returns:
            Candidates with ``confidence ≥ plddt_threshold``.
        """
        passed = [c for c in candidates if c.confidence >= self.plddt_threshold]
        for c in passed:
            c.passed_gate1 = True
        rejected = len(candidates) - len(passed)
        logger.info(
            "Gate 1 (pLDDT ≥ %.1f): %d passed, %d rejected.",
            self.plddt_threshold,
            len(passed),
            rejected,
        )
        return passed

    def apply_gate2(self, candidates: list[Candidate]) -> list[Candidate]:
        """Filter candidates by ΔΔG threshold (Gate 2).

        Args:
            candidates: Candidates that passed Gate 1, with ΔΔG scores.

        Returns:
            Candidates with ``ddg ≤ ddg_threshold``.
        """
        passed = [c for c in candidates if c.ddg <= self.ddg_threshold]
        for c in passed:
            c.passed_gate2 = True
        rejected = len(candidates) - len(passed)
        logger.info(
            "Gate 2 (ΔΔG ≤ %.1f): %d passed, %d rejected.",
            self.ddg_threshold,
            len(passed),
            rejected,
        )
        return passed

    def select_top_k(
        self,
        candidates: list[Candidate],
        k: int,
        use_reranker: bool = False,
    ) -> list[Candidate]:
        """Select the top-k candidates.

        If ``use_reranker`` is True and reranker scores are available, rank by
        reranker score descending; otherwise rank by pLDDT descending.

        Args:
            candidates: Candidates that passed both gates.
            k: Number of candidates to return.
            use_reranker: Whether to use the reranker score for ranking.

        Returns:
            Top-k candidates sorted by their primary ranking signal.
        """
        if use_reranker and any(c.reranker_score is not None for c in candidates):
            ranked = sorted(
                candidates,
                key=lambda c: c.reranker_score if c.reranker_score is not None else -1.0,
                reverse=True,
            )
        else:
            ranked = sorted(candidates, key=lambda c: c.confidence, reverse=True)
        top = ranked[:k]
        logger.info("Selected top-%d from %d candidates.", len(top), len(candidates))
        return top
