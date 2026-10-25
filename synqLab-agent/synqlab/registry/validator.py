"""Registry validator — checks all required fields are present."""

from __future__ import annotations

import logging

from synqlab.core.exceptions import RegistryError
from synqlab.core.tool_definition import ToolDefinition

logger = logging.getLogger(__name__)

_REQUIRED_FIELDS = ("id", "name", "category", "status", "adapter", "adapter_class")


def validate_registry(tools: dict[str, ToolDefinition]) -> None:
    """Validate a dict of ToolDefinitions.

    Raises:
        RegistryError: If any tool is missing required fields or has an empty ID.
    """
    if not tools:
        raise RegistryError("Registry contains no tools.")

    seen_ids: set[str] = set()
    for tool_id, tool in tools.items():
        for field_name in _REQUIRED_FIELDS:
            value = getattr(tool, field_name, None)
            if not value:
                raise RegistryError(
                    f"Tool '{tool_id}' is missing required field '{field_name}'."
                )
        if tool.id in seen_ids:
            raise RegistryError(f"Duplicate tool ID in registry: '{tool.id}'.")
        seen_ids.add(tool.id)

    logger.debug("Registry validation passed (%d tools).", len(tools))
