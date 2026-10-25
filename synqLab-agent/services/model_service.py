"""Reusable FastAPI thin-server template for SynqLab model services.

Each model adapter (ProtGPT2, OmegaFold, FoldX, Reranker) runs as a
dedicated microservice using this template.  The orchestrator talks to
these services over HTTP via ``RemoteAdapterProxy``.

API contract (same for all model services)::

    POST /predict   → run inference
    GET  /health    → readiness + device info
    POST /unload    → free GPU VRAM (scale-to-zero support)
"""

from __future__ import annotations

import gc
import logging
import os
import time
from dataclasses import asdict
from typing import Any, Type

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from synqlab.adapters.base import BaseAdapter
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


def create_model_app(
    adapter_class: Type[BaseAdapter],
    adapter_kwargs: dict[str, Any],
    model_name: str,
    port: int = 8000,
    eager_load: bool = False,
) -> FastAPI:
    """Create a FastAPI app that wraps a single adapter.

    Args:
        adapter_class: The adapter class to instantiate (e.g. ProtGPT2Adapter).
        adapter_kwargs: Keyword arguments forwarded to the adapter constructor.
        model_name: Human-readable name shown in ``/health``.
        port: Port the service listens on (for logging only).
        eager_load: If True, load the adapter (and download weights) on startup
                    instead of lazily on the first ``/predict`` call.

    Returns:
        A configured FastAPI application.
    """
    app = FastAPI(
        title=f"SynqLab · {model_name} Service",
        description=f"Dedicated inference service for {model_name}.",
        version="1.0.0",
    )

    # ── Mutable state ────────────────────────────────────────────────────────
    state: dict[str, Any] = {"adapter": None, "request_count": 0}

    # ── Routes ───────────────────────────────────────────────────────────────

    @app.post("/predict")
    def predict(body: dict[str, Any]) -> JSONResponse:
        """Run inference through the wrapped adapter."""
        if state["adapter"] is None:
            logger.info("Lazy-loading %s adapter…", model_name)
            state["adapter"] = adapter_class(**adapter_kwargs)
            logger.info("%s adapter loaded.", model_name)

        request = ToolRequest(
            tool_id=body.get("tool_id", ""),
            inputs=body.get("inputs", {}),
            experiment_id=body.get("experiment_id", ""),
            round_id=body.get("round_id", ""),
            metadata=body.get("metadata", {}),
        )

        t0 = time.perf_counter()
        try:
            output: ToolOutput = state["adapter"].run(request)
        except Exception as exc:
            logger.exception("Inference failed for %s", model_name)
            return JSONResponse(
                {"outputs": {}, "success": False, "error": str(exc), "latency_ms": 0},
                status_code=500,
            )

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        state["request_count"] += 1

        return JSONResponse({
            "outputs": output.outputs,
            "success": output.success,
            "error_message": output.error_message,
            "latency_ms": latency_ms,
            "metadata": output.metadata,
        })

    @app.get("/health")
    def health() -> JSONResponse:
        """Return readiness status and device info."""
        info: dict[str, Any] = {
            "status": "ready" if state["adapter"] is not None else "idle",
            "model": model_name,
            "request_count": state["request_count"],
        }
        # Add GPU info if torch is available
        try:
            import torch
            if torch.cuda.is_available():
                info["device"] = "cuda"
                info["gpu_name"] = torch.cuda.get_device_name(0)
                info["vram_gb"] = round(
                    torch.cuda.get_device_properties(0).total_memory / (1024**3), 1
                )
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                info["device"] = "mps"
            else:
                info["device"] = "cpu"
        except ImportError:
            info["device"] = "cpu"
        return JSONResponse(info)

    @app.post("/unload")
    def unload() -> JSONResponse:
        """Unload the model to free GPU memory (scale-to-zero)."""
        state["adapter"] = None
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        logger.info("%s adapter unloaded.", model_name)
        return JSONResponse({"unloaded": True, "model": model_name})

    @app.on_event("startup")
    async def _log_startup() -> None:
        logger.info(
            "🚀 %s service starting on port %d (adapter_kwargs=%s)",
            model_name, port, adapter_kwargs,
        )
        if eager_load:
            logger.info("Eager-loading %s adapter (downloading weights if needed)…", model_name)
            state["adapter"] = adapter_class(**adapter_kwargs)
            # For OmegaFold, trigger the weight download + model load now
            if hasattr(state["adapter"], "_load_model"):
                state["adapter"]._load_model()
            logger.info("✅ %s adapter loaded and ready.", model_name)

    return app
