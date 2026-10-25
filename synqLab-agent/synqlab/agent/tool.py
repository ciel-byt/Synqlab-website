"""Agent tool type system — inspired by Claude Code's buildTool() pattern.

Each agent tool is a self-contained unit with:
- A Pydantic input schema (replaces Zod from Claude Code)
- A `call()` coroutine that executes the tool
- Permission and concurrency metadata
- A description generator for the LLM prompt

Usage:
    tool = build_tool(AgentToolDef(
        name="search_literature",
        description="Search PubMed for papers matching a query",
        input_schema=SearchInput,
        call=search_literature_call,
    ))
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Awaitable, Optional, TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from synqlab.agent.context import AgentContext

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool result
# ---------------------------------------------------------------------------

class ToolResultStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"


@dataclass
class ToolResult:
    """Canonical return from any agent tool call."""

    data: dict[str, Any]
    status: ToolResultStatus = ToolResultStatus.SUCCESS
    error_message: str | None = None

    @classmethod
    def ok(cls, data: dict[str, Any]) -> "ToolResult":
        return cls(data=data, status=ToolResultStatus.SUCCESS)

    @classmethod
    def fail(cls, message: str) -> "ToolResult":
        return cls(data={}, status=ToolResultStatus.ERROR, error_message=message)

    @property
    def is_success(self) -> bool:
        return self.status == ToolResultStatus.SUCCESS


# ---------------------------------------------------------------------------
# Tool definition
# ---------------------------------------------------------------------------

# Type alias for the tool call function signature.
ToolCallFn = Callable[
    [dict[str, Any], "AgentContext"],
    Awaitable[ToolResult],
]


@dataclass
class AgentToolDef:
    """Partial tool definition — mirrors Claude Code's ToolDef<Input, Output>.

    Consumers provide the required fields; ``build_tool()`` fills in defaults.
    """

    name: str
    description: str
    input_schema: type[BaseModel]
    call: ToolCallFn

    # Defaults (mirroring Claude Code's TOOL_DEFAULTS)
    is_enabled: Callable[[], bool] = field(default=lambda: True)
    is_read_only: bool = False
    is_concurrency_safe: bool = False
    max_result_size_chars: int = 100_000
    search_hint: str = ""


@dataclass
class AgentTool:
    """Complete, built tool with all defaults resolved.

    Produced by ``build_tool()`` — never construct directly.
    """

    name: str
    description: str
    input_schema: type[BaseModel]
    call: ToolCallFn
    is_enabled: Callable[[], bool]
    is_read_only: bool
    is_concurrency_safe: bool
    max_result_size_chars: int
    search_hint: str

    # ── Methods ──────────────────────────────────────────────────────

    def get_openai_function_schema(self) -> dict[str, Any]:
        """Return the OpenAI function-calling JSON schema for this tool."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema.model_json_schema(),
            },
        }


def build_tool(definition: AgentToolDef) -> AgentTool:
    """Build a complete AgentTool from a partial definition.

    Mirrors Claude Code's ``buildTool({ ...TOOL_DEFAULTS, ...def })``
    pattern — defaults live in one place.
    """
    return AgentTool(
        name=definition.name,
        description=definition.description,
        input_schema=definition.input_schema,
        call=definition.call,
        is_enabled=definition.is_enabled,
        is_read_only=definition.is_read_only,
        is_concurrency_safe=definition.is_concurrency_safe,
        max_result_size_chars=definition.max_result_size_chars,
        search_hint=definition.search_hint,
    )
