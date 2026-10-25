"""ESMFoldAdapter — single-sequence structure predictor from Meta."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.artifact_io import save_structure_outputs
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


_MOCK_MEAN_PLDDT = 70.0


class ESMFoldAdapter(BaseAdapter):
    """Adapter for Meta's ESMFold structure predictor.

    Uses the ``esm`` library (fair-esm on PyPI) to run inference via the
    ESMFold Python API directly — no subprocess, no server required.
    fair-esm bundles all required internals; no separate openfold install needed.

    Key properties:
      - Model weights (~700 MB) are downloaded automatically to
        ~/.cache/torch/hub/ on first use.
      - CPU inference is feasible but slow for long sequences (>200 aa).
        Use device='mps' on Apple Silicon or device='cuda' on Nvidia GPU.
      - Chunk size controls memory vs. speed trade-off on GPU; set
        chunk_size=None to disable chunking (fastest, most VRAM).

    Mock mode (``mock_mode=True``) writes a stub PDB file and returns
    ``confidence = plddt_mean = 70.0`` without importing torch / esm — used
    by ``synqlab.agent.loop`` for laptop dry-runs and by unit tests that
    don't need real coordinates.

    Install:  bash scripts/install_esmfold.sh
    """

    def __init__(
        self,
        device: str = "cpu",
        chunk_size: int | None = 64,
        mock_mode: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._device = device
        self._chunk_size = chunk_size
        self._mock_mode = bool(mock_mode)
        self._model: Any = None

    def _load_model(self) -> None:
        """Load ESMFold model from pre-cached weights (GCS Fuse mount).

        Loads directly with torch.load(weights_only=False) to avoid
        PyTorch 2.x compatibility issues with the esm library's loader.
        """
        try:
            import esm  # noqa: F401 — presence check
        except ImportError as exc:
            raise AdapterError(
                "esm (fair-esm) is not installed. "
                "Run: bash scripts/install_esmfold.sh"
            ) from exc

        import gc
        import os
        import torch
        from esm.esmfold.v1.esmfold import ESMFold

        # Use local weights from GCS Fuse mount if available
        cache_dir = os.environ.get(
            "TORCH_HOME", os.path.expanduser("~/.cache/torch")
        )
        local_path = os.path.join(cache_dir, "hub", "checkpoints", "esmfold_3B_v1.pt")

        logger.info("Loading ESMFold model on device '%s' …", self._device)
        try:
            if os.path.exists(local_path):
                logger.info("Loading from local cache: %s", local_path)
                # Load checkpoint with weights_only=False for PyTorch 2.x compat
                model_data = torch.load(local_path, map_location="cpu", weights_only=False)
                cfg = model_data["cfg"]["model"]
                model_state = model_data["model"]
                del model_data  # free checkpoint blob
                gc.collect()

                self._model = ESMFold(esmfold_config=cfg)
                self._model.load_state_dict(model_state, strict=False)
                del model_state
                gc.collect()
            else:
                logger.info("Local cache not found, downloading via hub…")
                import esm as esm_lib
                self._model = esm_lib.pretrained.esmfold_v1()

            gc.collect()
            self._model = self._model.eval()

            if self._device == "cpu":
                # ESM-2 has fp16 layers — force float32 on CPU
                # (LayerNorm etc. not implemented for Half on CPU)
                self._model = self._model.float()
            else:
                self._model = self._model.to(torch.device(self._device))

            if self._chunk_size is not None:
                self._model.set_chunk_size(self._chunk_size)
        except Exception as exc:
            raise AdapterError(f"Failed to load ESMFold model: {exc}") from exc

        logger.info("ESMFold model ready on '%s'.", self._device)

    def _run_real(self, sequence: str, out_dir: Path, output_tag: str = "query") -> dict[str, Any]:
        """Run ESMFold on a single sequence, write artifacts, return outputs."""
        import torch

        if self._model is None:
            self._load_model()

        # Write input FASTA for traceability
        fasta_path = out_dir / f"{output_tag}.fasta"
        fasta_path.write_text(f">{output_tag}\n{sequence}\n")

        logger.info(
            "Running ESMFold on sequence of %d residues (device=%s) …",
            len(sequence), self._device,
        )
        try:
            with torch.no_grad():
                output = self._model.infer_pdb(sequence)
        except RuntimeError as exc:
            raise AdapterError(f"ESMFold forward pass failed: {exc}") from exc

        # output is a PDB-format string
        pdb_path = out_dir / f"{output_tag}.pdb"
        pdb_path.write_text(output)

        # Extract per-residue pLDDT from B-factor column of the PDB string
        per_residue = _plddt_from_pdb(output)
        mean_plddt = float(sum(per_residue) / len(per_residue)) if per_residue else 0.0

        artifact_paths = save_structure_outputs(
            out_dir,
            tool_id="esmfold",
            per_residue_plddt=per_residue,
            mean_plddt=mean_plddt,
            meta={
                "device": self._device,
                "chunk_size": self._chunk_size,
                "sequence_length": len(sequence),
            },
        )
        logger.info(
            "ESMFold done — pLDDT=%.1f  PDB=%s",
            mean_plddt, pdb_path,
        )

        return {
            "pdb_path": str(pdb_path),
            "plddt_path": str(artifact_paths["plddt_path"]),
            "meta_path": str(artifact_paths["meta_path"]),
            "confidence": round(mean_plddt, 2),
            "plddt_mean": round(mean_plddt, 2),
            "per_residue_plddt": [round(v, 2) for v in per_residue],
        }

    def _run_mock(self, sequence: str, out_dir: Path, output_tag: str = "query") -> dict[str, Any]:
        """Deterministic stand-in: write a stub PDB and return real-mode shape."""
        pdb_path = out_dir / f"{output_tag}_mock_{abs(hash(sequence)) % 10**8}.pdb"
        pdb_path.write_text(
            "REMARK SynqLab ESMFoldAdapter mock-mode stub PDB\n"
            f"REMARK sequence_length={len(sequence)}\n"
        )
        per_residue = [_MOCK_MEAN_PLDDT] * max(1, len(sequence))
        return {
            "pdb_path": str(pdb_path),
            "confidence": _MOCK_MEAN_PLDDT,
            "plddt_mean": _MOCK_MEAN_PLDDT,
            "per_residue_plddt": per_residue,
        }

    def run(self, request: ToolRequest) -> ToolOutput:
        sequence: str = request.inputs.get("sequence", "")
        if not sequence:
            raise AdapterError("ESMFoldAdapter requires a 'sequence' input.")

        artifact_dir = request.inputs.get("artifact_dir", "artifacts")
        output_tag = request.inputs.get("output_tag", "query")
        out_dir = Path(artifact_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        try:
            if self._mock_mode:
                outputs = self._run_mock(sequence, out_dir, output_tag=output_tag)
            else:
                outputs = self._run_real(sequence, out_dir, output_tag=output_tag)
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"ESMFold execution failed: {exc}") from exc

        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
            metadata={"device": self._device, "mock_mode": self._mock_mode},
        )

    def capabilities(self) -> list[str]:
        return ["structure_prediction", "fast_screening"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _plddt_from_pdb(pdb_str: str) -> list[float]:
    """Parse per-residue pLDDT from the B-factor column of a PDB string.

    ESMFold's ``infer_pdb`` encodes pLDDT (0–100) in the B-factor column.
    We take one value per residue (CA atom) to avoid duplicates.
    """
    seen: dict[tuple[str, int], float] = {}  # (chain, res_seq) → plddt
    for line in pdb_str.splitlines():
        if not line.startswith("ATOM"):
            continue
        atom_name = line[12:16].strip()
        if atom_name != "CA":
            continue
        try:
            chain = line[21]
            res_seq = int(line[22:26].strip())
            b_factor = float(line[60:66].strip())
        except (ValueError, IndexError):
            continue
        seen[(chain, res_seq)] = b_factor

    return [v for _, v in sorted(seen.items())]
