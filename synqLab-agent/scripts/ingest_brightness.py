#!/usr/bin/env python3
"""One-shot script to ingest the 113-set brightness dataset into the Knowledge Store.

Usage::

    python scripts/ingest_brightness.py [--file <path>] [--project-id <id>]
                                        [--db-path <path>]
                                        [--sequence-column <name>]
                                        [--label-column <name>]

By default the script reads
``../datasets/113setdiscrepantlabelswithpositives.xlsx`` (relative to this
script) and auto-detects its column names. The 113-set xlsx ships with
``Amino Acid Sequence`` and ``Median Brightness``, both of which are
recognised. Pass ``--sequence-column`` / ``--label-column`` only when working
with a non-canonical layout.

Persistence: ingested artifacts are written to
``data/knowledge/store.json`` (matching
``scripts/register_gfp11_target.py``) so downstream tools — most importantly
``scripts/train_brightness_model.py`` — can find them.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


_DEFAULT_DB_PATH = "data/knowledge/store.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest GFP11 brightness dataset.")
    default_file = (
        Path(__file__).resolve().parents[2]
        / "datasets" / "113setdiscrepantlabelswithpositives.xlsx"
    )
    parser.add_argument("--file", default=str(default_file))
    parser.add_argument("--project-id", default="gfp11-v1")
    parser.add_argument(
        "--sequence-column", default=None,
        help="Override sequence column name. Default: auto-detect.",
    )
    parser.add_argument(
        "--label-column", default=None,
        help="Override label column name. Default: auto-detect.",
    )
    parser.add_argument(
        "--db-path", default=_DEFAULT_DB_PATH,
        help=f"Knowledge Store JSON path (default: {_DEFAULT_DB_PATH}).",
    )
    args = parser.parse_args()

    from synqlab.adapters.label_ingest import FluorescenceLabelIngestAdapter
    from synqlab.core.schemas import ToolRequest

    inputs: dict[str, object] = {
        "file_path": args.file,
        "project_id": args.project_id,
        "db_path": args.db_path,
    }
    if args.sequence_column is not None:
        inputs["sequence_column"] = args.sequence_column
    if args.label_column is not None:
        inputs["label_column"] = args.label_column

    adapter = FluorescenceLabelIngestAdapter(db_path=args.db_path)
    request = ToolRequest(
        tool_id="fluorescence_label_ingest",
        inputs=inputs,
        experiment_id="ingest",
        round_id="round_0",
    )

    result = adapter.run(request)
    if result.success:
        logger.info(
            "Ingestion complete: artifact_id=%s, n_registered=%d, columns=%s/%s, db_path=%s",
            result.outputs["artifact_id"],
            result.outputs["n_registered"],
            result.outputs.get("sequence_column"),
            result.outputs.get("label_column"),
            result.outputs.get("db_path"),
        )
    else:
        logger.error("Ingestion failed: %s", result.error_message)
        sys.exit(1)


if __name__ == "__main__":
    main()
