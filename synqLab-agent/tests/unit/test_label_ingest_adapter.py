"""Unit tests for FluorescenceLabelIngestAdapter."""

from __future__ import annotations

import csv
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from synqlab.adapters.label_ingest import FluorescenceLabelIngestAdapter
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="fluorescence_label_ingest",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    csv_path = tmp_path / "brightness.csv"
    rows = [
        {"sequence": "ACDEFGHIK", "brightness": "1.2"},
        {"sequence": "LMNPQRSTVWY", "brightness": "0.8"},
        {"sequence": "ACCCCCCC", "brightness": "2.0"},
    ]
    with open(csv_path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["sequence", "brightness"])
        writer.writeheader()
        writer.writerows(rows)
    return csv_path


def test_missing_file_raises(tmp_path: Path) -> None:
    from synqlab.core.exceptions import AdapterError
    adapter = FluorescenceLabelIngestAdapter()
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req(file_path=str(tmp_path / "nonexistent.csv")))


def test_real_mode_csv(csv_file: Path) -> None:
    import synqlab.knowledge_store.store as ks_module

    original_cls = ks_module.KnowledgeStore
    try:
        fake_ks = MagicMock()
        fake_ks.register.return_value = "fake-artifact-id"
        ks_module.KnowledgeStore = MagicMock(return_value=fake_ks)  # type: ignore[attr-defined]

        adapter = FluorescenceLabelIngestAdapter()
        result = adapter.run(_req(
            file_path=str(csv_file),
            sequence_column="sequence",
            label_column="brightness",
            project_id="test-project",
        ))
        assert result.success is True
        assert result.outputs["n_registered"] == 3
        assert result.outputs["artifact_id"] == "fake-artifact-id"
    finally:
        ks_module.KnowledgeStore = original_cls  # type: ignore[attr-defined]


def test_missing_sequence_column_raises(csv_file: Path) -> None:
    from synqlab.core.exceptions import AdapterError
    adapter = FluorescenceLabelIngestAdapter()
    with pytest.raises(AdapterError, match="Sequence column"):
        adapter.run(_req(
            file_path=str(csv_file),
            sequence_column="NONEXISTENT",
            label_column="brightness",
        ))


def test_missing_label_column_raises(csv_file: Path) -> None:
    from synqlab.core.exceptions import AdapterError
    adapter = FluorescenceLabelIngestAdapter()
    with pytest.raises(AdapterError, match="Label column"):
        adapter.run(_req(
            file_path=str(csv_file),
            sequence_column="sequence",
            label_column="NONEXISTENT",
        ))
