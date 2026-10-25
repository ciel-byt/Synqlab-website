#!/usr/bin/env python3
"""Train the SynqLab reranker model from stored run data.

Usage:
    python scripts/train_reranker.py [--db-url <url>] [--output data/models/reranker/model.pkl]

The script:
1. Queries all completed omegafold and foldx ToolRun rows from the DB.
2. Joins them by round_id to produce (plddt, ddg) feature vectors.
3. Trains a logistic regression predicting P(hit) (placeholder: uses ddg sign as label).
4. Saves the model as a pickled sklearn estimator at --output.
"""

from __future__ import annotations

import argparse
import logging
import os
import pickle
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _build_training_data(db_url: str):
    """Extract (plddt, ddg, label) rows from the database."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from synqlab.storage.models import Base, ToolRun

    engine = create_engine(db_url, future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as session:
        of_runs = (
            session.query(ToolRun)
            .filter_by(tool_id="omegafold", status="completed")
            .all()
        )
        fx_runs = (
            session.query(ToolRun)
            .filter_by(tool_id="foldx", status="completed")
            .all()
        )

    # Index foldx by round_id for joining.
    fx_by_round: dict[str, float] = {}
    for r in fx_runs:
        resp = r.response_jsonb or {}
        if "ddg" in resp:
            fx_by_round[r.round_id] = float(resp["ddg"])

    rows: list[tuple[float, float, int]] = []
    for r in of_runs:
        resp = r.response_jsonb or {}
        if "confidence" not in resp:
            continue
        plddt = float(resp["confidence"])
        ddg = fx_by_round.get(r.round_id, 0.0)
        # Placeholder binary label: plddt >= 75 AND ddg <= 0 → hit
        label = 1 if (plddt >= 75.0 and ddg <= 0.0) else 0
        rows.append((plddt, ddg, label))

    return rows


def train(db_url: str, output_path: str) -> None:
    import numpy as np
    from sklearn.linear_model import LogisticRegression  # type: ignore[import]
    from sklearn.pipeline import Pipeline  # type: ignore[import]
    from sklearn.preprocessing import StandardScaler  # type: ignore[import]

    logger.info("Fetching training data from DB...")
    rows = _build_training_data(db_url)

    if len(rows) < 4:
        logger.warning(
            "Only %d training samples found. Using synthetic fallback data.", len(rows)
        )
        rows = [
            (85.0, -2.0, 1),
            (90.0, -1.5, 1),
            (60.0, 3.0, 0),
            (55.0, 2.5, 0),
            (80.0, -0.5, 1),
            (45.0, 4.0, 0),
        ]

    X = np.array([[r[0], r[1]] for r in rows])
    y = np.array([r[2] for r in rows])

    logger.info("Training logistic regression on %d samples (%d positives).", len(y), int(y.sum()))
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=500, random_state=42)),
    ])
    model.fit(X, y)
    model._synqlab_version = "v1"  # type: ignore[attr-defined]

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as fh:
        pickle.dump(model, fh)

    logger.info("Reranker model saved to %s.", out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train SynqLab reranker.")
    parser.add_argument(
        "--db-url",
        default=os.environ.get(
            "SYNQLAB_DB_URL", "postgresql://synqlab:synqlab@localhost:5432/synqlab"
        ),
    )
    parser.add_argument("--output", default="data/models/reranker/model.pkl")
    args = parser.parse_args()
    train(args.db_url, args.output)


if __name__ == "__main__":
    main()
