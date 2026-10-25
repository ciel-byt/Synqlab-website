"""FoldXAdapter — physics-based ΔΔG stability scorer."""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest
from synqlab.storage.artifact_paths import FOLDX, build_agent_artifact_path

logger = logging.getLogger(__name__)


def _normalize_mutation(mut: str, default_chain: str = "A") -> str:
    """Normalize mutation string to FoldX format: WT + CHAIN + POS + MUT.

    Accepts:
      - "L7A" → "LA7A" (inserts default chain)
      - "LA7A" → "LA7A" (already correct)
      - "L_A_7_A" or similar → best-effort parse

    FoldX format: {WT}{Chain}{Position}{Mutant} e.g. LA7A
    """
    mut = mut.strip()
    if not mut:
        return mut

    # Already in FoldX format: letter + letter + digits + letter (e.g., LA7A)
    match = re.match(r"^([A-Z])([A-Z])(\d+)([A-Z])$", mut, re.IGNORECASE)
    if match:
        return mut.upper()

    # Short format without chain: letter + digits + letter (e.g., L7A)
    match = re.match(r"^([A-Z])(\d+)([A-Z])$", mut, re.IGNORECASE)
    if match:
        wt, pos, mutant = match.groups()
        return f"{wt.upper()}{default_chain}{pos}{mutant.upper()}"

    # Return as-is if we can't parse (let FoldX report the error)
    logger.warning("Could not parse mutation format: %s", mut)
    return mut


class FoldXAdapter(BaseAdapter):
    """Adapter for the FoldX binary (free academic license).

    Calls the FoldX binary via subprocess using RepairPDB + BuildModel/Stability.

    Setup:
        1. Download from https://foldxsuite.crg.eu/ (free registration)
        2. bash scripts/setup_foldx.sh /path/to/foldx_binary
           or set SYNQLAB_FOLDX_BINARY_PATH env var
           or configs/local.yaml → tools.foldx.binary_path
    """

    def __init__(
        self,
        binary_path: str = "",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._binary_path = (
            binary_path
            or os.environ.get("SYNQLAB_FOLDX_BINARY_PATH", "")
        )

    def _resolve_binary(self) -> Path:
        """Return the resolved FoldX binary path, raising AdapterError if missing."""
        path = self._binary_path
        if not path:
            raise AdapterError(
                "FoldX binary path not configured.\n"
                "  Option 1: bash scripts/setup_foldx.sh /path/to/foldx\n"
                "  Option 2: export SYNQLAB_FOLDX_BINARY_PATH=/path/to/foldx\n"
                "  Option 3: configs/local.yaml → tools.foldx.binary_path\n"
                "  Download:  https://foldxsuite.crg.eu/ (free academic license)"
            )
        binary = Path(path)
        if not binary.exists():
            raise AdapterError(
                f"FoldX binary not found at: {binary}\n"
                "  Re-run: bash scripts/setup_foldx.sh /correct/path/to/foldx"
            )
        return binary

    def _parse_ddg(self, work_dir: Path, stdout: str = "") -> float:
        """Parse ΔΔG from FoldX output.

        FoldX 5.1 Stability writes results to stdout (Total = X.XX).
        FoldX BuildModel writes to .fxout files with tab-separated values.
        """
        # Try .fxout files first (BuildModel mode)
        for pattern in ["Dif_*.fxout", "Average_*.fxout", "*.fxout"]:
            files = list(work_dir.glob(pattern))
            if files:
                content = files[0].read_text()
                for line in content.splitlines():
                    parts = line.strip().split("\t")
                    if len(parts) >= 2:
                        # Average_ files have SD in col 1, total energy in col 2
                        if pattern.startswith("Average_") and len(parts) >= 3:
                            try:
                                return float(parts[2])
                            except ValueError:
                                continue
                        # Dif_ and others have total energy in col 1
                        try:
                            return float(parts[1])
                        except ValueError:
                            continue

        # Fallback: parse "Total = X.XX" from stdout (Stability mode in FoldX 5.1)
        sources = [stdout]
        output_file = work_dir / "foldx_output.txt"
        if output_file.exists():
            sources.append(output_file.read_text())
        for text in sources:
            for line in text.splitlines():
                stripped = line.strip()
                if stripped.startswith("Total") and "=" in stripped:
                    try:
                        return float(stripped.split("=")[-1].strip())
                    except ValueError:
                        continue

        raise AdapterError(
            f"Could not parse ΔΔG from FoldX output in {work_dir}. "
            f"Files present: {list(work_dir.glob('*.fxout'))}"
        )

    def _run_real(self, pdb_path: str, mutations: list[str], work_dir: Path) -> dict[str, Any]:
        binary = self._resolve_binary()
        pdb = Path(pdb_path)
        if not pdb.exists():
            raise AdapterError(f"PDB file not found: {pdb}")

        pdb_copy = work_dir / pdb.name
        if pdb.resolve() != pdb_copy.resolve():
            shutil.copy(pdb, pdb_copy)

        # Step 1: RepairPDB
        repair_cmd = [
            str(binary),
            "--command=RepairPDB",
            f"--pdb={pdb_copy.name}",
            f"--output-dir={work_dir}",
        ]
        logger.info("FoldX RepairPDB: %s", " ".join(repair_cmd))
        foldx_timeout = int(os.environ.get("SYNQLAB_FOLDX_TIMEOUT_S", "900"))
        try:
            proc = subprocess.run(
                repair_cmd, capture_output=True, text=True,
                timeout=foldx_timeout, cwd=str(work_dir),
            )
        except subprocess.TimeoutExpired as exc:
            raise AdapterError(f"FoldX RepairPDB timed out ({foldx_timeout} s).") from exc

        if proc.returncode != 0:
            raise AdapterError(
                f"FoldX RepairPDB failed (exit {proc.returncode}):\n{proc.stderr[:800]}"
            )

        repaired_pdb = work_dir / (pdb.stem + "_Repair.pdb")
        if not repaired_pdb.exists():
            candidates = list(work_dir.glob("*Repair*.pdb"))
            repaired_pdb = candidates[0] if candidates else pdb_copy

        # Step 2: Stability or BuildModel
        if mutations:
            normalized = [_normalize_mutation(m) for m in mutations]
            mut_file = work_dir / "individual_list.txt"
            mut_file.write_text(",".join(normalized) + ";\n")
            score_cmd = [
                str(binary),
                "--command=BuildModel",
                f"--pdb={repaired_pdb.name}",
                f"--mutant-file={mut_file}",
                f"--output-dir={work_dir}",
                "--numberOfRuns=1",
            ]
        else:
            score_cmd = [
                str(binary),
                "--command=Stability",
                f"--pdb={repaired_pdb.name}",
                f"--output-dir={work_dir}",
            ]

        logger.info("FoldX scoring: %s", " ".join(score_cmd))
        try:
            proc = subprocess.run(
                score_cmd, capture_output=True, text=True,
                timeout=foldx_timeout, cwd=str(work_dir),
            )
        except subprocess.TimeoutExpired as exc:
            raise AdapterError(f"FoldX scoring timed out ({foldx_timeout} s).") from exc

        if proc.returncode != 0:
            raise AdapterError(
                f"FoldX scoring failed (exit {proc.returncode}):\n{proc.stderr[:800]}"
            )

        raw_output = work_dir / "foldx_output.txt"
        raw_output.write_text(proc.stdout + "\n" + proc.stderr)

        ddg = self._parse_ddg(work_dir, stdout=proc.stdout)
        return {
            "ddg": ddg,
            "raw_output_path": str(raw_output),
        }

    def run(self, request: ToolRequest) -> ToolOutput:
        pdb_path: str = request.inputs.get("pdb_path", "")
        mutations: list[str] = list(request.inputs.get("mutations", []))
        artifact_dir = request.inputs.get("artifact_dir", "artifacts")

        if not pdb_path:
            raise AdapterError("FoldXAdapter requires a 'pdb_path' input.")

        import uuid
        run_id = str(uuid.uuid4())[:8]
        work_dir = build_agent_artifact_path(Path(artifact_dir), FOLDX, run_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        try:
            outputs = self._run_real(pdb_path, mutations, work_dir)
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"FoldX execution failed: {exc}") from exc

        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
        )

    def capabilities(self) -> list[str]:
        return ["stability_scoring", "mutation_ddg"]
