"""PyRosettaAdapter — physics-based interface ΔG and per-position ΔΔG scans.

Two execution modes selected via the ``mode`` input:

  * ``interface_dg``        — runs InterfaceAnalyzerMover on a complex PDB and
                              returns the interface ΔG (REU). Used as the
                              physics check on top GFP11/GFP1-10 candidates.
  * ``point_mutation_scan`` — for each position in the design chain, mutates
                              to alanine (or a configurable fallback) with
                              ``MutateResidue`` and returns the per-residue
                              ΔΔG against the wild-type score.

Mock mode (``mock_mode=True``) bypasses the PyRosetta import entirely and
returns deterministic stubs; both unit tests and laptop dry-runs work
without an academic PyRosetta license installed.
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

_VALID_MODES = ("interface_dg", "point_mutation_scan")
_DEFAULT_GFP11_LENGTH = 16
_DEFAULT_SCAN_TARGET = "A"  # alanine scanning by default
_DEFAULT_SCORE_FUNCTION = "ref15"


class PyRosettaAdapter(BaseAdapter):
    """Adapter for PyRosetta-based interface and ΔΔG scoring.

    Args:
        mock_mode:       Skip the real PyRosetta import and return stub outputs.
        score_function:  Rosetta scorefunction name (default: ``ref15``).
        scan_target_aa:  Single-letter amino acid code used in
                         point_mutation_scan mode (default: ``A``).
        init_flags:      Flags string passed to ``pyrosetta.init`` (default
                         silences PyRosetta's banner).
    """

    def __init__(
        self,
        mock_mode: bool = False,
        score_function: str = _DEFAULT_SCORE_FUNCTION,
        scan_target_aa: str = _DEFAULT_SCAN_TARGET,
        init_flags: str = "-mute all -ignore_unrecognized_res true",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._mock_mode = bool(mock_mode)
        self._score_function = score_function
        self._scan_target_aa = scan_target_aa.upper()
        self._init_flags = init_flags
        self._initialised = False

    # ------------------------------------------------------------------
    # Mock-mode stubs
    # ------------------------------------------------------------------

    def _mock_outputs(
        self,
        mode: str,
        pdb_path: str,
        artifact_dir: Path,
        chains: str,
    ) -> dict[str, Any]:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        raw_path = artifact_dir / "pyrosetta_mock.txt"
        raw_path.write_text(
            "PyRosetta mock-mode output\n"
            f"mode: {mode}\n"
            f"pdb_path: {pdb_path}\n"
            f"chains: {chains}\n"
            f"score_function: {self._score_function}\n"
            "score: -10.0\n"
        )
        if mode == "point_mutation_scan":
            per_residue: Optional[list[float]] = [0.0] * _DEFAULT_GFP11_LENGTH
        else:
            per_residue = None
        return {
            "score": -10.0,
            "per_residue": per_residue,
            "raw_output_path": str(raw_path),
        }

    # ------------------------------------------------------------------
    # Real-mode helpers (lazy pyrosetta import)
    # ------------------------------------------------------------------

    def _ensure_pyrosetta(self) -> Any:
        try:
            import pyrosetta  # type: ignore[import]
        except ImportError as exc:
            raise AdapterError(
                "pyrosetta is not importable. PyRosetta requires an academic "
                "license — see https://www.pyrosetta.org/downloads. For local "
                "dry-runs without a license, instantiate the adapter with "
                "PyRosettaAdapter(mock_mode=True)."
            ) from exc
        if not self._initialised:
            pyrosetta.init(self._init_flags)
            self._initialised = True
        return pyrosetta

    def _run_interface_dg(
        self,
        pyrosetta: Any,
        pdb_path: Path,
        chains: str,
        artifact_dir: Path,
    ) -> dict[str, Any]:
        if not chains:
            raise AdapterError(
                "interface_dg mode requires a 'chains' input like 'A_B'."
            )
        pose = pyrosetta.pose_from_pdb(str(pdb_path))
        ia_mover = pyrosetta.rosetta.protocols.analysis.InterfaceAnalyzerMover(chains)
        ia_mover.set_pack_separated(True)
        ia_mover.apply(pose)
        ddg = float(ia_mover.get_interface_dG())
        raw_path = artifact_dir / "interface_analyzer.txt"
        raw_path.write_text(
            f"InterfaceAnalyzerMover\n"
            f"pdb_path: {pdb_path}\n"
            f"chains: {chains}\n"
            f"interface_dG: {ddg}\n"
        )
        return {"score": ddg, "per_residue": None, "raw_output_path": str(raw_path)}

    def _run_point_mutation_scan(
        self,
        pyrosetta: Any,
        pdb_path: Path,
        chains: str,
        artifact_dir: Path,
    ) -> dict[str, Any]:
        pose = pyrosetta.pose_from_pdb(str(pdb_path))
        sfxn = pyrosetta.create_score_function(self._score_function)
        wt_score = float(sfxn(pose))

        # Determine scan range: design chain (second char of "A_B" if present)
        design_chain: Optional[str] = None
        if chains and "_" in chains:
            design_chain = chains.split("_", 1)[1][:1] or None

        per_residue: list[float] = []
        for resi in range(1, pose.size() + 1):
            if design_chain and pose.pdb_info().chain(resi) != design_chain:
                continue
            mutated = pyrosetta.rosetta.core.pose.Pose()
            mutated.assign(pose)
            try:
                pyrosetta.rosetta.protocols.simple_moves.MutateResidue(
                    target=resi, new_res=self._scan_target_aa
                ).apply(mutated)
                mut_score = float(sfxn(mutated))
                per_residue.append(mut_score - wt_score)
            except Exception as exc:  # pragma: no cover — depends on PyRosetta runtime
                logger.warning("Failed to mutate residue %d: %s", resi, exc)
                per_residue.append(0.0)

        aggregate = float(sum(per_residue) / len(per_residue)) if per_residue else 0.0
        raw_path = artifact_dir / "point_mutation_scan.txt"
        raw_path.write_text(
            "MutateResidue scan\n"
            f"pdb_path: {pdb_path}\n"
            f"chains: {chains}\n"
            f"target_aa: {self._scan_target_aa}\n"
            f"wt_score: {wt_score}\n"
            f"per_residue_ddg: {per_residue}\n"
        )
        return {
            "score": aggregate,
            "per_residue": per_residue,
            "raw_output_path": str(raw_path),
        }

    # ------------------------------------------------------------------
    # BaseAdapter API
    # ------------------------------------------------------------------

    def run(self, request: ToolRequest) -> ToolOutput:
        pdb_path: str = request.inputs.get("pdb_path", "")
        mode: str = request.inputs.get("mode", "interface_dg")
        chains: str = str(request.inputs.get("chains", ""))
        artifact_dir = Path(request.inputs.get("artifact_dir", "artifacts"))

        if not pdb_path:
            raise AdapterError("PyRosettaAdapter requires a 'pdb_path' input.")
        if mode not in _VALID_MODES:
            raise AdapterError(
                f"Unsupported PyRosetta mode '{mode}'. Valid: {_VALID_MODES}."
            )

        pdb = Path(pdb_path)
        if not pdb.exists() and not self._mock_mode:
            raise AdapterError(f"PDB file not found: {pdb}")

        artifact_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.perf_counter()

        if self._mock_mode:
            outputs = self._mock_outputs(mode, pdb_path, artifact_dir, chains)
            metadata: dict[str, Any] = {"mock_mode": True, "mode": mode}
        else:
            pyrosetta = self._ensure_pyrosetta()
            try:
                if mode == "interface_dg":
                    outputs = self._run_interface_dg(pyrosetta, pdb, chains, artifact_dir)
                else:
                    outputs = self._run_point_mutation_scan(pyrosetta, pdb, chains, artifact_dir)
            except AdapterError:
                raise
            except Exception as exc:
                raise AdapterError(f"PyRosetta {mode} failed: {exc}") from exc
            metadata = {"mode": mode, "score_function": self._score_function}

        latency_ms = (time.perf_counter() - t0) * 1000
        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def capabilities(self) -> list[str]:
        return ["interface_dg", "point_mutation_scan"]
