"""SPServerAdapter — HTTP wrapper around IRB Barcelona's SPServer.

SPServer scores a PDB file using statistical potentials. **It does not fold
sequences** — the agent must call ESMFold (or any structure predictor) on the
candidate first, then pass the resulting ``pdb_path`` here.

Mock mode (``mock_mode=True``) returns a deterministic stub and writes a
placeholder response file. Real mode submits a multipart POST to the
configured endpoint (default placeholder; see ``configs/gfp11.yaml:
tools.spserver.endpoint``) and parses the JSON response. Because the SPServer
HTTP contract is not pinned in this codebase, parsing is intentionally
defensive: any of the keys in ``_RESPONSE_SCORE_KEYS`` are accepted as the
interaction score, and we fall back to ``None`` with a clear error message
otherwise.

The adapter uses only the Python standard library (urllib + json) so it has
no extra runtime dependency.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://mmb.irbbarcelona.org/SPServer/api"
_DEFAULT_TIMEOUT = 120
_DEFAULT_RETRIES = 3
_DEFAULT_BACKOFF = 5.0
_RESPONSE_SCORE_KEYS = ("interaction_score", "score", "interface_score", "Z_score")


class SPServerAdapter(BaseAdapter):
    """Adapter for IRB Barcelona's SPServer statistical-potentials scorer.

    Args:
        mock_mode:    Skip the HTTP call and return a deterministic stub.
        endpoint:     Full URL of the SPServer API.
        timeout:      Per-request timeout in seconds.
        retries:      Number of retries on transient HTTP failures.
        backoff:      Base seconds for exponential retry backoff.
    """

    def __init__(
        self,
        mock_mode: bool = False,
        endpoint: str = _DEFAULT_ENDPOINT,
        timeout: int = _DEFAULT_TIMEOUT,
        retries: int = _DEFAULT_RETRIES,
        backoff: float = _DEFAULT_BACKOFF,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._mock_mode = bool(mock_mode)
        self._endpoint = endpoint
        self._timeout = int(timeout)
        self._retries = max(0, int(retries))
        self._backoff = float(backoff)

    # ------------------------------------------------------------------
    # Mock-mode stub
    # ------------------------------------------------------------------

    def _mock_outputs(self, pdb_path: str, artifact_dir: Path) -> dict[str, Any]:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        raw_path = artifact_dir / "spserver_mock.json"
        raw_path.write_text(json.dumps({
            "mock_mode": True,
            "endpoint": self._endpoint,
            "pdb_path": pdb_path,
            "interaction_score": -5.0,
        }, indent=2))
        return {"interaction_score": -5.0, "raw_response_path": str(raw_path)}

    # ------------------------------------------------------------------
    # Real-mode HTTP
    # ------------------------------------------------------------------

    @staticmethod
    def _build_multipart_body(
        pdb_path: Path, partner_pdb_path: Optional[Path]
    ) -> tuple[bytes, str]:
        """Build a minimal multipart/form-data body using only stdlib bytes ops."""
        boundary = f"---SynqLabSPServer{uuid.uuid4().hex}"
        sep = f"--{boundary}".encode()
        end = f"--{boundary}--\r\n".encode()
        parts: list[bytes] = []

        def _file_part(field: str, path: Path) -> bytes:
            data = path.read_bytes()
            return (
                sep + b"\r\n"
                + f'Content-Disposition: form-data; name="{field}"; filename="{path.name}"\r\n'.encode()
                + b'Content-Type: chemical/x-pdb\r\n\r\n'
                + data + b"\r\n"
            )

        parts.append(_file_part("pdb_file", pdb_path))
        if partner_pdb_path:
            parts.append(_file_part("partner_pdb_file", partner_pdb_path))
        body = b"".join(parts) + end
        content_type = f"multipart/form-data; boundary={boundary}"
        return body, content_type

    def _post(self, pdb_path: Path, partner_pdb_path: Optional[Path]) -> dict[str, Any]:
        from urllib import request as urllib_request
        from urllib.error import HTTPError, URLError

        body, content_type = self._build_multipart_body(pdb_path, partner_pdb_path)
        last_err: Optional[Exception] = None
        for attempt in range(self._retries + 1):
            req = urllib_request.Request(self._endpoint, data=body, method="POST")
            req.add_header("Content-Type", content_type)
            try:
                with urllib_request.urlopen(req, timeout=self._timeout) as resp:
                    raw = resp.read()
                payload = json.loads(raw.decode("utf-8"))
                return payload if isinstance(payload, dict) else {"raw": payload}
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_err = exc
                if attempt >= self._retries:
                    break
                wait = self._backoff * (2 ** attempt)
                logger.warning(
                    "SPServer POST failed (attempt %d/%d): %s — retrying in %.1fs",
                    attempt + 1, self._retries + 1, exc, wait,
                )
                time.sleep(wait)
        raise AdapterError(
            f"SPServer POST to {self._endpoint} failed after "
            f"{self._retries + 1} attempt(s): {last_err}"
        )

    @staticmethod
    def _extract_score(payload: dict[str, Any]) -> Optional[float]:
        for key in _RESPONSE_SCORE_KEYS:
            if key in payload:
                try:
                    return float(payload[key])
                except (TypeError, ValueError):
                    continue
        # Some APIs nest scores under a "result" key
        nested = payload.get("result")
        if isinstance(nested, dict):
            return SPServerAdapter._extract_score(nested)
        return None

    # ------------------------------------------------------------------
    # BaseAdapter API
    # ------------------------------------------------------------------

    def run(self, request: ToolRequest) -> ToolOutput:
        pdb_path_str: str = request.inputs.get("pdb_path", "")
        partner_path_str: str = str(request.inputs.get("partner_pdb_path", "") or "")
        artifact_dir = Path(request.inputs.get("artifact_dir", "artifacts"))

        if not pdb_path_str:
            raise AdapterError(
                "SPServerAdapter requires a 'pdb_path' input — typically the "
                "ESMFold output for the candidate sequence. SPServer does not "
                "fold sequences itself."
            )

        pdb_path = Path(pdb_path_str)
        partner_pdb_path = Path(partner_path_str) if partner_path_str else None
        if not self._mock_mode:
            if not pdb_path.exists():
                raise AdapterError(f"PDB file not found: {pdb_path}")
            if partner_pdb_path is not None and not partner_pdb_path.exists():
                raise AdapterError(f"Partner PDB file not found: {partner_pdb_path}")

        artifact_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.perf_counter()

        if self._mock_mode:
            outputs = self._mock_outputs(pdb_path_str, artifact_dir)
            metadata: dict[str, Any] = {"mock_mode": True, "endpoint": self._endpoint}
        else:
            payload = self._post(pdb_path, partner_pdb_path)
            score = self._extract_score(payload)
            if score is None:
                raise AdapterError(
                    f"SPServer response did not contain any of "
                    f"{_RESPONSE_SCORE_KEYS}; got keys={list(payload)}."
                )
            raw_path = artifact_dir / "spserver_response.json"
            raw_path.write_text(json.dumps(payload, indent=2))
            outputs = {
                "interaction_score": float(score),
                "raw_response_path": str(raw_path),
            }
            metadata = {"endpoint": self._endpoint}

        latency_ms = (time.perf_counter() - t0) * 1000
        return ToolOutput(
            tool_id=request.tool_id,
            outputs=outputs,
            success=True,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def capabilities(self) -> list[str]:
        return ["statistical_potential_score", "protein_protein_interaction_score"]
