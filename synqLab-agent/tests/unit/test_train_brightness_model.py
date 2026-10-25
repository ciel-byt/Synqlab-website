"""Unit tests for scripts/train_brightness_model.py.

Exercises the building blocks of the brightness-model training pipeline
without ESM-2 or network access:

  * load_training_records  → reads the brightness_mini.csv fixture via a
                             Knowledge-Store dataset artifact pointer.
  * compute_features       → tested for one_hot AND embedding (with an
                             injected stub embedder) modes.
  * evaluate_cv            → asserts metric keys + sane ranges.
  * train_final_model +
    save_model_artifact    → round-trip check that BrightnessModelAdapter
                             can load the produced artifact.
  * register_finding       → asserts a `finding` lands in the KS with the
                             expected payload + provenance shape.

Tests run in tmp_path; no global state is touched.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Callable

import pytest

# The training script lives under scripts/ (no package) — load it as a module.
_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
_TRAIN_SPEC = importlib.util.spec_from_file_location(
    "train_brightness_model", _SCRIPTS_DIR / "train_brightness_model.py"
)
assert _TRAIN_SPEC and _TRAIN_SPEC.loader
train_module = importlib.util.module_from_spec(_TRAIN_SPEC)
sys.modules["train_brightness_model"] = train_module
_TRAIN_SPEC.loader.exec_module(train_module)


_FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
_BRIGHTNESS_MINI = _FIXTURES_DIR / "brightness_mini.csv"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _make_records(n: int = 30, seed: int = 0) -> list:
    """Return synthetic LabeledRecords with ground-truth structure."""
    import numpy as np

    rng = np.random.default_rng(seed)
    aa = "ACDEFGHIKLMNPQRSTVWY"
    records = []
    for i in range(n):
        seq = "".join(rng.choice(list(aa), size=16))
        # Brightness modestly correlated with G+S count so the model has signal.
        score = sum(1 for c in seq if c in "GS") / 16.0
        noise = float(rng.normal(0, 0.05))
        records.append(
            train_module.LabeledRecord(
                sequence=seq,
                brightness=float(score + noise),
                source_artifact_id=f"art-{i % 3}",
            )
        )
    return records


def _ks_with_dataset(tmp_path: Path) -> tuple:
    """Build a KnowledgeStore in tmp_path with a dataset artifact pointing at
    the brightness_mini.csv fixture, plus a target artifact carrying τ.
    """
    from synqlab.knowledge_store.store import KnowledgeStore

    db_path = tmp_path / "store.json"
    ks = KnowledgeStore(db_path=str(db_path))
    dataset_id = ks.register(
        kind="dataset",
        name="brightness mini fixture",
        scope="project:gfp11-test",
        task_type="gfp11_brightness",
        payload={
            "format": "csv",
            "path": str(_BRIGHTNESS_MINI),
            "columns": {"sequence": "sequence", "label": "brightness"},
            "n_total": 10,
        },
        tags=["fluorescence", "brightness", "gfp11-test"],
    )
    target_id = ks.register(
        kind="target",
        name="GFP11 design target (test)",
        scope="project:gfp11-test",
        task_type="gfp11_brightness",
        payload={
            "molecule": "GFP11",
            "partner": "GFP1-10",
            "partner_sequence": "MKLAA",
            "hit_threshold_field": "brightness",
            "hit_threshold_value": 1.0,
        },
        tags=["target", "gfp11-test"],
    )
    return ks, dataset_id, target_id


def _stub_embedder(dim: int = 16) -> Callable[[str], list[float]]:
    """Deterministic 'embedder' so embedding-mode tests don't need transformers."""
    import numpy as np

    def _embed(seq: str) -> list[float]:
        rng = np.random.default_rng(abs(hash(seq)) % (2**32))
        return rng.normal(size=dim).tolist()

    return _embed


# ----------------------------------------------------------------------
# load_training_records
# ----------------------------------------------------------------------


def test_load_training_records_pulls_dataset_from_ks(tmp_path: Path) -> None:
    ks, dataset_id, _target_id = _ks_with_dataset(tmp_path)
    records, source_ids = train_module.load_training_records(
        ks, "gfp11_brightness", "gfp11-test", extra_dataset_paths=[],
    )
    assert len(records) == 10
    assert dataset_id in source_ids
    for r in records:
        assert isinstance(r.sequence, str) and r.sequence
        assert isinstance(r.brightness, float)
        assert r.source_artifact_id == dataset_id


def test_load_training_records_includes_extra_paths(tmp_path: Path) -> None:
    ks, _dataset_id, _target_id = _ks_with_dataset(tmp_path)
    records, _ = train_module.load_training_records(
        ks, "gfp11_brightness", "gfp11-test",
        extra_dataset_paths=[_BRIGHTNESS_MINI],
    )
    # 10 from KS + 10 from extra path
    assert len(records) == 20


def test_resolve_tau_prefers_cli_override(tmp_path: Path) -> None:
    ks, _, _ = _ks_with_dataset(tmp_path)
    tau = train_module.resolve_tau(ks, "gfp11_brightness", "gfp11-test", 0.42, [])
    assert tau == 0.42


def test_resolve_tau_falls_back_to_target_artifact(tmp_path: Path) -> None:
    ks, _, _ = _ks_with_dataset(tmp_path)
    tau = train_module.resolve_tau(ks, "gfp11_brightness", "gfp11-test", None, [])
    assert tau == 1.0


# ----------------------------------------------------------------------
# compute_features
# ----------------------------------------------------------------------


def test_compute_features_one_hot_shape() -> None:
    records = _make_records(n=8)
    X, y = train_module.compute_features(records, "one_hot", target_length=16)
    assert X.shape == (8, 16 * 20)
    assert y.shape == (8,)
    # one_hot rows should be binary {0, 1}
    assert ((X == 0) | (X == 1)).all()


def test_compute_features_embedding_uses_injected_embedder() -> None:
    records = _make_records(n=8)
    embedder = _stub_embedder(dim=12)
    X, y = train_module.compute_features(records, "embedding", embedder=embedder)
    assert X.shape == (8, 12)
    assert y.shape == (8,)


def test_compute_features_hybrid_appends_extras() -> None:
    records = _make_records(n=4)
    for r in records:
        r.extras["plddt"] = 75.0
        r.extras["ddg"] = -1.0
        r.extras["iptm"] = 0.6
    embedder = _stub_embedder(dim=8)
    X, _ = train_module.compute_features(records, "hybrid", embedder=embedder)
    assert X.shape == (4, 8 + 3)


def test_compute_features_unknown_mode_raises() -> None:
    with pytest.raises(ValueError, match="feature_mode"):
        train_module.compute_features(_make_records(2), "bogus")


def test_compute_features_empty_records_raises() -> None:
    with pytest.raises(ValueError, match="no records"):
        train_module.compute_features([], "one_hot")


# ----------------------------------------------------------------------
# evaluate_cv
# ----------------------------------------------------------------------


def test_evaluate_cv_returns_expected_metric_keys() -> None:
    records = _make_records(n=30)
    X, y = train_module.compute_features(records, "one_hot", target_length=16)
    tau = float(y.mean())
    metrics = train_module.evaluate_cv(X, y, tau, k_folds=3)
    assert metrics["n_samples"] == 30
    assert metrics["k_folds"] == 3
    assert "spearman_rho_mean" in metrics
    assert "auc_mean" in metrics
    assert 0.0 <= metrics["auc_mean"] <= 1.0
    assert 0.0 <= metrics["brier_mean"] <= 1.0
    assert isinstance(metrics["calibration_curve"], list) and metrics["calibration_curve"]


def test_evaluate_cv_handles_small_dataset() -> None:
    """5-row dataset shouldn't blow up — folds are clamped to n_samples."""
    records = _make_records(n=5)
    X, y = train_module.compute_features(records, "one_hot", target_length=16)
    tau = float(y.mean())
    metrics = train_module.evaluate_cv(X, y, tau, k_folds=10)
    assert metrics["k_folds"] <= 5


# ----------------------------------------------------------------------
# train_final_model + save_model_artifact + adapter round-trip
# ----------------------------------------------------------------------


def test_train_save_and_adapter_round_trip(tmp_path: Path) -> None:
    from synqlab.adapters.brightness_model import BrightnessModelAdapter
    from synqlab.core.schemas import ToolRequest

    records = _make_records(n=40)
    X, y = train_module.compute_features(records, "one_hot", target_length=16)
    tau = float(y.mean())
    envelope = train_module.train_final_model(
        X, y, tau, "one_hot", target_length=16, embedder_id=None,
        model_version="v1",
        metadata={"n_train": len(y), "synthetic": True},
    )
    output_dir = tmp_path / "brightness"
    saved = train_module.save_model_artifact(envelope, output_dir)

    assert saved.exists()
    assert (output_dir / "model.pkl").exists()  # symlink or hard copy

    adapter = BrightnessModelAdapter(model_path=str(output_dir / "model.pkl"))
    out = adapter.run(
        ToolRequest(
            tool_id="brightness_model",
            inputs={"sequence": "ACDEFGHIKLMNPQRS"},
            experiment_id="exp", round_id="r1",
        )
    )
    assert out.success is True
    assert out.outputs["model_version"] == "v1"
    assert 0.0 <= out.outputs["p_hit"] <= 1.0


def test_next_model_version_increments(tmp_path: Path) -> None:
    output_dir = tmp_path / "brightness"
    output_dir.mkdir()
    (output_dir / "model_v1.pkl").write_bytes(b"")
    (output_dir / "model_v3.pkl").write_bytes(b"")
    assert train_module._next_model_version(output_dir) == "v4"
    assert train_module._next_model_version(tmp_path / "fresh") == "v1"


# ----------------------------------------------------------------------
# register_finding
# ----------------------------------------------------------------------


def test_register_finding_records_provenance(tmp_path: Path) -> None:
    from synqlab.knowledge_store.store import KnowledgeStore

    ks = KnowledgeStore(db_path=str(tmp_path / "store.json"))
    envelope = {"model_version": "v7", "feature_mode": "one_hot", "tau": 0.5}
    metrics = {"auc_mean": 0.81, "spearman_rho_mean": 0.42}
    finding_id = train_module.register_finding(
        ks, metrics, envelope, tmp_path / "model_v7.pkl",
        source_artifact_ids=["src-1", "src-2"],
        project_id="gfp11-test",
        task_type="gfp11_brightness",
    )
    artifact = ks.get(finding_id)
    assert artifact is not None
    assert artifact.kind == "finding"
    assert artifact.payload["model_version"] == "v7"
    assert artifact.payload["metrics"] == metrics
    assert artifact.provenance["source_artifact_ids"] == ["src-1", "src-2"]
    assert "registered_by" in artifact.provenance
