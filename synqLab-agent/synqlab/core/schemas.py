"""Canonical input/output dataclasses for SynqLab tool calls."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolRequest:
    """Canonical input to any tool adapter."""

    tool_id: str
    inputs: dict[str, Any]
    experiment_id: str
    round_id: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolOutput:
    """Canonical output from any tool adapter."""

    tool_id: str
    outputs: dict[str, Any]
    success: bool = True
    error_message: Optional[str] = None
    latency_ms: Optional[float] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExperimentConfig:
    """Top-level configuration for a SynqLab experiment run."""

    experiment_id: str
    n_sequences: int = 50
    plddt_threshold: float = 70.0
    ddg_threshold: float = 2.0
    top_k: int = 10
    use_reranker: bool = False
    auto_retrain_reranker: bool = False
    registry_path: str = "../registry/tools.yaml"
    artifacts_base_dir: str = "artifacts"
    db_url: str = "postgresql://synqlab:synqlab@localhost:5432/synqlab"
    log_level: str = "INFO"
    foldx_binary_path: str = ""
    compute_device: str = "auto"  # 'auto' | 'cpu' | 'cuda' | 'mps'
    extra: dict[str, Any] = field(default_factory=dict)
