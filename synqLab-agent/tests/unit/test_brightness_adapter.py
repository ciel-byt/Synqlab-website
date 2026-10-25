"""Unit tests for BrightnessModelAdapter.

Covers both modes the GFP11 plan calls for:

  * Mock mode  — deterministic formula, no model file, no network.
  * Real mode  — tiny pickled (sklearn regressor + Platt-scaled classifier)
                 fixture trained on synthetic rows, feature_mode="one_hot".

The real-mode fixture uses ``feature_mode="one_hot"`` so neither torch nor
transformers are required.
"""

from __future__ import annotations

import pickle
from pathlib import Path

import pytest

from synqlab.adapters.brightness_model import BrightnessModelAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(sequence: str, tool_scores: dict | None = None) -> ToolRequest:
    return ToolRequest(
        tool_id="brightness_model",
        inputs={"sequence": sequence, "tool_scores": tool_scores or {}},
        experiment_id="exp-1",
        round_id="r1",
    )


# ----------------------------------------------------------------------
# Mock mode
# ----------------------------------------------------------------------


def test_mock_mode_matches_plan_formula() -> None:
    """p_hit = 0.5 + (0.01 * len(seq)) % 0.5  (Python operator precedence)."""
    adapter = BrightnessModelAdapter(mock_mode=True)
    seq = "M" * 16  # canonical GFP11 length
    out = adapter.run(_req(seq))
    assert out.success is True
    assert out.outputs["model_version"] == "mock_v1"
    expected = 0.5 + (0.01 * 16) % 0.5
    assert out.outputs["p_hit"] == pytest.approx(expected)
    assert out.outputs["predicted_brightness"] == pytest.approx(0.1 * 16)


def test_mock_mode_is_deterministic() -> None:
    adapter = BrightnessModelAdapter(mock_mode=True)
    a = adapter.run(_req("ACDEFGHIKLMNPQRS")).outputs
    b = adapter.run(_req("ACDEFGHIKLMNPQRS")).outputs
    assert a == b


def test_mock_mode_p_hit_in_unit_interval() -> None:
    adapter = BrightnessModelAdapter(mock_mode=True)
    for length in (1, 8, 16, 32, 100):
        out = adapter.run(_req("A" * length))
        assert 0.0 <= out.outputs["p_hit"] <= 1.0


def test_mock_mode_metadata_flag() -> None:
    adapter = BrightnessModelAdapter(mock_mode=True)
    out = adapter.run(_req("ACDEFGHIKLMNPQRS"))
    assert out.metadata.get("mock_mode") is True


def test_missing_sequence_raises() -> None:
    adapter = BrightnessModelAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="sequence"):
        adapter.run(
            ToolRequest(
                tool_id="brightness_model",
                inputs={},
                experiment_id="exp-1",
                round_id="r1",
            )
        )


def test_empty_sequence_raises() -> None:
    adapter = BrightnessModelAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="sequence"):
        adapter.run(_req(""))


# ----------------------------------------------------------------------
# Real mode (tiny pickled fixture, feature_mode="one_hot")
# ----------------------------------------------------------------------

# Fixed sequence length used for training AND inference in tests
_SEQ_LEN = 16


@pytest.fixture
def tiny_brightness_model(tmp_path: Path) -> Path:
    """Train a minuscule one-hot model on synthetic 16-mers and pickle it.

    The model is trained with the SAME one-hot encoding the adapter uses:
    len(sequence) * 20 features (no padding/truncation).
    """
    import numpy as np
    from sklearn.calibration import CalibratedClassifierCV  # type: ignore[import]
    from sklearn.linear_model import LogisticRegression, Ridge  # type: ignore[import]

    aa = "ACDEFGHIKLMNPQRSTVWY"

    def one_hot(seq: str) -> list[float]:
        """Match the adapter's _compute_features encoding exactly."""
        vec = [0.0] * (len(seq) * len(aa))
        for i, a in enumerate(seq):
            j = aa.find(a)
            if j >= 0:
                vec[i * len(aa) + j] = 1.0
        return vec

    rng = np.random.default_rng(42)
    sequences = [
        "".join(rng.choice(list(aa)) for _ in range(_SEQ_LEN))
        for _ in range(40)
    ]
    X = np.array([one_hot(s) for s in sequences])
    brightness = rng.uniform(0.0, 1.0, size=len(sequences))
    tau = 0.5
    y_class = (brightness >= tau).astype(int)

    regressor = Ridge(alpha=1.0).fit(X, brightness)
    base_clf = LogisticRegression(max_iter=500)
    classifier = CalibratedClassifierCV(base_clf, method="sigmoid", cv=3)
    classifier.fit(X, y_class)

    payload = {
        "regressor": regressor,
        "classifier": classifier,
        "feature_mode": "one_hot",
        "tau": tau,
        "target_length": _SEQ_LEN,
        "embedder_id": None,
        "model_version": "test_v1",
        "metadata": {"n_train": len(sequences), "synthetic": True},
    }
    path = tmp_path / "brightness_model.pkl"
    with open(path, "wb") as fh:
        pickle.dump(payload, fh)
    return path


def test_real_mode_loads_and_predicts(tiny_brightness_model: Path) -> None:
    adapter = BrightnessModelAdapter(model_path=str(tiny_brightness_model))
    # Use exactly _SEQ_LEN chars to match training feature dimension
    out = adapter.run(_req("ACDEFGHIKLMNPQRS"))
    assert out.success is True
    assert set(out.outputs) >= {"p_hit", "predicted_brightness", "model_version"}
    assert isinstance(out.outputs["p_hit"], float)
    assert isinstance(out.outputs["predicted_brightness"], float)
    assert 0.0 <= out.outputs["p_hit"] <= 1.0
    assert out.outputs["model_version"] == "test_v1"


def test_missing_model_file_raises(tmp_path: Path) -> None:
    adapter = BrightnessModelAdapter(model_path=str(tmp_path / "nope.pkl"))
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req("ACDEFGHIKLMNPQRS"))


def test_corrupt_pickle_raises_clearly(tmp_path: Path) -> None:
    bad = tmp_path / "bad.pkl"
    bad.write_bytes(b"this is not a pickle")
    adapter = BrightnessModelAdapter(model_path=str(bad))
    with pytest.raises(AdapterError, match="Failed to load"):
        adapter.run(_req("ACDEFGHIKLMNPQRS"))


def test_wrong_shape_model_raises(tmp_path: Path) -> None:
    bad = tmp_path / "wrong_shape.pkl"
    with open(bad, "wb") as fh:
        pickle.dump({"not": "a model"}, fh)
    adapter = BrightnessModelAdapter(model_path=str(bad))
    # The model dict lacks "classifier" key, so predict_proba fails
    with pytest.raises(AdapterError):
        adapter.run(_req("ACDEFGHIKLMNPQRS"))


# ----------------------------------------------------------------------
# Embedding feature_mode with injected stub embedder (no torch needed)
# ----------------------------------------------------------------------


def test_embedding_mode_uses_injected_embedder(tmp_path: Path) -> None:
    """When `embedder` is injected, the adapter should NOT touch transformers."""
    import numpy as np
    from sklearn.calibration import CalibratedClassifierCV  # type: ignore[import]
    from sklearn.linear_model import LogisticRegression, Ridge  # type: ignore[import]

    embedding_dim = 8

    def fake_embedder(seq: str) -> Any:
        """Return features in the shape the adapter expects from _compute_features."""
        rng = np.random.default_rng(abs(hash(seq)) % (2**32))
        return rng.normal(size=embedding_dim)

    rng = np.random.default_rng(0)
    seqs = ["".join(rng.choice(list("ACDEFGH"), size=16)) for _ in range(30)]
    X = np.array([fake_embedder(s).flatten() for s in seqs])
    y = rng.uniform(0.0, 1.0, size=len(seqs))
    regressor = Ridge().fit(X, y)
    classifier = CalibratedClassifierCV(LogisticRegression(max_iter=500), cv=3).fit(
        X, (y >= 0.5).astype(int)
    )
    payload = {
        "regressor": regressor,
        "classifier": classifier,
        "feature_mode": "embedding",
        "tau": 0.5,
        "target_length": 16,
        "embedder_id": None,
        "model_version": "embed_test_v1",
    }
    path = tmp_path / "embed.pkl"
    with open(path, "wb") as fh:
        pickle.dump(payload, fh)

    adapter = BrightnessModelAdapter(
        model_path=str(path),
        feature_mode="embedding",
        embedder=fake_embedder,
    )
    out = adapter.run(_req("ACDEFGHIKLMNPQRS"))
    assert out.success is True
    assert 0.0 <= out.outputs["p_hit"] <= 1.0
    assert out.outputs["model_version"] == "embed_test_v1"


from typing import Any  # noqa: E402 — needed for fake_embedder return type
