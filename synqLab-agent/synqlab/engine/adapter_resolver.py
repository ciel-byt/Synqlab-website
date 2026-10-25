"""Adapter resolver — maps a ToolDefinition's adapter_class to an adapter instance."""

from __future__ import annotations

import importlib
import logging
import os
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.tool_definition import ToolDefinition

logger = logging.getLogger(__name__)

_ADAPTER_MODULE_MAP: dict[str, str] = {
    "ProtGPT2Adapter": "synqlab.adapters.protgpt2",
    "OmegaFoldAdapter": "synqlab.adapters.omegafold",
    "ESMFoldAdapter": "synqlab.adapters.esmfold",
    "FoldXAdapter": "synqlab.adapters.foldx",
    "RerankerAdapter": "synqlab.adapters.reranker",
    "ExperimentStoreAdapter": "synqlab.adapters.experiment_store",
    "FluorescenceLabelIngestAdapter": "synqlab.adapters.label_ingest",
    "ProteinMPNNAdapter": "synqlab.adapters.proteinmpnn",
    # Phase 14 scientific adapters
    "BrightnessModelAdapter": "synqlab.adapters.brightness_model",
    "ComplexStabilityAdapter": "synqlab.adapters.complex_stability",
    "PyRosettaAdapter": "synqlab.adapters.pyrosetta",
    "SPServerAdapter": "synqlab.adapters.spserver",
}

# Maps adapter class names to environment variables that hold the remote
# service URL.  When the env var is set, resolve_adapter() returns a
# RemoteAdapterProxy instead of importing the adapter locally.
_SERVICE_ENV_MAP: dict[str, str] = {
    "ProtGPT2Adapter": "SYNQLAB_PROTGPT2_URL",
    "OmegaFoldAdapter": "SYNQLAB_OMEGAFOLD_URL",
    "ESMFoldAdapter": "SYNQLAB_ESMFOLD_URL",
    "FoldXAdapter": "SYNQLAB_FOLDX_URL",
    "RerankerAdapter": "SYNQLAB_RERANKER_URL",
    "ProteinMPNNAdapter": "SYNQLAB_PROTEINMPNN_URL",
    # Phase 14 scientific adapters
    "BrightnessModelAdapter": "SYNQLAB_BRIGHTNESS_MODEL_URL",
    "ComplexStabilityAdapter": "SYNQLAB_COMPLEX_STABILITY_URL",
    "PyRosettaAdapter": "SYNQLAB_PYROSETTA_URL",
    "SPServerAdapter": "SYNQLAB_SPSERVER_URL",
}


def resolve_adapter(
    tool_def: ToolDefinition,
    adapter_kwargs: dict[str, Any] | None = None,
) -> BaseAdapter:
    """Return an initialised adapter for the given ToolDefinition.

    Args:
        tool_def: The registry entry for the tool.
        adapter_kwargs: Extra keyword arguments forwarded to the adapter constructor.

    Returns:
        An initialised :class:`BaseAdapter` subclass.

    Raises:
        AdapterError: If the adapter class cannot be found or instantiated.
    """
    class_name = tool_def.adapter_class

    # ── Remote resolution (microservice mode) ──────────────────────────
    env_key = _SERVICE_ENV_MAP.get(class_name)
    if env_key:
        service_url = os.environ.get(env_key)
        if service_url:
            from synqlab.engine.remote_adapter import RemoteAdapterProxy

            logger.info(
                "Resolving %s → remote service at %s", class_name, service_url
            )
            return RemoteAdapterProxy(service_url=service_url)

    # ── Local fallback (no remote service configured) ────────────────────
    module_path = _ADAPTER_MODULE_MAP.get(class_name)

    if module_path is None:
        raise AdapterError(
            f"No module mapping found for adapter_class '{class_name}'. "
            f"Known adapters: {list(_ADAPTER_MODULE_MAP)}"
        )

    try:
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)
    except (ImportError, AttributeError) as exc:
        raise AdapterError(
            f"Could not import adapter '{class_name}' from '{module_path}': {exc}"
        ) from exc

    kwargs: dict[str, Any] = {}
    if adapter_kwargs:
        kwargs.update(adapter_kwargs)

    try:
        adapter: BaseAdapter = cls(**kwargs)
    except Exception as exc:
        raise AdapterError(
            f"Failed to instantiate adapter '{class_name}': {exc}"
        ) from exc

    logger.debug("Resolved adapter %s", class_name)
    return adapter
