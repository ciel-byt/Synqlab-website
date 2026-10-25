"""Fold GFP11 candidate with GFP1-10 partner and assess complex quality.

Ported from feature branch tools.py:_validate_complex.
Uses OmegaFold service (default) or ESMFold to fold the complex.
For OmegaFold the two chains are joined with a glycine linker; for ESMFold
a multi-sequence payload is sent.
"""

from __future__ import annotations

import os
import logging

import httpx
import uuid
from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool
from synqlab.agent.tools._persist import ARTIFACT_DIR
from synqlab.storage.artifact_paths import CANDIDATES, build_agent_artifact_path

logger = logging.getLogger(__name__)

# Prefer OmegaFold (lighter, fits 12 GB VRAM); fall back to ESMFold if configured.
_OMEGAFOLD_URL = ""
_ESMFOLD_URL = ""

# Canonical sfGFP1-10 sequence (superfolder GFP residues 1–214, 11th β-strand
# removed). From Pédelacq 2006 / Cabantous & Waldo 2005.
_DEFAULT_PARTNER = (
    "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQ"
    "CFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILG"
    "HKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSAL"
    "SKDPNEKRDHMVLLEFVTAAGITLGMDELYK"
)

# Short flexible glycine linker to join the two chains for single-chain folding.
_LINKER = "GGGGSGGGGSGGGGS"


class ValidateComplexInput(BaseModel):
    sequence: str = Field(
        ..., description="GFP11 candidate sequence."
    )
    partner_sequence: str = Field(
        default="",
        description="GFP1-10 partner sequence. Uses default if empty.",
    )


async def _validate_complex_call(
    inputs: dict, ctx,
) -> ToolResult:
    # Resolve backend: explicit opt-in for ESMFold (needs >12GB VRAM),
    # otherwise default to OmegaFold (fits 12GB).
    backend_pref = os.environ.get("SYNQLAB_VALIDATE_COMPLEX_BACKEND", "omegafold")
    omegafold_url = os.environ.get("SYNQLAB_OMEGAFOLD_URL", _OMEGAFOLD_URL)
    esmfold_url = os.environ.get("SYNQLAB_ESMFOLD_URL", _ESMFOLD_URL)
    use_esmfold = backend_pref.lower() == "esmfold"
    url = esmfold_url if use_esmfold else omegafold_url

    if not url:
        backend_name = "SYNQLAB_ESMFOLD_URL" if use_esmfold else "SYNQLAB_OMEGAFOLD_URL"
        return ToolResult.fail(f"{backend_name} not configured. Cannot reach fold service.")

    sequence = str(inputs.get("sequence", "")).strip()
    partner = str(inputs.get("partner_sequence", "")).strip() or _DEFAULT_PARTNER

    if not sequence:
        return ToolResult.fail("sequence is required")

    try:
        async with httpx.AsyncClient(timeout=float(os.environ.get("SYNQLAB_FOLD_TIMEOUT_S", "3600"))) as client:
            # Both backends: join chains with glycine linker for single-chain
            # pseudo-complex folding.  The adapter expects a single "sequence".
            import hashlib
            complex_seq = partner + _LINKER + sequence
            seq_hash = hashlib.md5(sequence.encode()).hexdigest()[:12]
            unique_tag = uuid.uuid4().hex[:8]
            artifact_dir = str(
                build_agent_artifact_path(ARTIFACT_DIR, CANDIDATES)
            )

            if use_esmfold:
                payload = {
                    "tool_id": "esmfold_fold",
                    "inputs": {
                        "sequence": complex_seq,
                        "method": "esmfold",
                        "artifact_dir": artifact_dir,
                        "output_tag": f"complex_{seq_hash}_{unique_tag}",
                    },
                    "experiment_id": "validate_complex",
                    "round_id": "fold",
                }
            else:
                payload = {
                    "tool_id": "omegafold_fold",
                    "inputs": {
                        "sequence": complex_seq,
                        "method": "omegafold",
                        "artifact_dir": artifact_dir,
                        "output_tag": f"candidate_{seq_hash}_{unique_tag}",
                    },
                    "experiment_id": "validate_complex",
                    "round_id": "fold",
                }
            resp = await client.post(f"{url}/predict", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        backend = "esmfold-svc" if use_esmfold else "omegafold-svc"
        return ToolResult.fail(f"{backend} unreachable: {exc}")

    if data.get("success"):
        outputs = data["outputs"]
        pdb_path = outputs.get("pdb_path") or outputs.get("pdb")
        if pdb_path and hasattr(ctx, "known_pdb_paths"):
            ctx.known_pdb_paths.add(str(pdb_path))
        return ToolResult.ok({
            "pdb_path": pdb_path,
            "plddt_mean": outputs.get("plddt_mean", outputs.get("confidence")),
            "backend": outputs.get("backend", "esmfold" if use_esmfold else "omegafold"),
        })
    return ToolResult.fail(
        data.get("error_message", "Complex validation failed")
    )


validate_complex_tool = build_tool(AgentToolDef(
    name="validate_complex",
    description=(
        "Fold a GFP11 candidate together with the GFP1-10 partner using "
        "OmegaFold (or ESMFold if configured). Returns plddt_mean, pdb_path of the complex."
    ),
    input_schema=ValidateComplexInput,
    call=_validate_complex_call,
))
