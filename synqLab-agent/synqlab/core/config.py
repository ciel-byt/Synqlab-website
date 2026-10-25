"""Configuration loader for SynqLab.

Resolution order (highest wins):
  1. Environment variables prefixed SYNQLAB_
  2. configs/local.yaml  (if present)
  3. configs/base.yaml   (always loaded)
  4. Hard-coded defaults in ExperimentConfig
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Any

import yaml

from synqlab.core.exceptions import ConfigError
from synqlab.core.schemas import ExperimentConfig

logger = logging.getLogger(__name__)

_BASE_CONFIG_NAME = "base.yaml"
_LOCAL_CONFIG_NAME = "local.yaml"


def _find_configs_dir() -> Path:
    """Walk up from the current file until we find a 'configs/' directory."""
    candidate = Path(__file__).resolve().parent
    for _ in range(10):
        configs_dir = candidate / "configs"
        if configs_dir.is_dir():
            return configs_dir
        parent = candidate.parent
        if parent == candidate:
            break
        candidate = parent
    raise ConfigError("Could not locate 'configs/' directory.")


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge *override* into *base*, returning a new dict."""
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _load_yaml(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return data or {}


def _apply_env_vars(cfg: dict[str, Any]) -> dict[str, Any]:
    """Apply environment variable overrides."""
    env_map: dict[str, tuple[list[str], type]] = {
        "SYNQLAB_DB_URL": (["database", "url"], str),
        "SYNQLAB_REGISTRY_PATH": (["registry", "path"], str),
        "SYNQLAB_LOG_LEVEL": (["logging", "level"], str),
        "SYNQLAB_FOLDX_BINARY_PATH": (["tools", "foldx", "binary_path"], str),
        "SYNQLAB_N_SEQUENCES": (["experiment", "n_sequences"], int),
        "SYNQLAB_TOP_K": (["experiment", "top_k"], int),
        "SYNQLAB_COMPUTE_DEVICE": (["compute", "device"], str),
    }
    result = dict(cfg)
    for env_key, (path, cast) in env_map.items():
        val = os.environ.get(env_key)
        if val is None:
            continue
        node = result
        for part in path[:-1]:
            node = node.setdefault(part, {})
        node[path[-1]] = cast(val)
    return result


def load_config(
    configs_dir: Path | None = None,
    experiment_id: str | None = None,
) -> ExperimentConfig:
    """Load base config, merge local.yaml, apply env vars, and return ExperimentConfig."""
    if configs_dir is None:
        try:
            configs_dir = _find_configs_dir()
        except ConfigError:
            logger.warning("Could not find configs/ dir; using defaults.")
            cfg: dict[str, Any] = {}
        else:
            base_path = configs_dir / _BASE_CONFIG_NAME
            if not base_path.exists():
                raise ConfigError(f"Base config not found: {base_path}")
            cfg = _load_yaml(base_path)
            local_path = configs_dir / _LOCAL_CONFIG_NAME
            if local_path.exists():
                local_cfg = _load_yaml(local_path)
                cfg = _deep_merge(cfg, local_cfg)
    else:
        base_path = Path(configs_dir) / _BASE_CONFIG_NAME
        if not base_path.exists():
            raise ConfigError(f"Base config not found: {base_path}")
        cfg = _load_yaml(base_path)
        local_path = Path(configs_dir) / _LOCAL_CONFIG_NAME
        if local_path.exists():
            local_cfg = _load_yaml(local_path)
            cfg = _deep_merge(cfg, local_cfg)

    cfg = _apply_env_vars(cfg)

    exp = cfg.get("experiment", {})
    db = cfg.get("database", {})
    reg = cfg.get("registry", {})
    art = cfg.get("artifacts", {})
    log = cfg.get("logging", {})
    tools = cfg.get("tools", {})
    compute = cfg.get("compute", {})

    return ExperimentConfig(
        experiment_id=experiment_id or str(uuid.uuid4()),
        n_sequences=int(exp.get("n_sequences", 50)),
        plddt_threshold=float(exp.get("plddt_threshold", 70.0)),
        ddg_threshold=float(exp.get("ddg_threshold", 2.0)),
        top_k=int(exp.get("top_k", 10)),
        use_reranker=bool(exp.get("use_reranker", False)),
        auto_retrain_reranker=bool(exp.get("auto_retrain_reranker", False)),
        registry_path=reg.get("path", "../registry/tools.yaml"),
        artifacts_base_dir=art.get("base_dir", "artifacts"),
        db_url=db.get("url", "postgresql://synqlab:synqlab@localhost:5432/synqlab"),
        log_level=log.get("level", "INFO"),
        foldx_binary_path=tools.get("foldx", {}).get("binary_path", ""),
        compute_device=compute.get("device", "auto"),
    )


_GFP11_CONFIG_NAME = "gfp11.yaml"


def load_gfp11_config(
    configs_dir: Path | None = None,
) -> dict[str, Any]:
    """Load GFP11-specific config with full merge cascade.

    Returns the raw merged dict (not ExperimentConfig) because the GFP11
    agent loop has its own config shape (agent.bounds, brightness,
    stability, knowledge_store) that doesn't map to ExperimentConfig.

    Merge order (highest wins):
      1. Environment variables (SYNQLAB_*)
      2. configs/local.yaml
      3. configs/gfp11.yaml
      4. configs/base.yaml
    """
    if configs_dir is None:
        configs_dir = _find_configs_dir()

    cfg = _load_yaml(configs_dir / _BASE_CONFIG_NAME)

    gfp11_path = configs_dir / _GFP11_CONFIG_NAME
    if gfp11_path.exists():
        cfg = _deep_merge(cfg, _load_yaml(gfp11_path))
    else:
        logger.warning("GFP11 config not found at %s; using base only.", gfp11_path)

    local_path = configs_dir / _LOCAL_CONFIG_NAME
    if local_path.exists():
        cfg = _deep_merge(cfg, _load_yaml(local_path))

    return _apply_env_vars(cfg)

