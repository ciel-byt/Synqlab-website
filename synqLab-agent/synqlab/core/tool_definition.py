"""ToolDefinition dataclass — mirrors the fields in registry/tools.yaml."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolDefinition:
    """Represents a single tool entry from the registry YAML."""

    id: str
    name: str
    category: str
    status: str
    adapter: str
    adapter_class: str
    execution_mode: str
    description: str = ""
    capabilities: list[str] = field(default_factory=list)
    inputs: list[dict[str, Any]] = field(default_factory=list)
    outputs: list[dict[str, Any]] = field(default_factory=list)
    resource_profile: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    notes: str = ""
    links: dict[str, str] = field(default_factory=dict)
    abstract: str = ""
    meta: dict[str, str] = field(default_factory=dict)
    examples: list[dict[str, Any]] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    def input_names(self) -> list[str]:
        """Return the list of declared input field names."""
        return [inp["name"] for inp in self.inputs]

    def output_names(self) -> list[str]:
        """Return the list of declared output field names."""
        return [out["name"] for out in self.outputs]
