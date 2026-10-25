#!/usr/bin/env python3
"""One-shot script to register the GFP11 design target in the Knowledge Store.

Registers a single `target` artifact under task_type=gfp11_brightness containing:
  - The GFP1-10 partner sequence (sfGFP1-10, the protein GFP11 must bind)
  - The hit threshold τ — either provided via CLI or computed from the
    113-set median brightness when the dataset is reachable

Idempotent: re-running the script does not create duplicate target artifacts;
use --force to overwrite an existing one.

Usage:
    python scripts/register_gfp11_target.py
    python scripts/register_gfp11_target.py --threshold-value 0.42
    python scripts/register_gfp11_target.py --dataset-path /path/to/113set.xlsx --force

Acceptance (Phase 0):
    KnowledgeStore.retrieve(task_type="gfp11_brightness", kinds=["target"])
    returns one artifact with `partner_sequence` and `hit_threshold_value`
    populated.
"""

from __future__ import annotations

import argparse
import logging
import statistics
import sys
from pathlib import Path
from typing import Any, Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Canonical sfGFP1-10 sequence (superfolder GFP residues 1–214, 11th β-strand
# removed). Matches the example in docs/design-docs/knowledge-store.md and the
# proposal's split-GFP background (Cabantous & Waldo 2005; Pédelacq 2006).
GFP1_10_SEQUENCE = (
    "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQ"
    "CFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILG"
    "HKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSAL"
    "SKDPNEKRDHMVLLEFVTAAGITLGMDELYK"
)

DEFAULT_DATASET_REL_PATH = Path("..") / "datasets" / "113setdiscrepantlabelswithpositives.xlsx"
DEFAULT_DB_PATH = Path("artifacts") / "knowledge" / "store.json"
DEFAULT_PROJECT_ID = "gfp11-v1"
DEFAULT_TASK_TYPE = "gfp11_brightness"


def _compute_threshold_from_dataset(
    path: Path, sequence_column: str, label_column: str
) -> Optional[float]:
    """Read a brightness dataset and return the median label, or None on failure."""
    try:
        import pandas as pd  # type: ignore[import]
    except ImportError:
        logger.warning("pandas not installed; cannot compute threshold from dataset.")
        return None

    if not path.exists():
        logger.info("Dataset not found at %s — leaving threshold unset.", path)
        return None

    try:
        if path.suffix.lower() in {".xlsx", ".xls"}:
            df = pd.read_excel(path)
        elif path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        else:
            logger.warning("Unsupported dataset format: %s", path.suffix)
            return None
        if label_column not in df.columns:
            logger.warning(
                "Label column '%s' not found in %s (columns: %s)",
                label_column, path, list(df.columns),
            )
            return None
        values = [float(v) for v in df[label_column].dropna().tolist()]
        if not values:
            logger.warning("No non-null values in column '%s'.", label_column)
            return None
        median = statistics.median(values)
        logger.info(
            "Computed pilot threshold τ = %.4f from %d rows (median of %s).",
            median, len(values), label_column,
        )
        return median
    except Exception as exc:  # noqa: BLE001 — surface any I/O / parsing error
        logger.warning("Failed to compute threshold from %s: %s", path, exc)
        return None


def _existing_target_id(ks: Any, task_type: str, project_id: str) -> Optional[str]:
    """Return the artifact ID of an existing GFP11 target, or None."""
    existing = ks.retrieve(
        task_type=task_type,
        project_id=project_id,
        kinds=["target"],
    )
    if not existing:
        return None
    if len(existing) > 1:
        logger.warning(
            "Found %d target artifacts for task_type=%s project_id=%s; "
            "using the first.",
            len(existing), task_type, project_id,
        )
    return existing[0].id


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Register the GFP11 design target in the Knowledge Store."
    )
    default_dataset = (
        Path(__file__).resolve().parents[2] / "datasets"
        / "113setdiscrepantlabelswithpositives.xlsx"
    )
    parser.add_argument(
        "--threshold-value", type=float, default=None,
        help="Explicit hit threshold τ. If unset, attempt to compute the median "
             "brightness of the dataset at --dataset-path.",
    )
    parser.add_argument(
        "--dataset-path", default=str(default_dataset),
        help="Path to the 113-set brightness dataset (xlsx or csv).",
    )
    # Column names match the canonical 113-set xlsx (NOT the stale defaults in
    # scripts/ingest_brightness.py — that script has the wrong column names
    # against this file; tracked as a follow-up in the GFP11 plan).
    parser.add_argument("--sequence-column", default="Amino Acid Sequence")
    parser.add_argument("--label-column", default="Median Brightness")
    parser.add_argument(
        "--db-path", default=str(DEFAULT_DB_PATH),
        help="Path to the Knowledge Store JSON persistence file.",
    )
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID)
    parser.add_argument("--task-type", default=DEFAULT_TASK_TYPE)
    parser.add_argument(
        "--force", action="store_true",
        help="Overwrite an existing target artifact if one is already registered.",
    )
    args = parser.parse_args()

    # Resolve τ
    threshold: Optional[float] = args.threshold_value
    if threshold is None:
        threshold = _compute_threshold_from_dataset(
            Path(args.dataset_path), args.sequence_column, args.label_column,
        )
    if threshold is None:
        logger.warning(
            "No threshold computed; storing hit_threshold_value=null. "
            "Re-run with --threshold-value or --dataset-path before running "
            "the GFP11 pipeline."
        )

    try:
        from synqlab.knowledge_store.store import KnowledgeStore
    except ImportError as exc:
        logger.error("Could not import KnowledgeStore: %s", exc)
        sys.exit(1)

    ks = KnowledgeStore(db_path=args.db_path)

    existing_id = _existing_target_id(ks, args.task_type, args.project_id)
    if existing_id and not args.force:
        logger.info(
            "Target artifact already registered (id=%s). Re-run with --force "
            "to overwrite.",
            existing_id,
        )
        sys.exit(0)
    if existing_id and args.force:
        # KnowledgeStore has no public `delete`; for this one-shot Phase-0
        # script we drop the entry directly. Single-threaded usage so the
        # store-level lock is not needed here.
        ks._store.pop(existing_id, None)
        ks._save()
        logger.info("Removed existing target artifact (id=%s).", existing_id)

    payload: dict[str, Any] = {
        "molecule": "GFP11",
        "partner": "GFP1-10",
        "partner_sequence": GFP1_10_SEQUENCE,
        "partner_sequence_length": len(GFP1_10_SEQUENCE),
        "assay": "split_gfp_complementation",
        "hit_threshold_field": args.label_column,
        "hit_threshold_value": threshold,
        "candidate_length": 16,
        "notes": (
            "sfGFP1-10 partner sequence (Pédelacq 2006 superfolder GFP, 11th "
            "β-strand removed); GFP11 candidates are 16-residue peptides that "
            "complement to restore fluorescence (Cabantous & Waldo 2005)."
        ),
    }
    provenance = {
        "registered_by": "scripts/register_gfp11_target.py",
        "partner_sequence_source": "docs/design-docs/knowledge-store.md",
        "threshold_source": (
            "cli:--threshold-value" if args.threshold_value is not None
            else (f"median:{args.dataset_path}" if threshold is not None else "unset")
        ),
        "literature": [
            "Cabantous & Waldo 2005 (split-GFP)",
            "Pédelacq et al. 2006 (superfolder GFP)",
        ],
    }

    artifact_id = ks.register(
        kind="target",
        name="GFP11 design target (sfGFP1-10 partner)",
        scope=f"project:{args.project_id}",
        task_type=args.task_type,
        payload=payload,
        tags=["gfp11", "split_gfp", "target", args.project_id],
        provenance=provenance,
    )
    logger.info(
        "Registered GFP11 target (id=%s, partner_len=%d, hit_threshold=%s).",
        artifact_id, len(GFP1_10_SEQUENCE),
        f"{threshold:.4f}" if threshold is not None else "null",
    )


if __name__ == "__main__":
    main()
