"""Unit tests for ESMFoldAdapter mock mode.

Real-mode tests are out of scope here — they need ~700 MB of weights and a
torch install. The agent loop only exercises mock mode anyway, so that's
the surface we cover.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from synqlab.adapters.esmfold import ESMFoldAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(sequence: str, artifact_dir: Path) -> ToolRequest:
    return ToolRequest(
        tool_id="esmfold",
        inputs={"sequence": sequence, "artifact_dir": str(artifact_dir)},
        experiment_id="e",
        round_id="r",
    )


def test_mock_mode_writes_pdb_and_returns_real_shape(tmp_path: Path) -> None:
    adapter = ESMFoldAdapter(mock_mode=True)
    out = adapter.run(_req("ACDEFGHIK", tmp_path))
    assert out.success is True
    assert out.metadata.get("mock_mode") is True

    pdb_path = Path(out.outputs["pdb_path"])
    assert pdb_path.exists()
    assert pdb_path.read_text().startswith("REMARK SynqLab ESMFoldAdapter mock")

    # Mock returns the same keys as real mode so downstream code is uniform.
    assert "confidence" in out.outputs
    assert "plddt_mean" in out.outputs
    assert "per_residue_plddt" in out.outputs
    assert out.outputs["confidence"] == out.outputs["plddt_mean"]


def test_mock_mode_per_residue_matches_sequence_length(tmp_path: Path) -> None:
    seq = "ACDEFGHIKLM"
    adapter = ESMFoldAdapter(mock_mode=True)
    out = adapter.run(_req(seq, tmp_path))
    assert len(out.outputs["per_residue_plddt"]) == len(seq)


def test_mock_mode_does_not_import_torch_or_esm(tmp_path: Path) -> None:
    """The whole point of mock mode: laptop runs without ML deps."""
    sys.modules.pop("torch", None)
    sys.modules.pop("esm", None)

    adapter = ESMFoldAdapter(mock_mode=True)
    adapter.run(_req("ACDEFGHIK", tmp_path))

    assert "torch" not in sys.modules
    assert "esm" not in sys.modules


def test_missing_sequence_raises_in_mock_mode(tmp_path: Path) -> None:
    adapter = ESMFoldAdapter(mock_mode=True)
    req = ToolRequest(
        tool_id="esmfold",
        inputs={"artifact_dir": str(tmp_path)},
        experiment_id="e", round_id="r",
    )
    with pytest.raises(AdapterError, match="sequence"):
        adapter.run(req)


def test_mock_mode_is_deterministic_per_sequence(tmp_path: Path) -> None:
    """Same input → same pdb_path (file-naming uses hash(sequence))."""
    adapter = ESMFoldAdapter(mock_mode=True)
    out1 = adapter.run(_req("MAGIC", tmp_path))
    out2 = adapter.run(_req("MAGIC", tmp_path))
    assert out1.outputs["pdb_path"] == out2.outputs["pdb_path"]
