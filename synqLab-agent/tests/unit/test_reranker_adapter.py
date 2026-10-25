"""Unit tests for RerankerAdapter — uses a tiny pickled sklearn fixture."""

from __future__ import annotations

import pickle
from pathlib import Path

import pytest

from synqlab.adapters.reranker import RerankerAdapter
from synqlab.core.schemas import ToolRequest


def _req(feature_vector: dict | None = None) -> ToolRequest:
    return ToolRequest(
        tool_id="reranker",
        inputs={"feature_vector": feature_vector or {"plddt": 80.0, "ddg": -1.0}},
        experiment_id="exp-1",
        round_id="r1",
    )


@pytest.fixture
def tiny_model_path(tmp_path: Path) -> Path:
    """Write a tiny sklearn logistic regression to disk and return its path."""
    from sklearn.linear_model import LogisticRegression  # type: ignore[import]
    import numpy as np

    X = np.array([[80, -1], [60, 2], [90, -2], [50, 3]])
    y = np.array([1, 0, 1, 0])
    model = LogisticRegression()
    model.fit(X, y)
    model._synqlab_version = "test_v1"

    model_path = tmp_path / "model.pkl"
    with open(model_path, "wb") as fh:
        pickle.dump(model, fh)
    return model_path


def test_no_model_returns_skipped(tmp_path: Path) -> None:
    adapter = RerankerAdapter(model_path=str(tmp_path / "nonexistent.pkl"))
    result = adapter.run(_req())
    assert result.outputs.get("skipped") is True
    assert result.outputs.get("score") is None
    assert result.success is True


def test_real_mode_with_model(tiny_model_path: Path) -> None:
    adapter = RerankerAdapter(model_path=str(tiny_model_path))
    result = adapter.run(_req({"plddt": 85.0, "ddg": -1.5}))
    assert result.success is True
    score = result.outputs["score"]
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0


def test_model_version_in_output(tiny_model_path: Path) -> None:
    adapter = RerankerAdapter(model_path=str(tiny_model_path))
    result = adapter.run(_req())
    assert result.outputs.get("model_version") == "test_v1"


def test_score_varies_with_features(tiny_model_path: Path) -> None:
    """High-pLDDT / low-ΔΔG should score differently from poor candidates."""
    adapter = RerankerAdapter(model_path=str(tiny_model_path))
    good = adapter.run(_req({"plddt": 90.0, "ddg": -2.0})).outputs["score"]
    bad = adapter.run(_req({"plddt": 50.0, "ddg": 3.0})).outputs["score"]
    assert good != bad
