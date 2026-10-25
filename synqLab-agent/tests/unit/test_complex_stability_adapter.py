"""Unit tests for ComplexStabilityAdapter.

Tests cover mock mode (deterministic stubs), input validation,
backend resolution, and capabilities. Real-mode tests that need
ESM/OmegaFold are skipped (no GPU model in CI).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from synqlab.adapters.complex_stability import ComplexStabilityAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


GFP11 = "RDHMVLHEYVNAAGIT"
GFP1_10 = "MSKGEELFTGVVPILVELD" + "A" * 20  # truncated for test

def _req(sequences: list[str], artifact_dir: str = "artifacts") -> ToolRequest:
    return ToolRequest(
        tool_id="complex_stability",
        inputs={"sequences": sequences, "artifact_dir": artifact_dir},
        experiment_id="exp-1",
        round_id="r1",
    )


# ------------------------------------------------------------------
# Mock mode
# ------------------------------------------------------------------


def test_mock_returns_stub_with_chain_lengths(tmp_path: Path) -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    out = adapter.run(_req([GFP11, GFP1_10], artifact_dir=str(tmp_path)))
    assert out.success is True
    assert "plddt_mean" in out.outputs
    assert "chain_lengths" in out.metadata
    assert out.metadata["chain_lengths"] == [len(GFP11), len(GFP1_10)]
    assert isinstance(out.outputs["plddt_mean"], float)
    assert out.metadata.get("mock_mode") is True


def test_mock_writes_pdb_file(tmp_path: Path) -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    out = adapter.run(_req([GFP11, GFP1_10], artifact_dir=str(tmp_path)))
    pdb_path = Path(out.outputs["pdb_path"])
    assert pdb_path.exists()
    assert "REMARK" in pdb_path.read_text()


def test_mock_is_deterministic(tmp_path: Path) -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    a = adapter.run(_req(["MA", "GG"], artifact_dir=str(tmp_path / "a")))
    b = adapter.run(_req(["MA", "GG"], artifact_dir=str(tmp_path / "b")))
    assert a.outputs["plddt_mean"] == b.outputs["plddt_mean"]


# ------------------------------------------------------------------
# Input validation
# ------------------------------------------------------------------


def test_missing_sequences_raises() -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="sequences"):
        adapter.run(ToolRequest(
            tool_id="complex_stability",
            inputs={},
            experiment_id="exp-1",
            round_id="r1",
        ))


def test_wrong_sequence_count_raises(tmp_path: Path) -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="exactly 2"):
        adapter.run(_req(["A"], artifact_dir=str(tmp_path)))


def test_empty_sequence_raises(tmp_path: Path) -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="non-empty"):
        adapter.run(_req(["MA", ""], artifact_dir=str(tmp_path)))


# ------------------------------------------------------------------
# Backend resolution
# ------------------------------------------------------------------


def test_unknown_backend_raises() -> None:
    with pytest.raises(AdapterError, match="Unsupported"):
        ComplexStabilityAdapter(backend="nonexistent", mock_mode=False)


def test_af_multimer_backend_raises() -> None:
    adapter = ComplexStabilityAdapter(backend="af_multimer", mock_mode=False)
    with pytest.raises(AdapterError, match="deferred"):
        adapter.run(_req([GFP11, GFP1_10]))


def test_default_backend_is_esmfold() -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    assert adapter._backend == "esmfold"


def test_custom_linker() -> None:
    adapter = ComplexStabilityAdapter(linker="GGG", mock_mode=True)
    assert adapter._linker == "GGG"


# ------------------------------------------------------------------
# Capabilities
# ------------------------------------------------------------------


def test_capabilities() -> None:
    adapter = ComplexStabilityAdapter(mock_mode=True)
    caps = adapter.capabilities()
    assert "complex_pdb_prediction" in caps
    assert "complex_stability_scoring" in caps
