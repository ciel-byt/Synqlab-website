"""Registry loader — reads registry/tools.yaml and returns ToolDefinition objects."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from synqlab.core.exceptions import RegistryError
from synqlab.core.tool_definition import ToolDefinition
from synqlab.registry.validator import validate_registry

logger = logging.getLogger(__name__)

_KNOWN_FIELDS = {
    "id", "name", "category", "status", "adapter", "adapter_class",
    "execution_mode", "description", "capabilities", "inputs", "outputs",
    "resource_profile", "tags", "notes", "links", "abstract", "meta", "examples",
}


def _parse_registry_file(registry_path: Path) -> list[dict[str, Any]]:
    """Parse a single registry YAML file and return its tools list."""
    try:
        with open(registry_path, "r") as fh:
            raw: dict[str, Any] = yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        raise RegistryError(f"Failed to parse registry YAML: {exc}") from exc

    if not raw or "tools" not in raw:
        raise RegistryError(f"Registry YAML missing top-level 'tools' key: {registry_path}")

    tools_raw: list[dict[str, Any]] = raw["tools"]
    if not isinstance(tools_raw, list):
        raise RegistryError(f"'tools' must be a list in {registry_path}")

    return tools_raw


def load_registry(path: str) -> dict[str, ToolDefinition]:
    """Load and validate the tool registry.

    Args:
        path: Path to the unified ``tools.yaml`` registry file **or** a
              directory containing it. Catalogue tools (entries without an
              ``adapter``) are skipped — they are documentation-only and not
              runtime-loadable.

    Returns:
        Mapping from tool ID to :class:`ToolDefinition`.

    Raises:
        RegistryError: If no file found, unparseable, or fails validation.
    """
    registry_path = Path(path)

    # ── Collect tool entries from the unified registry file ────────────────
    all_entries: list[dict[str, Any]] = []

    if registry_path.is_dir():
        tools_file = registry_path / "tools.yaml"
        if not tools_file.exists():
            raise RegistryError(f"No tools.yaml found in {registry_path.resolve()}")
        logger.info("Loading registry file: %s", tools_file.name)
        all_entries.extend(_parse_registry_file(tools_file))
    elif registry_path.exists():
        all_entries.extend(_parse_registry_file(registry_path))
    else:
        raise RegistryError(f"Registry path not found: {registry_path.resolve()}")

    # ── Build ToolDefinition objects ──────────────────────────────────────
    tools: dict[str, ToolDefinition] = {}
    seen_ids: list[str] = []
    for entry in all_entries:
        if not isinstance(entry, dict):
            raise RegistryError(f"Registry entry is not a mapping: {entry!r}")

        # Catalogue tools have no adapter — documentation-only, not loaded.
        if not entry.get("adapter"):
            logger.debug("Skipping catalogue tool '%s' (no adapter)", entry.get("id", ""))
            continue

        known = {k: v for k, v in entry.items() if k in _KNOWN_FIELDS}
        extra = {k: v for k, v in entry.items() if k not in _KNOWN_FIELDS}
        tool_id = known.get("id", "")

        # Skip duplicate IDs — first definition wins.
        if tool_id in seen_ids:
            logger.debug("Skipping duplicate tool ID '%s' (already loaded)", tool_id)
            continue
        seen_ids.append(tool_id)

        tool = ToolDefinition(
            id=tool_id,
            name=known.get("name", ""),
            category=known.get("category", ""),
            status=known.get("status", ""),
            adapter=known.get("adapter", ""),
            adapter_class=known.get("adapter_class", ""),
            execution_mode=known.get("execution_mode", "sync"),
            description=str(known.get("description", "")).strip(),
            capabilities=list(known.get("capabilities", [])),
            inputs=list(known.get("inputs", [])),
            outputs=list(known.get("outputs", [])),
            resource_profile=dict(known.get("resource_profile", {})),
            tags=list(known.get("tags", [])),
            notes=str(known.get("notes", "")).strip(),
            links=dict(known.get("links", {})),
            abstract=str(known.get("abstract", "")).strip(),
            meta=dict(known.get("meta", {})),
            examples=list(known.get("examples", [])),
            extra=extra,
        )
        tools[tool.id] = tool

    validate_registry(tools)
    logger.info("Loaded %d tools from %s", len(tools), registry_path)
    return tools


def __main__() -> None:
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "../registry/tools.yaml"
    tools = load_registry(path)
    for tool_id, tool in tools.items():
        print(f"{tool_id}: {tool.name} [{tool.status}]")


if __name__ == "__main__":
    __main__()
