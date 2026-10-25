"""Unit tests for ProteinMPNNAdapter — patches subprocess to avoid model downloads."""

from __future__ import annotations

import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from synqlab.adapters.proteinmpnn import ProteinMPNNAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="proteinmpnn",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


# Sample FASTA output matching ProteinMPNN's format
_SAMPLE_FASTA = textwrap.dedent("""\
    >3HTN, score=1.1705, global_score=1.2045, fixed_chains=['B'], designed_chains=['A'], model_name=v_48_020, seed=37
    NMYSYKKIGNKYIVSINNHTEIVKALNAFCKEKGILSGSINGIGAIGELTLRFFNPKTKAYDDKTFR
    >T=0.1, sample=1, score=0.7291, global_score=0.9330, seq_recovery=0.5736
    NMYSYKKIGNKYIVSINNHTEIVKALKKFCEEKNIKSGSVNGIGSIGSVTLKFYNLETKEEELKTFN
    >T=0.1, sample=2, score=0.7414, global_score=0.9355, seq_recovery=0.6075
    NMYKYKKIGNKYIVSINNHTEIVKAIKEFCKEKNIKSGTINGIGQVGKVTLRFYNPETKEYTEKTFN
    >T=0.1, sample=3, score=0.7100, global_score=0.9200, seq_recovery=0.5900
    NMYKYKKIGNKYIVSINNHTEIVEALKKFCEDKNIKSGTINGIGQVGKVTLKFYNPETKEYTEKTFN
""")


def _make_adapter_with_mock(
    n_sequences: int = 3,
    tmp_path: Path | None = None,
) -> ProteinMPNNAdapter:
    """Return a ProteinMPNNAdapter with subprocess mocked."""
    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    return adapter


def _setup_mock_output(tmp_path: Path, n_sequences: int = 3) -> Path:
    """Create a fake ProteinMPNN output directory with FASTA file."""
    seqs_dir = tmp_path / "seqs"
    seqs_dir.mkdir(parents=True)
    fasta_path = seqs_dir / "3HTN.fa"
    fasta_path.write_text(_SAMPLE_FASTA)
    return tmp_path


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_returns_correct_n_sequences(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    # Create fake PDB input
    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")

    # Create fake output
    out_dir = _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    result = adapter.run(_req(
        pdb_path=str(pdb_path),
        artifact_dir=str(out_dir),
        n_sequences=3,
    ))

    # 4 entries minus 1 wildtype = 3 designed sequences
    assert len(result.outputs["sequences"]) == 3


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_sequences_are_strings(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    result = adapter.run(_req(pdb_path=str(pdb_path), artifact_dir=str(tmp_path)))

    for seq in result.outputs["sequences"]:
        assert isinstance(seq, str)
        assert len(seq) > 0


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_scores_are_floats(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    result = adapter.run(_req(pdb_path=str(pdb_path), artifact_dir=str(tmp_path)))

    for score in result.outputs["scores"]:
        assert isinstance(score, float)
        assert score > 0.0

    for gs in result.outputs["global_scores"]:
        assert isinstance(gs, float)
        assert gs > 0.0


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_success_flag(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    result = adapter.run(_req(pdb_path=str(pdb_path), artifact_dir=str(tmp_path)))
    assert result.success is True


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_subprocess_called_with_correct_args(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    adapter.run(_req(
        pdb_path=str(pdb_path),
        artifact_dir=str(tmp_path),
        n_sequences=5,
        temperature=0.2,
        model_name="v_48_010",
    ))

    call_args = mock_run.call_args
    cmd = call_args[0][0]

    assert "--num_seq_per_target" in cmd
    idx = cmd.index("--num_seq_per_target")
    assert cmd[idx + 1] == "5"

    assert "--sampling_temp" in cmd
    idx = cmd.index("--sampling_temp")
    assert cmd[idx + 1] == "0.2"

    assert "--model_name" in cmd
    idx = cmd.index("--model_name")
    assert cmd[idx + 1] == "v_48_010"


def test_missing_pdb_path_raises_error() -> None:
    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    with pytest.raises(AdapterError, match="pdb_path"):
        adapter.run(_req())


def test_nonexistent_pdb_raises_error() -> None:
    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req(pdb_path="/nonexistent/path.pdb"))


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_subprocess_failure_raises_error(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(
        returncode=1, stdout="", stderr="RuntimeError: CUDA OOM"
    )

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    with pytest.raises(AdapterError, match="exited with code 1"):
        adapter.run(_req(pdb_path=str(pdb_path), artifact_dir=str(tmp_path)))


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_metadata_present(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    result = adapter.run(_req(pdb_path=str(pdb_path), artifact_dir=str(tmp_path)))

    assert "model_name" in result.metadata
    assert "temperature" in result.metadata
    assert "device" in result.metadata


@patch("synqlab.adapters.proteinmpnn.subprocess.run")
@patch.object(ProteinMPNNAdapter, "_validate_install")
def test_design_chains_passed_to_cli(mock_validate, mock_run, tmp_path) -> None:
    mock_validate.return_value = None
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

    pdb_path = tmp_path / "input.pdb"
    pdb_path.write_text("ATOM  1  CA  ALA A   1")
    _setup_mock_output(tmp_path)

    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    adapter.run(_req(
        pdb_path=str(pdb_path),
        artifact_dir=str(tmp_path),
        design_chains="A",
    ))

    cmd = mock_run.call_args[0][0]
    assert "--pdb_path_chains" in cmd
    idx = cmd.index("--pdb_path_chains")
    assert cmd[idx + 1] == "A"


def test_capabilities() -> None:
    adapter = ProteinMPNNAdapter(proteinmpnn_dir="/app/proteinmpnn")
    caps = adapter.capabilities()
    assert "inverse_folding" in caps
    assert "sequence_recovery" in caps
