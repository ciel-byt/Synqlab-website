"""ComplexStabilityAdapter — V2 stand-in for AlphaFold-Multimer.

Concatenates two chains (typically GFP11 + GFP1-10) with a glycine-serine
linker, runs a single-chain folder over the joined sequence, and returns
the mean pLDDT as a stability proxy. We use mean-pLDDT in place of iPTM
because AlphaFold-Multimer access is not currently available; the
``af_multimer`` backend is intentionally deferred.

Backend matrix (selected via the ``backend`` constructor arg or the
``backend`` input on the ``ToolRequest``):

  * ``esmfold``    — default; delegates to :class:`ESMFoldAdapter`.
  * ``omegafold``  — optional; delegates to :class:`OmegaFoldAdapter`.
  * ``af_multimer``— deferred; raises a clear AdapterError until access is
                     granted, at which point this is the place to wire in
                     the real Multimer subprocess.

Mock mode (``mock_mode=True``) emits a stub PDB file and returns
``plddt_mean = 60.0`` (on the same 0–100 scale ESMFold uses) — laptop
dry-runs and unit tests work without any folding model on disk.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Optional

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)

_DEFAULT_LINKER = "GGGGSGGGGS"
_DEFAULT_BACKEND = "esmfold"
_VALID_BACKENDS = ("esmfold", "omegafold", "af_multimer")
_MOCK_MEAN_PLDDT = 60.0
_MOCK_PER_RES_PLDDT = 60.0


class ComplexStabilityAdapter(BaseAdapter):
    """Adapter for joined-chain complex stability prediction.

    Args:
        backend:        ``esmfold`` (default), ``omegafold``, ``af_multimer``.
        linker:         Linker peptide inserted between the two chains.
        mock_mode:      Skip the real folder and emit a deterministic stub.
        delegate:       Optional pre-built single-chain folder adapter to
                        delegate folding to (used in tests to avoid loading
                        ESMFold/OmegaFold weights).
        adapter_kwargs: Extra kwargs forwarded to the constructed delegate
                        when ``delegate`` is None.
    """

    def __init__(
        self,
        backend: str = _DEFAULT_BACKEND,
        linker: str = _DEFAULT_LINKER,
        mock_mode: bool = False,
        delegate: Optional[BaseAdapter] = None,
        adapter_kwargs: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        if backend not in _VALID_BACKENDS:
            raise AdapterError(
                f"Unsupported ComplexStability backend '{backend}'. "
                f"Valid: {_VALID_BACKENDS}."
            )
        self._backend = backend
        self._linker = str(linker)
        self._mock_mode = bool(mock_mode)
        self._delegate = delegate
        self._adapter_kwargs = dict(adapter_kwargs or {})

    # ------------------------------------------------------------------
    # Backend resolution
    # ------------------------------------------------------------------

    def _resolve_delegate(self) -> BaseAdapter:
        if self._delegate is not None:
            return self._delegate
        if self._backend == "esmfold":
            from synqlab.adapters.esmfold import ESMFoldAdapter
            self._delegate = ESMFoldAdapter(**self._adapter_kwargs)
        elif self._backend == "omegafold":
            from synqlab.adapters.omegafold import OmegaFoldAdapter
            self._delegate = OmegaFoldAdapter(**self._adapter_kwargs)
        elif self._backend == "af_multimer":
            raise AdapterError(
                "AlphaFold-Multimer backend is deferred — we do not have "
                "access yet. Set configs/gfp11.yaml: stability.tool to "
                "'esmfold' (default) or 'omegafold' until access is granted."
            )
        else:  # pragma: no cover — guarded above
            raise AdapterError(f"Unsupported backend: {self._backend}")
        return self._delegate  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _join_sequences(self, sequences: list[str]) -> tuple[str, list[int]]:
        """Return (joined_sequence, [chain_a_length, chain_b_length])."""
        if len(sequences) != 2:
            raise AdapterError(
                "ComplexStabilityAdapter requires exactly 2 sequences "
                f"([chain_A, chain_B]); got {len(sequences)}."
            )
        a, b = (str(s).strip() for s in sequences)
        if not a or not b:
            raise AdapterError("Both sequences must be non-empty.")
        joined = f"{a}{self._linker}{b}"
        return joined, [len(a), len(b)]

    def _mock_outputs(
        self, joined: str, chain_lengths: list[int], artifact_dir: Path
    ) -> dict[str, Any]:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        pdb_path = artifact_dir / "complex_mock.pdb"
        pdb_path.write_text(
            "REMARK SynqLab ComplexStabilityAdapter mock-mode stub PDB\n"
            f"REMARK chain_lengths={chain_lengths} linker_length={len(self._linker)}\n"
            f"REMARK joined_sequence_length={len(joined)}\n"
        )
        per_residue = [_MOCK_PER_RES_PLDDT] * len(joined)
        return {
            "pdb_path": str(pdb_path),
            "plddt_mean": _MOCK_MEAN_PLDDT,
            "plddt_per_residue": per_residue,
        }

    @staticmethod
    def _delegate_outputs_to_complex(delegate_outputs: dict[str, Any]) -> dict[str, Any]:
        """Map a single-chain folder's outputs to ComplexStability's schema."""
        pdb_path = delegate_outputs.get("pdb_path", "")
        per_residue = delegate_outputs.get("per_residue_plddt") or []
        # ESMFoldAdapter uses 'confidence' for mean pLDDT; OmegaFoldAdapter is similar.
        plddt_mean = delegate_outputs.get("plddt_mean")
        if plddt_mean is None:
            plddt_mean = delegate_outputs.get("confidence")
        if plddt_mean is None:
            plddt_mean = (
                float(sum(per_residue) / len(per_residue)) if per_residue else 0.0
            )
        return {
            "pdb_path": str(pdb_path),
            "plddt_mean": float(plddt_mean),
            "plddt_per_residue": [float(v) for v in per_residue],
        }

    # ------------------------------------------------------------------
    # BaseAdapter API
    # ------------------------------------------------------------------

    def run(self, request: ToolRequest) -> ToolOutput:
        sequences = request.inputs.get("sequences")
        if not isinstance(sequences, (list, tuple)):
            raise AdapterError(
                "ComplexStabilityAdapter requires a 'sequences' input "
                "([chain_A, chain_B])."
            )
        artifact_dir = Path(request.inputs.get("artifact_dir", "artifacts"))
        # Allow per-call backend override via the request, defaulting to the
        # backend pinned at construction time.
        backend_override = request.inputs.get("backend")
        if backend_override and backend_override != self._backend:
            if backend_override not in _VALID_BACKENDS:
                raise AdapterError(
                    f"Unsupported per-call backend '{backend_override}'. "
                    f"Valid: {_VALID_BACKENDS}."
                )
            self._backend = backend_override
            self._delegate = None  # force re-resolution

        joined, chain_lengths = self._join_sequences(list(sequences))
        artifact_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.perf_counter()

        if self._mock_mode:
            outputs = self._mock_outputs(joined, chain_lengths, artifact_dir)
            metadata: dict[str, Any] = {
                "mock_mode": True,
                "backend": self._backend,
                "linker": self._linker,
                "chain_lengths": chain_lengths,
            }
        else:
            delegate = self._resolve_delegate()
            sub_request = ToolRequest(
                tool_id=f"complex_stability:{self._backend}",
                inputs={"sequence": joined, "artifact_dir": str(artifact_dir)},
                experiment_id=request.experiment_id,
                round_id=request.round_id,
                metadata={"complex_chain_lengths": chain_lengths, "linker": self._linker},
            )
            try:
                sub_output = delegate.run(sub_request)
            except AdapterError:
                raise
            except Exception as exc:
                raise AdapterError(
                    f"ComplexStability delegate ({self._backend}) failed: {exc}"
                ) from exc
            if not sub_output.success:
                raise AdapterError(
                    f"Delegate {self._backend} reported failure: "
                    f"{sub_output.error_message}"
                )
            outputs = self._delegate_outputs_to_complex(sub_output.outputs)
            metadata = {
                "backend": self._backend,
                "linker": self._linker,
                "chain_lengths": chain_lengths,
                "delegate_metadata": sub_output.metadata,
            }

        latency_ms = (time.perf_counter() - t0) * 1000
        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def capabilities(self) -> list[str]:
        return ["complex_pdb_prediction", "complex_stability_scoring"]
