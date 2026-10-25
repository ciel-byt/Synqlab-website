#!/usr/bin/env python3
"""Train the GFP11 brightness model from the Knowledge Store.

The script:
  1. Pulls labeled rows from the Knowledge Store (kind=dataset, finding;
     task_type=gfp11_brightness) and any explicit --dataset-path overrides.
  2. Computes features per --feature-mode  (embedding | one_hot | hybrid).
  3. Trains a Ridge regressor (continuous brightness) and a Platt-scaled
     logistic-regression classifier (P(brightness ≥ τ)) under K-fold CV.
  4. Saves the model envelope as data/models/brightness/model_v{N}.pkl and
     refreshes data/models/brightness/model.pkl to point at the latest version.
  5. Registers a `finding` artifact in the Knowledge Store with the CV
     metrics (Spearman ρ, AUC, Brier) and provenance pointing at every
     source artifact ID consumed.

Usage:
    python scripts/train_brightness_model.py
    python scripts/train_brightness_model.py --feature-mode embedding
    python scripts/train_brightness_model.py --dataset-path datasets/extras.csv

The script is factored so its building blocks (load_training_records,
compute_features, train_model, evaluate_cv) can be unit-tested in isolation
without disk I/O or ESM-2 weights — see tests/unit/test_train_brightness_model.py.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import pickle
import statistics
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_TASK_TYPE = "gfp11_brightness"
DEFAULT_PROJECT_ID = "gfp11-v1"
DEFAULT_OUTPUT_DIR = Path("data") / "models" / "brightness"
DEFAULT_TARGET_LENGTH = 16
DEFAULT_KFOLDS = 5
DEFAULT_EMBEDDER_ID = "facebook/esm2_t33_650M_UR50D"
_AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"
_AA_TO_INDEX = {aa: i for i, aa in enumerate(_AMINO_ACIDS)}

# Column-name fallbacks tried in order when an artifact's `payload.columns`
# does not pin them down explicitly.
_SEQ_COLUMN_CANDIDATES = ("sequence", "GFP11_sequence", "Amino Acid Sequence")
_LABEL_COLUMN_CANDIDATES = ("brightness", "Median Brightness", "label")


# ----------------------------------------------------------------------
# Data loading
# ----------------------------------------------------------------------


@dataclass
class LabeledRecord:
    """A single (sequence, brightness) row with provenance pointer."""

    sequence: str
    brightness: float
    source_artifact_id: Optional[str] = None
    extras: dict[str, Any] = field(default_factory=dict)


def _resolve_columns(
    columns_payload: dict[str, Any] | None,
    sequence_override: Optional[str],
    label_override: Optional[str],
    available: list[str],
) -> tuple[str, str]:
    """Pick the sequence and label column names to use for one dataset."""
    seq_col = sequence_override or (columns_payload or {}).get("sequence")
    if not seq_col:
        seq_col = next((c for c in _SEQ_COLUMN_CANDIDATES if c in available), None)
    label_col = label_override or (columns_payload or {}).get("label")
    if not label_col:
        label_col = next((c for c in _LABEL_COLUMN_CANDIDATES if c in available), None)
    if not seq_col or not label_col:
        raise ValueError(
            f"Could not resolve sequence/label columns. Available: {available}. "
            f"Tried sequence={_SEQ_COLUMN_CANDIDATES}, label={_LABEL_COLUMN_CANDIDATES}."
        )
    return seq_col, label_col


def _read_dataset_file(
    path: Path,
    sequence_column: Optional[str],
    label_column: Optional[str],
    columns_payload: dict[str, Any] | None,
    source_artifact_id: Optional[str],
) -> list[LabeledRecord]:
    import pandas as pd  # type: ignore[import]

    if not path.exists():
        logger.warning("Dataset file does not exist: %s — skipping.", path)
        return []
    if path.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path)
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
    else:
        logger.warning("Unsupported dataset suffix '%s' for %s — skipping.", path.suffix, path)
        return []

    seq_col, label_col = _resolve_columns(
        columns_payload, sequence_column, label_column, list(df.columns)
    )
    df = df[[seq_col, label_col]].dropna()
    records: list[LabeledRecord] = []
    for _, row in df.iterrows():
        seq = str(row[seq_col]).strip().upper()
        try:
            label = float(row[label_col])
        except (TypeError, ValueError):
            continue
        if not seq:
            continue
        records.append(
            LabeledRecord(
                sequence=seq,
                brightness=label,
                source_artifact_id=source_artifact_id,
                extras={"source_path": str(path), "columns": [seq_col, label_col]},
            )
        )
    logger.info("Loaded %d rows from %s (cols=%s/%s).", len(records), path, seq_col, label_col)
    return records


def load_training_records(
    ks: Any,
    task_type: str,
    project_id: str,
    extra_dataset_paths: list[Path] | None = None,
    sequence_column: Optional[str] = None,
    label_column: Optional[str] = None,
) -> tuple[list[LabeledRecord], list[str]]:
    """Pull labeled rows from the Knowledge Store + any extra CSV/XLSX paths.

    Returns (records, source_artifact_ids) where source_artifact_ids tracks
    every Knowledge Store artifact whose data ended up in the training set —
    used as provenance on the resulting `finding`.
    """
    artifact_ids: list[str] = []
    records: list[LabeledRecord] = []

    dataset_artifacts = ks.retrieve(
        task_type=task_type,
        project_id=project_id,
        kinds=["dataset"],
    )
    for art in dataset_artifacts:
        path_str = art.payload.get("path")
        if not path_str:
            logger.warning("Dataset artifact %s has no payload.path — skipping.", art.id)
            continue
        records.extend(_read_dataset_file(
            Path(path_str), sequence_column, label_column,
            columns_payload=art.payload.get("columns"),
            source_artifact_id=art.id,
        ))
        artifact_ids.append(art.id)

    finding_artifacts = ks.retrieve(
        task_type=task_type,
        project_id=project_id,
        kinds=["finding"],
    )
    for art in finding_artifacts:
        labels = art.payload.get("labeled_candidates") or []
        if not isinstance(labels, list):
            continue
        added = 0
        for entry in labels:
            seq = str(entry.get("sequence", "")).strip().upper()
            try:
                label = float(entry.get("brightness"))
            except (TypeError, ValueError):
                continue
            if not seq:
                continue
            records.append(LabeledRecord(
                sequence=seq, brightness=label,
                source_artifact_id=art.id,
                extras={"source_kind": "finding"},
            ))
            added += 1
        if added:
            logger.info("Loaded %d rows from finding %s.", added, art.id)
            artifact_ids.append(art.id)

    for path in extra_dataset_paths or []:
        records.extend(_read_dataset_file(
            path, sequence_column, label_column,
            columns_payload=None, source_artifact_id=None,
        ))

    return records, artifact_ids


def resolve_tau(
    ks: Any,
    task_type: str,
    project_id: str,
    cli_override: Optional[float],
    fallback_records: list[LabeledRecord],
) -> float:
    """Return the hit threshold τ. Order: CLI → target artifact → median."""
    if cli_override is not None:
        return float(cli_override)
    targets = ks.retrieve(task_type=task_type, project_id=project_id, kinds=["target"])
    for art in targets:
        val = art.payload.get("hit_threshold_value")
        if val is not None:
            return float(val)
    if fallback_records:
        return statistics.median(r.brightness for r in fallback_records)
    raise ValueError("No τ available: no CLI override, no target artifact, no records.")


# ----------------------------------------------------------------------
# Feature computation
# ----------------------------------------------------------------------


def _one_hot(sequence: str, target_length: int) -> list[float]:
    seq = sequence.upper()[:target_length].ljust(target_length, "X")
    vec = [0.0] * (target_length * len(_AMINO_ACIDS))
    for i, aa in enumerate(seq):
        j = _AA_TO_INDEX.get(aa)
        if j is not None:
            vec[i * len(_AMINO_ACIDS) + j] = 1.0
    return vec


def _build_real_embedder(model_id: str) -> Callable[[str], list[float]]:
    """Lazy factory for the real ESM-2 embedder (not invoked in unit tests)."""
    try:
        import torch  # type: ignore[import]
        from transformers import AutoModel, AutoTokenizer  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "Embedding feature_mode requires torch + transformers. "
            "Install with `pip install '.[ml]'` or pass --feature-mode one_hot."
        ) from exc

    logger.info("Loading ESM-2 tokenizer/model: %s", model_id)
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id).eval()

    def _embed(seq: str) -> list[float]:
        with torch.no_grad():
            toks = tokenizer(seq, return_tensors="pt")
            pooled = model(**toks).last_hidden_state.mean(dim=1).squeeze(0)
            return pooled.tolist()

    return _embed


def compute_features(
    records: list[LabeledRecord],
    feature_mode: str,
    target_length: int = DEFAULT_TARGET_LENGTH,
    embedder: Optional[Callable[[str], list[float]]] = None,
    embedder_id: str = DEFAULT_EMBEDDER_ID,
) -> tuple["Any", "Any"]:
    """Return (X, y) numpy arrays for the chosen feature_mode.

    The caller injects ``embedder`` for ``embedding`` / ``hybrid`` modes
    in tests so neither torch nor transformers are required.
    """
    import numpy as np  # type: ignore[import]

    if not records:
        raise ValueError("compute_features: no records to featurise.")

    if feature_mode == "one_hot":
        X = np.array([_one_hot(r.sequence, target_length) for r in records], dtype=float)
    elif feature_mode == "embedding":
        emb = embedder or _build_real_embedder(embedder_id)
        X = np.array([emb(r.sequence) for r in records], dtype=float)
    elif feature_mode == "hybrid":
        emb = embedder or _build_real_embedder(embedder_id)
        rows: list[list[float]] = []
        for r in records:
            base = emb(r.sequence)
            extras = [
                float(r.extras.get("plddt", 0.0)),
                float(r.extras.get("ddg", 0.0)),
                float(r.extras.get("iptm", 0.0)),
            ]
            rows.append(list(base) + extras)
        X = np.array(rows, dtype=float)
    else:
        raise ValueError(f"Unsupported feature_mode: {feature_mode!r}")

    y = np.array([r.brightness for r in records], dtype=float)
    return X, y


# ----------------------------------------------------------------------
# Training & cross-validation
# ----------------------------------------------------------------------


def _fit_calibrated_classifier(X: "Any", y_class: "Any", seed: int) -> Any:
    """Fit a Platt-scaled logistic regression, falling back gracefully when
    the per-class count is too small for CalibratedClassifierCV.

    CalibratedClassifierCV requires at least ``cv`` examples of each class.
    When the minority class has fewer than 2, return a plain (uncalibrated)
    LogisticRegression — its ``predict_proba`` is still well-formed but is
    just not Platt-scaled. We log a warning so this is observable in eval.
    """
    import numpy as np
    from sklearn.calibration import CalibratedClassifierCV  # type: ignore[import]
    from sklearn.linear_model import LogisticRegression  # type: ignore[import]

    base = LogisticRegression(max_iter=500, random_state=seed)
    min_count = int(np.bincount(y_class).min())
    if min_count < 2:
        logger.warning(
            "Minority class has only %d example(s); skipping Platt calibration "
            "(returning uncalibrated logistic regression).", min_count,
        )
        return base.fit(X, y_class)
    inner_cv = max(2, min(3, min_count))
    return CalibratedClassifierCV(base, method="sigmoid", cv=inner_cv).fit(X, y_class)


def evaluate_cv(
    X: "Any",
    y: "Any",
    tau: float,
    k_folds: int,
    seed: int = 42,
) -> dict[str, Any]:
    """Run K-fold CV; return Spearman ρ, AUC at τ, Brier, calibration bins."""
    import numpy as np
    from sklearn.linear_model import Ridge  # type: ignore[import]
    from sklearn.metrics import brier_score_loss, roc_auc_score  # type: ignore[import]
    from sklearn.model_selection import KFold  # type: ignore[import]
    try:
        from scipy.stats import spearmanr  # type: ignore[import]
    except ImportError:  # scipy ships transitively with sklearn but be defensive
        spearmanr = None  # type: ignore[assignment]

    y_class = (y >= tau).astype(int)
    n_samples = len(y)
    folds = max(2, min(k_folds, n_samples))
    kf = KFold(n_splits=folds, shuffle=True, random_state=seed)

    spearman_rhos: list[float] = []
    aucs: list[float] = []
    briers: list[float] = []
    calibration_bins: list[dict[str, Any]] = []

    for fold_idx, (train_idx, test_idx) in enumerate(kf.split(X)):
        X_tr, X_te = X[train_idx], X[test_idx]
        y_tr, y_te = y[train_idx], y[test_idx]
        yc_tr, yc_te = y_class[train_idx], y_class[test_idx]

        regressor = Ridge(alpha=1.0).fit(X_tr, y_tr)
        y_pred = regressor.predict(X_te)
        if spearmanr is not None and len(set(y_te)) > 1 and len(set(y_pred)) > 1:
            rho = float(spearmanr(y_te, y_pred).statistic)
            spearman_rhos.append(rho)

        if len(set(yc_tr)) >= 2:
            classifier = _fit_calibrated_classifier(X_tr, yc_tr, seed)
            proba = classifier.predict_proba(X_te)[:, 1]
            if len(set(yc_te)) >= 2:
                aucs.append(float(roc_auc_score(yc_te, proba)))
            briers.append(float(brier_score_loss(yc_te, proba)))
            bins = _calibration_bins(yc_te, proba, n_bins=5)
            calibration_bins.append({"fold": fold_idx, "bins": bins})

    metrics: dict[str, Any] = {
        "n_samples": int(n_samples),
        "n_positives": int(y_class.sum()),
        "tau": float(tau),
        "k_folds": int(folds),
    }
    if spearman_rhos:
        metrics["spearman_rho_mean"] = float(np.mean(spearman_rhos))
        metrics["spearman_rho_per_fold"] = [round(r, 4) for r in spearman_rhos]
    if aucs:
        metrics["auc_mean"] = float(np.mean(aucs))
        metrics["auc_per_fold"] = [round(a, 4) for a in aucs]
    if briers:
        metrics["brier_mean"] = float(np.mean(briers))
        metrics["brier_per_fold"] = [round(b, 4) for b in briers]
    if calibration_bins:
        metrics["calibration_curve"] = calibration_bins
    return metrics


def _calibration_bins(y_true: "Any", y_prob: "Any", n_bins: int) -> list[dict[str, float]]:
    """Return a simple reliability table for the predicted probabilities."""
    import numpy as np

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    bin_idx = np.clip(np.digitize(y_prob, bin_edges, right=True) - 1, 0, n_bins - 1)
    out: list[dict[str, float]] = []
    for b in range(n_bins):
        mask = bin_idx == b
        if mask.sum() == 0:
            continue
        out.append({
            "bin_lo": float(bin_edges[b]),
            "bin_hi": float(bin_edges[b + 1]),
            "count": int(mask.sum()),
            "mean_predicted": float(y_prob[mask].mean()),
            "mean_actual": float(y_true[mask].mean()),
        })
    return out


def train_final_model(
    X: "Any",
    y: "Any",
    tau: float,
    feature_mode: str,
    target_length: int,
    embedder_id: Optional[str],
    model_version: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """Fit regressor + Platt-scaled classifier on the full dataset; return the envelope."""
    from sklearn.linear_model import LogisticRegression, Ridge  # type: ignore[import]

    y_class = (y >= tau).astype(int)
    regressor = Ridge(alpha=1.0).fit(X, y)

    if len(set(y_class)) >= 2:
        classifier = _fit_calibrated_classifier(X, y_class, seed=42)
    else:
        logger.warning("Only one class present at τ=%s; classifier will be trivial.", tau)
        classifier = LogisticRegression(max_iter=500).fit(X, y_class)

    return {
        "regressor": regressor,
        "classifier": classifier,
        "feature_mode": feature_mode,
        "tau": float(tau),
        "target_length": int(target_length),
        "embedder_id": embedder_id,
        "model_version": model_version,
        "metadata": metadata,
    }


# ----------------------------------------------------------------------
# Persistence + Knowledge Store registration
# ----------------------------------------------------------------------


def _next_model_version(output_dir: Path, *extra_dirs: Path) -> str:
    """Determine next version by scanning output_dir and any extra_dirs."""
    used: set[int] = set()
    scan_dirs = [output_dir] + list(extra_dirs)
    for d in scan_dirs:
        if not d.exists():
            continue
        for p in d.glob("model_v*.pkl"):
            try:
                used.add(int(p.stem.split("_v")[-1]))
            except ValueError:
                continue
    output_dir.mkdir(parents=True, exist_ok=True)
    n = max(used) + 1 if used else 1
    return f"v{n}"


def save_model_artifact(envelope: dict[str, Any], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    version = envelope["model_version"]
    versioned = output_dir / f"model_{version}.pkl"
    with open(versioned, "wb") as fh:
        pickle.dump(envelope, fh)
    latest = output_dir / "model.pkl"
    if latest.is_symlink() or latest.exists():
        try:
            latest.unlink()
        except OSError:
            pass
    try:
        latest.symlink_to(versioned.name)
    except OSError:
        # Filesystems that don't support symlinks (rare on macOS/Linux but
        # common in some CI containers) fall back to a hard copy.
        with open(versioned, "rb") as src, open(latest, "wb") as dst:
            dst.write(src.read())
    logger.info("Saved brightness model to %s (latest=%s).", versioned, latest)
    return versioned


def register_finding(
    ks: Any,
    metrics: dict[str, Any],
    envelope: dict[str, Any],
    output_path: Path,
    source_artifact_ids: list[str],
    project_id: str,
    task_type: str,
) -> str:
    payload = {
        "kind": "brightness_model_eval",
        "model_version": envelope["model_version"],
        "feature_mode": envelope["feature_mode"],
        "tau": envelope["tau"],
        "model_path": str(output_path),
        "metrics": metrics,
        "n_source_artifacts": len(source_artifact_ids),
    }
    provenance = {
        "registered_by": "scripts/train_brightness_model.py",
        "source_artifact_ids": source_artifact_ids,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    return ks.register(
        kind="finding",
        name=f"Brightness model {envelope['model_version']} CV evaluation",
        scope=f"project:{project_id}",
        task_type=task_type,
        payload=payload,
        tags=["brightness_model", "cv_eval", project_id, envelope["feature_mode"]],
        provenance=provenance,
    )


# ----------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the GFP11 brightness model.")
    parser.add_argument("--feature-mode", choices=["embedding", "one_hot", "hybrid"], default="embedding")
    parser.add_argument("--target-length", type=int, default=DEFAULT_TARGET_LENGTH)
    parser.add_argument("--embedder-id", default=DEFAULT_EMBEDDER_ID)
    parser.add_argument("--k-folds", type=int, default=DEFAULT_KFOLDS)
    parser.add_argument("--tau", type=float, default=None,
                        help="Hit threshold; defaults to the value stored on the GFP11 target artifact.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--db-path",
                        default=os.environ.get("SYNQLAB_KS_DB_PATH",
                                               "data/knowledge/store.json"))
    parser.add_argument("--task-type", default=DEFAULT_TASK_TYPE)
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID)
    parser.add_argument("--dataset-path", action="append", default=[],
                        help="Extra CSV/XLSX paths to mix into training (besides KS-registered ones).")
    parser.add_argument("--sequence-column", default=None)
    parser.add_argument("--label-column", default=None)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from synqlab.knowledge_store.store import KnowledgeStore
    except ImportError as exc:
        logger.error("Could not import KnowledgeStore: %s", exc)
        sys.exit(1)
    ks = KnowledgeStore(db_path=args.db_path)

    extras = [Path(p) for p in args.dataset_path]
    records, source_ids = load_training_records(
        ks, args.task_type, args.project_id, extras,
        sequence_column=args.sequence_column,
        label_column=args.label_column,
    )
    if not records:
        logger.error(
            "No labeled rows found (task_type=%s, project_id=%s, extra paths=%s). "
            "Ingest a dataset first via scripts/ingest_brightness.py or pass "
            "--dataset-path.",
            args.task_type, args.project_id, args.dataset_path,
        )
        sys.exit(2)
    logger.info("Loaded %d total labeled rows from %d artifacts.", len(records), len(source_ids))

    tau = resolve_tau(ks, args.task_type, args.project_id, args.tau, records)
    logger.info("Using τ = %.4f", tau)

    X, y = compute_features(
        records, args.feature_mode, target_length=args.target_length,
        embedder=None, embedder_id=args.embedder_id,
    )
    logger.info("Feature matrix: %s (mode=%s)", X.shape, args.feature_mode)

    metrics = evaluate_cv(X, y, tau, args.k_folds, seed=args.seed)
    logger.info("CV metrics: %s", json.dumps(metrics, default=str)[:400])

    output_dir = Path(args.output_dir)
    version = _next_model_version(output_dir)
    envelope = train_final_model(
        X, y, tau, args.feature_mode, args.target_length, args.embedder_id,
        model_version=version,
        metadata={
            "n_train": int(len(y)),
            "n_positives": int((y >= tau).sum()),
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_source_artifacts": len(source_ids),
            "run_id": str(uuid.uuid4()),
        },
    )
    versioned_path = save_model_artifact(envelope, output_dir)

    finding_id = register_finding(
        ks, metrics, envelope, versioned_path, source_ids,
        args.project_id, args.task_type,
    )
    logger.info("Registered brightness-model finding (id=%s).", finding_id)


if __name__ == "__main__":
    main()
