"""OmegaFoldAdapter — single-sequence structure predictor."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.artifact_io import save_structure_outputs
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


_MOCK_MEAN_PLDDT = 65.0


class OmegaFoldAdapter(BaseAdapter):
    """Adapter for the OmegaFold structure predictor.

    Calls OmegaFold's Python API directly:
      - Model weights are downloaded automatically to ~/.cache/omegafold_ckpt/
        on first use (~700 MB, one-time).
      - CPU inference is slow (~5–30 min per sequence); set device='mps' on
        Apple Silicon or 'cuda' on GPU for reasonable speed.

    Mock mode (``mock_mode=True``) emits a stub PDB and returns
    ``confidence = 65.0`` without importing torch / omegafold — used by
    ``synqlab.agent.loop`` for laptop dry-runs and unit tests.

    Install: bash scripts/install_omegafold.sh
    """

    def __init__(
        self,
        weights_file: str = "",
        device: str = "cpu",
        model_id: int = 1,
        num_pseudo_msa: int = 15,
        num_cycle: int = 10,
        mock_mode: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._weights_file = weights_file or ""
        self._device = device
        self._model_id = model_id
        self._num_pseudo_msa = num_pseudo_msa
        self._num_cycle = num_cycle
        self._mock_mode = bool(mock_mode)
        self._model: Any = None

    def _load_model(self) -> None:
        """Load OmegaFold model and weights (auto-downloads if missing)."""
        try:
            import omegafold as of
            from omegafold.pipeline import _load_weights
        except ImportError as exc:
            raise AdapterError(
                "omegafold is not installed. "
                "Run: bash scripts/install_omegafold.sh"
            ) from exc

        WEIGHT_URLS = {
            1: "https://helixon.s3.amazonaws.com/release1.pt",
            2: "https://helixon.s3.amazonaws.com/release2.pt",
        }
        weights_url = WEIGHT_URLS.get(self._model_id, WEIGHT_URLS[1])
        weights_file = self._weights_file or (
            f"~/.cache/omegafold_ckpt/model{'' if self._model_id == 1 else self._model_id}.pt"
        )

        logger.info("Loading OmegaFold model %d (weights → %s)…", self._model_id, weights_file)
        try:
            state_dict = _load_weights(weights_url, weights_file)
            state_dict = state_dict.pop("model", state_dict)
        except Exception as exc:
            raise AdapterError(f"Failed to load OmegaFold weights: {exc}") from exc

        import torch
        cfg = of.make_config(model_idx=self._model_id)
        self._model = of.OmegaFold(cfg)
        self._model.load_state_dict(state_dict)
        self._model.eval()
        self._model.to(torch.device(self._device))
        logger.info("OmegaFold model loaded on device '%s'.", self._device)

    def _run_real(self, sequence: str, out_dir: Path, output_tag: str = "query") -> dict[str, Any]:
        """Run OmegaFold on a single sequence, return outputs dict."""
        import torch
        from omegafold.pipeline import fasta2inputs
        import omegafold as of

        if self._model is None:
            self._load_model()

        fasta_path = out_dir / f"{output_tag}.fasta"
        fasta_path.write_text(f">{output_tag}\n{sequence}\n")

        device = torch.device(self._device)
        try:
            inputs_iter = list(fasta2inputs(
                str(fasta_path),
                output_dir=str(out_dir),
                num_pseudo_msa=self._num_pseudo_msa,
                device=device,
                num_cycle=self._num_cycle,
            ))
        except Exception as exc:
            raise AdapterError(f"OmegaFold input preparation failed: {exc}") from exc

        if not inputs_iter:
            raise AdapterError("OmegaFold produced no inputs from the sequence.")

        input_data, save_path = inputs_iter[0]

        from omegafold.pipeline import save_pdb
        forward_config = of.make_config(model_idx=self._model_id)
        # subbatch_size is expected by the forward pass but absent from make_config
        if not hasattr(forward_config, "subbatch_size"):
            forward_config.subbatch_size = None  # None → process full sequence at once

        try:
            with torch.no_grad():
                output = self._model(
                    input_data,
                    predict_with_confidence=True,
                    fwd_cfg=forward_config,
                )
        except RuntimeError as exc:
            raise AdapterError(f"OmegaFold forward pass failed: {exc}") from exc

        pdb_path = Path(save_path)

        # save_pdb(pos14, b_factors, sequence, mask, save_path, model)
        save_pdb(
            pos14=output["final_atom_positions"],
            b_factors=output["confidence"] * 100,
            sequence=input_data[0]["p_msa"][0],
            mask=input_data[0]["p_msa_mask"][0],
            save_path=str(pdb_path),
            model=0,
        )

        # Per-residue pLDDT is the confidence tensor (0–1 scale → multiply by 100)
        confidence_tensor = output.get("confidence", None)
        if confidence_tensor is not None:
            per_residue = (confidence_tensor.squeeze().cpu() * 100).tolist()
            if isinstance(per_residue, float):
                per_residue = [per_residue]
            mean_plddt = float(sum(per_residue) / len(per_residue))
        else:
            per_residue = []
            mean_plddt = 0.0

        artifact_paths = save_structure_outputs(
            out_dir,
            tool_id="omegafold",
            per_residue_plddt=per_residue,
            mean_plddt=mean_plddt,
            meta={"device": self._device, "model_id": self._model_id,
                  "num_pseudo_msa": self._num_pseudo_msa, "num_cycle": self._num_cycle},
        )
        logger.info("pLDDT scores written to %s (mean=%.1f)", artifact_paths["plddt_path"], mean_plddt)

        return {
            "pdb_path": str(pdb_path),
            "plddt_path": str(artifact_paths["plddt_path"]),
            "meta_path": str(artifact_paths["meta_path"]),
            "confidence": round(mean_plddt, 2),
            "plddt_mean": round(mean_plddt, 2),
            "per_residue_plddt": [round(v, 2) for v in per_residue],
        }

    def _run_mock(self, sequence: str, out_dir: Path) -> dict[str, Any]:
        """Deterministic stand-in: write a stub PDB and return real-mode shape."""
        pdb_path = out_dir / f"omegafold_mock_{abs(hash(sequence)) % 10**8}.pdb"
        pdb_path.write_text(
            "REMARK SynqLab OmegaFoldAdapter mock-mode stub PDB\n"
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
            raise AdapterError("OmegaFoldAdapter requires a 'sequence' input.")

        artifact_dir = request.inputs.get("artifact_dir", "artifacts")
        output_tag = request.inputs.get("output_tag", "query")
        out_dir = Path(artifact_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        try:
            if self._mock_mode:
                outputs = self._run_mock(sequence, out_dir)
            else:
                outputs = self._run_real(sequence, out_dir, output_tag=output_tag)
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"OmegaFold execution failed: {exc}") from exc

        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
            metadata={"device": self._device, "mock_mode": self._mock_mode},
        )

    def capabilities(self) -> list[str]:
        return ["structure_prediction", "fast_screening"]
