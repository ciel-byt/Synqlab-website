"""ProteinMPNNAdapter — inverse folding via subprocess.

Wraps the ProteinMPNN CLI (``protein_mpnn_run.py``) as a subprocess.
Given a backbone PDB, generates compatible amino acid sequences.

This adapter uses subprocess execution (like FoldXAdapter) because
ProteinMPNN's upstream repo is CLI-oriented with no stable importable
Python API.

Install: ``git clone https://github.com/dauparas/ProteinMPNN.git``
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)

# Default location inside the Docker container; overridable via env
_DEFAULT_PROTEINMPNN_DIR = os.environ.get(
    "SYNQLAB_PROTEINMPNN_DIR", "/app/proteinmpnn"
)


class ProteinMPNNAdapter(BaseAdapter):
    """Adapter for ProteinMPNN inverse folding.

    Calls ``protein_mpnn_run.py`` as a subprocess, parses FASTA output,
    and returns designed sequences with scores.

    Args:
        proteinmpnn_dir: Path to the cloned ProteinMPNN repository.
        device: ``"cpu"`` or ``"cuda"`` (default: ``"cpu"``).
        model_name: Weight variant (default: ``"v_48_020"``).
    """

    def __init__(
        self,
        proteinmpnn_dir: str = _DEFAULT_PROTEINMPNN_DIR,
        device: str = "cpu",
        model_name: str = "v_48_020",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._dir = Path(proteinmpnn_dir)
        self._device = device
        self._model_name = model_name

    def _validate_install(self) -> None:
        """Check that the ProteinMPNN repo is available."""
        run_script = self._dir / "protein_mpnn_run.py"
        if not run_script.exists():
            raise AdapterError(
                f"ProteinMPNN not found at {self._dir}. "
                "Install: git clone https://github.com/dauparas/ProteinMPNN.git"
            )

    @staticmethod
    def _parse_fasta_output(fasta_path: Path) -> list[dict[str, Any]]:
        """Parse ProteinMPNN FASTA output into structured records.

        Each record has:
          - sequence: str (designed chains joined by ``/``)
          - score: float (average neg log prob over designed residues)
          - global_score: float (average over all residues)
          - sample: int (sample index, 0 = wildtype/input)
          - temperature: float
          - seq_recovery: float (fraction matching input)
        """
        if not fasta_path.exists():
            return []

        records: list[dict[str, Any]] = []
        text = fasta_path.read_text()

        # Split into header + sequence pairs
        entries = re.split(r"\n(?=>)", text.strip())
        for entry in entries:
            lines = entry.strip().split("\n")
            if len(lines) < 2:
                continue
            header = lines[0].lstrip(">")
            sequence = "".join(lines[1:]).strip()

            record: dict[str, Any] = {"sequence": sequence}

            # Parse key=value pairs from header
            for match in re.finditer(r"(\w+)=([\d.]+)", header):
                key, val = match.group(1), match.group(2)
                try:
                    record[key] = float(val) if "." in val else int(val)
                except ValueError:
                    record[key] = val

            records.append(record)

        return records

    def run(self, request: ToolRequest) -> ToolOutput:
        """Execute ProteinMPNN on a PDB and return designed sequences."""
        pdb_path = request.inputs.get("pdb_path", "")
        if not pdb_path:
            raise AdapterError("ProteinMPNNAdapter requires a 'pdb_path' input.")

        pdb = Path(pdb_path)
        if not pdb.exists():
            raise AdapterError(f"PDB file not found: {pdb_path}")

        self._validate_install()

        # ── Extract inputs ──────────────────────────────────────────────
        n_sequences = int(request.inputs.get("n_sequences", 10))
        temperature = float(request.inputs.get("temperature", 0.1))
        model_name = str(request.inputs.get("model_name", self._model_name))
        design_chains = str(request.inputs.get("design_chains", ""))
        use_soluble = bool(request.inputs.get("use_soluble_model", False))

        # ── Prepare output directory ────────────────────────────────────
        artifact_dir = request.inputs.get("artifact_dir", "")
        if artifact_dir:
            out_dir = Path(artifact_dir)
            out_dir.mkdir(parents=True, exist_ok=True)
        else:
            out_dir = Path(tempfile.mkdtemp(prefix="proteinmpnn_"))

        # ── Build CLI command ───────────────────────────────────────────
        cmd = [
            "python",
            str(self._dir / "protein_mpnn_run.py"),
            "--pdb_path", str(pdb),
            "--out_folder", str(out_dir),
            "--num_seq_per_target", str(n_sequences),
            "--sampling_temp", str(temperature),
            "--model_name", model_name,
            "--seed", "0",
            "--save_score", "1",
        ]

        if design_chains:
            cmd.extend(["--pdb_path_chains", design_chains])

        if use_soluble:
            cmd.append("--use_soluble_model")

        # Set weights path based on model variant
        if use_soluble:
            weights_dir = self._dir / "soluble_model_weights"
        else:
            weights_dir = self._dir / "vanilla_model_weights"
        cmd.extend(["--path_to_model_weights", str(weights_dir)])

        # Handle fixed positions if provided
        fixed_positions = request.inputs.get("fixed_positions")
        if fixed_positions and isinstance(fixed_positions, dict):
            fixed_json_path = out_dir / "fixed_positions.json"
            fixed_json_path.write_text(json.dumps(fixed_positions))
            cmd.extend(["--fixed_positions_jsonl", str(fixed_json_path)])

        # ── Execute ─────────────────────────────────────────────────────
        logger.info(
            "Running ProteinMPNN: %d seqs, T=%.2f, model=%s, chains=%s",
            n_sequences, temperature, model_name, design_chains or "all",
        )

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
                cwd=str(self._dir),
            )
        except subprocess.TimeoutExpired as exc:
            raise AdapterError(
                f"ProteinMPNN timed out after 300s: {exc}"
            ) from exc
        except FileNotFoundError as exc:
            raise AdapterError(
                f"Failed to run ProteinMPNN — Python not found? {exc}"
            ) from exc

        if result.returncode != 0:
            stderr = result.stderr[:1000] if result.stderr else "(no stderr)"
            raise AdapterError(
                f"ProteinMPNN exited with code {result.returncode}: {stderr}"
            )

        # ── Parse output ────────────────────────────────────────────────
        # ProteinMPNN writes FASTA to out_folder/seqs/<pdb_name>.fa
        seqs_dir = out_dir / "seqs"
        fasta_files = list(seqs_dir.glob("*.fa")) if seqs_dir.exists() else []

        if not fasta_files:
            raise AdapterError(
                f"ProteinMPNN produced no output FASTA in {seqs_dir}. "
                f"stdout: {result.stdout[:500]}"
            )

        fasta_path = fasta_files[0]
        records = self._parse_fasta_output(fasta_path)

        if not records:
            raise AdapterError(
                f"Failed to parse ProteinMPNN output from {fasta_path}"
            )

        # First record is the input/wildtype — skip it for designed sequences
        designed = records[1:] if len(records) > 1 else records
        sequences = [r["sequence"] for r in designed]
        scores = [float(r.get("score", 0.0)) for r in designed]
        global_scores = [float(r.get("global_score", 0.0)) for r in designed]

        logger.info(
            "ProteinMPNN complete: %d sequences designed (best score=%.4f)",
            len(sequences),
            min(scores) if scores else 0.0,
        )

        return ToolOutput(
            tool_id=request.tool_id,
            outputs={
                "sequences": sequences,
                "scores": scores,
                "global_scores": global_scores,
                "log_probabilities": scores,  # alias for registry contract
                "fasta_path": str(fasta_path),
            },
            success=True,
            metadata={
                "model_name": model_name,
                "temperature": temperature,
                "device": self._device,
                "design_chains": design_chains or "all",
            },
        )

    def healthcheck(self) -> bool:
        """Return True if the ProteinMPNN repo is available."""
        return (self._dir / "protein_mpnn_run.py").exists()

    def capabilities(self) -> list[str]:
        return ["inverse_folding", "sequence_recovery"]
