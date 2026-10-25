"""RemoteAdapterProxy — call a model service over HTTP.

This proxy implements the ``BaseAdapter`` interface so the pipeline and
executor do not need to know whether they are calling a local adapter or
a remote microservice.  When ``SYNQLAB_<TOOL>_URL`` environment variables
are set, ``adapter_resolver.resolve_adapter()`` returns one of these
proxies instead of a local adapter instance.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


class RemoteAdapterProxy(BaseAdapter):
    """Proxy that delegates ``run()`` to a remote model service via HTTP POST.

    The proxy is transparent to the pipeline — it implements the same
    ``BaseAdapter`` interface as any local adapter.

    Args:
        service_url: Base URL of the model service (e.g. ``http://protgpt2-svc:8001``).
        timeout: Request timeout in seconds (default 600 — inference can be slow).
    """

    def __init__(
        self,
        service_url: str,
        timeout: int = 1800,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._url = service_url.rstrip("/")
        self._timeout = timeout
        logger.info("RemoteAdapterProxy → %s (timeout=%ds)", self._url, self._timeout)

    def run(self, request: ToolRequest) -> ToolOutput:
        """Forward the tool request to the remote service."""
        import httpx

        payload = asdict(request)
        url = f"{self._url}/predict"

        try:
            response = httpx.post(url, json=payload, timeout=self._timeout)
            response.raise_for_status()
        except httpx.ConnectError as exc:
            raise AdapterError(
                f"Cannot reach model service at {url}. "
                f"Is the service running? Error: {exc}"
            ) from exc
        except httpx.TimeoutException as exc:
            raise AdapterError(
                f"Model service at {url} timed out after {self._timeout}s: {exc}"
            ) from exc
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500]
            raise AdapterError(
                f"Model service returned {exc.response.status_code}: {body}"
            ) from exc

        data = response.json()
        return ToolOutput(
            tool_id=request.tool_id,
            outputs=data.get("outputs", {}),
            success=data.get("success", False),
            error_message=data.get("error_message"),
            latency_ms=data.get("latency_ms"),
            metadata=data.get("metadata", {}),
        )

    def healthcheck(self) -> bool:
        """Check if the remote model service is reachable."""
        import httpx

        try:
            r = httpx.get(f"{self._url}/health", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def capabilities(self) -> list[str]:
        """Query capabilities from the remote service (fallback: empty)."""
        return []

    def __repr__(self) -> str:
        return f"RemoteAdapterProxy(url={self._url!r})"
