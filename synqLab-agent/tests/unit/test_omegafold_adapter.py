"""Unit tests for OmegaFoldAdapter — patches the real model to avoid GPU/download."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from synqlab.adapters.omegafold import OmegaFoldAdapter
from synqlab.core.schemas import ToolRequest


def _req(sequence: str = "ACDEFGHIK") -> ToolRequest:
    return ToolRequest(
        tool_id="omegafold",
        inputs={"sequence": sequence},
        experiment_id="exp-1",
        round_id="r1",
    )


def _make_adapter_with_mock_model(sequence: str = "ACDEFGHIK") -> OmegaFoldAdapter:
    """Return an OmegaFoldAdapter with _run_real patched to return synthetic data."""
    adapter = OmegaFoldAdapter()
    n = len(sequence)
    adapter._run_real = MagicMock(return_value={  # type: ignore[method-assign]
        "pdb_path": "data/agent_artifacts/mock/structure.pdb",
        "confidence": 82.5,
        "per_residue_plddt": [82.5] * n,
    })
    return adapter


def test_returns_pdb_path() -> None:
    adapter = _make_adapter_with_mock_model()
    result = adapter.run(_req())
    assert "pdb_path" in result.outputs
    assert isinstance(result.outputs["pdb_path"], str)


def test_confidence_in_range() -> None:
    adapter = _make_adapter_with_mock_model()
    result = adapter.run(_req())
    conf = result.outputs["confidence"]
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 100.0


def test_per_residue_plddt_length_matches_sequence() -> None:
    seq = "ACDEFGHIKLM"
    adapter = _make_adapter_with_mock_model(sequence=seq)
    result = adapter.run(_req(sequence=seq))
    assert len(result.outputs["per_residue_plddt"]) == len(seq)


def test_success_flag() -> None:
    adapter = _make_adapter_with_mock_model()
    result = adapter.run(_req())
    assert result.success is True


def test_missing_sequence_raises() -> None:
    from synqlab.core.exceptions import AdapterError
    adapter = OmegaFoldAdapter()
    req = ToolRequest(tool_id="omegafold", inputs={}, experiment_id="e", round_id="r")
    with pytest.raises(AdapterError, match="sequence"):
        adapter.run(req)
