"""Shared async HTTP helpers for agent tools.

Uses ``httpx.AsyncClient`` instead of ``urllib.request.urlopen`` so that
long-running model-service calls (30s+ inference) do not block the
asyncio event loop. Blocking the loop would starve FastAPI's
``/healthz`` probe (causing GKE liveness failures → pod restart) and
prevent WebSocket ping frames (causing LB-initiated WS drops).

Tool modules import these helpers at module scope so tests can patch
them with ``monkeypatch.setattr(tool_module, "post_json", fake)``.
"""

from __future__ import annotations

from typing import Any

import httpx


async def post_json(
    url: str,
    payload: dict[str, Any],
    *,
    timeout: float = 120.0,
) -> Any:
    """POST a JSON body and return the parsed JSON response.

    Non-2xx responses raise ``httpx.HTTPStatusError``.
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()


async def get_json(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float = 30.0,
) -> Any:
    """GET request returning parsed JSON. Non-2xx raises."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
