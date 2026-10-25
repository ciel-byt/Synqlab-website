"""RerankerAdapter — lightweight supervised reranker for candidate scoring."""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_PATH = Path("data/models/reranker/model.pkl")


class RerankerAdapter(BaseAdapter):
    """Adapter for the reranker model (P(hit) from tool-score features).

    Loads a pickled sklearn model and returns a calibrated probability.
    If no model artifact exists at the configured path, returns
    ``{"score": None, "model_version": "none", "skipped": True}`` — not an error.

    Train the model first: python scripts/train_reranker.py
    """

    def __init__(
        self,
        model_path: str = str(_DEFAULT_MODEL_PATH),
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._model_path = Path(model_path)
        self._model: Any = None

    def _load_model(self) -> bool:
        """Attempt to load model from disk. Returns True if successful."""
        if not self._model_path.exists():
            logger.info(
                "Reranker model not found at %s — skipping reranker.", self._model_path
            )
            return False
        try:
            with open(self._model_path, "rb") as fh:
                self._model = pickle.load(fh)
            logger.info("Reranker model loaded from %s.", self._model_path)
            return True
        except Exception as exc:
            raise AdapterError(f"Failed to load reranker model: {exc}") from exc

    def run(self, request: ToolRequest) -> ToolOutput:
        if self._model is None:
            loaded = self._load_model()
            if not loaded:
                return ToolOutput(
                    tool_id=request.tool_id,
                    outputs={"score": None, "model_version": "none", "skipped": True},
                    success=True,
                    metadata={"skipped": True},
                )

        feature_vector: dict[str, float] = request.inputs.get("feature_vector", {})
        try:
            import numpy as np  # type: ignore[import]

            features = np.array([[
                feature_vector.get("plddt", 0.0),
                feature_vector.get("ddg", 0.0),
            ]])
            score = float(self._model.predict_proba(features)[0, 1])
        except Exception as exc:
            raise AdapterError(f"Reranker inference failed: {exc}") from exc

        model_version = getattr(self._model, "_synqlab_version", "v_unknown")
        return ToolOutput(
            tool_id=request.tool_id,
            outputs={"score": score, "model_version": model_version},
            success=True,
        )

    def capabilities(self) -> list[str]:
        return ["candidate_ranking", "calibrated_scoring"]
