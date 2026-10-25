"""Unit tests for synqlab.core.config."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

from synqlab.core.config import load_config
from synqlab.core.exceptions import ConfigError
from synqlab.core.schemas import ExperimentConfig


def _write_base(tmp_path: Path, data: dict) -> Path:
    cfg_dir = tmp_path / "configs"
    cfg_dir.mkdir()
    (cfg_dir / "base.yaml").write_text(yaml.dump(data))
    return cfg_dir


BASE_DATA = {
    "database": {"url": "postgresql://test:test@localhost/testdb"},
    "experiment": {
        "n_sequences": 20,
        "plddt_threshold": 65.0,
        "ddg_threshold": 3.0,
        "top_k": 5,
        "use_reranker": False,
        "auto_retrain_reranker": False,
    },
    "registry": {"path": "../registry/tools.yaml"},
    "artifacts": {"base_dir": "artifacts"},
    "logging": {"level": "DEBUG"},
    "tools": {"foldx": {"binary_path": ""}},
}


def test_load_config_returns_experiment_config(tmp_path: Path) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    cfg = load_config(configs_dir=cfg_dir)
    assert isinstance(cfg, ExperimentConfig)


def test_load_config_values(tmp_path: Path) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    cfg = load_config(configs_dir=cfg_dir)
    assert cfg.n_sequences == 20
    assert cfg.plddt_threshold == 65.0
    assert cfg.top_k == 5
    assert cfg.log_level == "DEBUG"


def test_load_config_local_yaml_overrides(tmp_path: Path) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    (cfg_dir / "local.yaml").write_text(yaml.dump({"experiment": {"top_k": 99}}))
    cfg = load_config(configs_dir=cfg_dir)
    assert cfg.top_k == 99
    assert cfg.n_sequences == 20  # unchanged


def test_load_config_env_var_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    monkeypatch.setenv("SYNQLAB_DB_URL", "postgresql://env:env@envhost/envdb")
    cfg = load_config(configs_dir=cfg_dir)
    assert cfg.db_url == "postgresql://env:env@envhost/envdb"


def test_load_config_missing_base_raises(tmp_path: Path) -> None:
    empty_dir = tmp_path / "configs"
    empty_dir.mkdir()
    with pytest.raises(ConfigError, match="Base config not found"):
        load_config(configs_dir=empty_dir)


def test_load_config_generates_experiment_id(tmp_path: Path) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    cfg = load_config(configs_dir=cfg_dir)
    assert cfg.experiment_id  # non-empty UUID string


def test_load_config_explicit_experiment_id(tmp_path: Path) -> None:
    cfg_dir = _write_base(tmp_path, BASE_DATA)
    cfg = load_config(configs_dir=cfg_dir, experiment_id="my-exp-001")
    assert cfg.experiment_id == "my-exp-001"
