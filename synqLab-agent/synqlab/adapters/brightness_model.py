"""BrightnessModelAdapter — task-specific GFP11 brightness predictor.

The adapter loads a pickled model dict produced by
``scripts/train_brightness_model.py`` and serves two outputs for any GFP11
candidate sequence:

  * ``p_hit``                — calibrated P(brightness ≥ τ) ∈ [0, 1]
  * ``predicted_brightness`` — regression estimate of the continuous label
  * ``model_version``        — version string from the saved model dict

The pickle envelope is::

    {
        "regressor":      <sklearn estimator with .predict>,
        "classifier":     <sklearn estimator with .predict_proba>,
        "feature_mode":   "embedding" | "one_hot" | "hybrid",
        "tau":            float,
        "target_length":  int,                # for one_hot padding/truncation
        "embedder_id":    str | None,         # ESM-2 model id for embedding mode
        "model_version":  str,
        "metadata":       dict,               # optional training notes
    }

Mock mode (``mock_mode=True``) bypasses model loading and returns the
deterministic stub described in the GFP11 plan, so unit tests and
laptop dry-runs work with no model file on disk and no ESM-2 weights.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any, Optional

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_PATH = Path("data/models/brightness/model.pkl")
_AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"  # canonical 20-letter alphabet
_AA_TO_INDEX: dict[str, int] = {aa: i for i, aa in enumerate(_AMINO_ACIDS)}
_DEFAULT_TARGET_LENGTH = 16  # GFP11 candidate length


class BrightnessModelAdapter(BaseAdapter):
    """Adapter for the GFP11 brightness model (regression + Platt-scaled classifier).

    Args:
        model_path: Path to the pickled model dict.
        mock_mode: When True, skip model loading and return the deterministic
            stub from the GFP11 plan (``p_hit = 0.5 + (0.01 * len(seq)) % 0.5``).
        embedder: Optional callable ``(sequence: str) -> Sequence[float]`` used
            in ``feature_mode="embedding"`` mode. When None, the adapter lazy-
            loads ESM-2 via ``transformers``. Tests should pass a stub here so
            no network/torch download is required.
    """

    def __init__(
        self,
        model_path: str = str(_DEFAULT_MODEL_PATH),
        mock_mode: bool = False,
        embedder: Optional[Any] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._model_path = Path(model_path)
        # If path points to a directory, look for model.pkl inside it
        if self._model_path.is_dir():
            self._model_path = self._model_path / "model.pkl"
        self._mock_mode = bool(mock_mode)
        self._model: Optional[dict[str, Any]] = None
        self._embedder = embedder
        self._lazy_embedder_loaded = embedder is not None

    # ------------------------------------------------------------------
    # Mock-mode stub
    # ------------------------------------------------------------------

    @staticmethod
    def _mock_outputs(sequence: str) -> dict[str, Any]:
        """Deterministic stub matching the formula in the GFP11 plan.

        ``p_hit = 0.5 + (0.01 * len(seq)) % 0.5`` (parsed per Python
        operator precedence, where ``%`` binds tighter than ``+``).
        """
        n = len(sequence)
        p_hit = 0.5 + (0.01 * n) % 0.5
        predicted_brightness = 0.1 * n
        return {
            "p_hit": float(p_hit),
            "predicted_brightness": float(predicted_brightness),
            "model_version": "mock_v1",
        }

    # ------------------------------------------------------------------
    # Real-mode model loading & feature extraction
    # ------------------------------------------------------------------

    def _load_model(self) -> None:
        if self._model is not None:
            return
        if not self._model_path.exists():
            raise AdapterError(
                f"Brightness model not found at {self._model_path}. "
                "Train one first with: "
                "python scripts/train_brightness_model.py --feature-mode embedding"
            )
        try:
            with open(self._model_path, "rb") as fh:
                payload = pickle.load(fh)
        except Exception as exc:
            raise AdapterError(
                f"Failed to load brightness model from {self._model_path}: {exc}"
            ) from exc

        if not isinstance(payload, dict) or "regressor" not in payload or "classifier" not in payload:
            raise AdapterError(
                "Brightness model pickle must contain a dict with 'regressor' "
                f"and 'classifier' keys. Got: {type(payload).__name__}."
            )
        self._model = payload
        logger.info(
            "Loaded brightness model from %s (version=%s, feature_mode=%s).",
            self._model_path,
            payload.get("model_version", "?"),
            payload.get("feature_mode", "?"),
        )

    def _one_hot(self, sequence: str, target_length: int) -> list[float]:
        """Return a ``target_length * 20`` flattened one-hot vector.

        Pads with zeros if shorter; truncates if longer; unknown residues
        contribute an all-zero column.
        """
        seq = sequence.upper()[:target_length].ljust(target_length, "X")
        vec = [0.0] * (target_length * len(_AMINO_ACIDS))
        for i, aa in enumerate(seq):
            j = _AA_TO_INDEX.get(aa)
            if j is not None:
                vec[i * len(_AMINO_ACIDS) + j] = 1.0
        return vec

    def _embed(self, sequence: str, embedder_id: Optional[str]) -> list[float]:
        """Return an ESM-2 mean-pool embedding for *sequence*.

        If ``self._embedder`` was injected (tests, fast paths), defer to it.
        Otherwise lazy-load Hugging Face ``transformers`` + ESM-2.
        """
        if self._embedder is not None:
            return [float(x) for x in self._embedder(sequence)]

        if not self._lazy_embedder_loaded:
            try:
                import torch  # type: ignore[import]
                from transformers import AutoModel, AutoTokenizer  # type: ignore[import]
            except ImportError as exc:
                raise AdapterError(
                    "Embedding feature_mode requires `torch` and `transformers`. "
                    "Install via `pip install '.[ml]'` or pass embedder=<callable> "
                    "for testing."
                ) from exc

            model_id = embedder_id or "facebook/esm2_t33_650M_UR50D"
            logger.info("Loading ESM-2 tokenizer/model: %s", model_id)
            self._tokenizer = AutoTokenizer.from_pretrained(model_id)
            self._hf_model = AutoModel.from_pretrained(model_id).eval()
            self._torch = torch

            def _embed_fn(seq: str) -> list[float]:
                with torch.no_grad():
                    toks = self._tokenizer(seq, return_tensors="pt")
                    out = self._hf_model(**toks).last_hidden_state
                    pooled = out.mean(dim=1).squeeze(0)
                    return pooled.tolist()

            self._embedder = _embed_fn
            self._lazy_embedder_loaded = True

        return [float(x) for x in self._embedder(sequence)]  # type: ignore[misc]

    def _extract_features(
        self,
        sequence: str,
        tool_scores: dict[str, float],
        model: dict[str, Any],
    ) -> list[float]:
        feature_mode: str = model.get("feature_mode", "one_hot")
        target_length: int = int(model.get("target_length", _DEFAULT_TARGET_LENGTH))
        embedder_id: Optional[str] = model.get("embedder_id")

        if feature_mode == "one_hot":
            return self._one_hot(sequence, target_length)
        if feature_mode == "embedding":
            return self._embed(sequence, embedder_id)
        if feature_mode == "hybrid":
            base = self._embed(sequence, embedder_id)
            extras = [
                float(tool_scores.get("plddt", 0.0)),
                float(tool_scores.get("ddg", 0.0)),
                float(tool_scores.get("interaction", 0.0)),
            ]
            return list(base) + extras
        raise AdapterError(
            f"Unsupported feature_mode '{feature_mode}' in brightness model."
        )

    # ------------------------------------------------------------------
    # BaseAdapter API
    # ------------------------------------------------------------------

    def run(self, request: ToolRequest) -> ToolOutput:
        sequence = request.inputs.get("sequence")
        if not isinstance(sequence, str) or not sequence:
            raise AdapterError(
                "BrightnessModelAdapter requires a non-empty 'sequence' input."
            )
        tool_scores = dict(request.inputs.get("tool_scores", {}) or {})

        if self._mock_mode:
            outputs = self._mock_outputs(sequence)
            return ToolOutput(
                tool_id=request.tool_id, outputs=outputs, success=True,
                metadata={"mock_mode": True},
            )

        self._load_model()
        assert self._model is not None  # for the type-checker

        features = self._extract_features(sequence, tool_scores, self._model)

        try:
            import numpy as np  # type: ignore[import]
        except ImportError as exc:
            raise AdapterError(
                "BrightnessModelAdapter requires numpy in real mode."
            ) from exc

        x = np.asarray(features, dtype=float).reshape(1, -1)

        regressor = self._model["regressor"]
        classifier = self._model["classifier"]

        try:
            predicted_brightness = float(regressor.predict(x)[0])
        except Exception as exc:
            raise AdapterError(f"Brightness regressor failed: {exc}") from exc

        try:
            proba = classifier.predict_proba(x)
            p_hit = float(proba[0, 1]) if proba.ndim == 2 and proba.shape[1] >= 2 else float(proba[0])
        except Exception as exc:
            raise AdapterError(f"Brightness classifier failed: {exc}") from exc

        p_hit = max(0.0, min(1.0, p_hit))
        outputs: dict[str, Any] = {
            "p_hit": round(float(p_hit), 4),
            "predicted_brightness": round(float(predicted_brightness), 4),
            "model_version": str(self._model.get("model_version", "v_unknown")),
        }
        return ToolOutput(tool_id=request.tool_id, outputs=outputs, success=True)

    def capabilities(self) -> list[str]:
        return ["brightness_prediction", "hit_probability_estimation"]
