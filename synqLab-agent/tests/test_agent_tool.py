"""Tests for the agent tool type system and build_tool factory."""

import pytest
from pydantic import BaseModel, Field

from synqlab.agent.tool import (
    AgentTool,
    AgentToolDef,
    ToolResult,
    ToolResultStatus,
    build_tool,
)
from synqlab.agent.context import AgentContext


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

class DummyInput(BaseModel):
    query: str = Field(..., description="A search query")
    max_results: int = Field(default=5)


async def _dummy_call(inputs: dict, ctx: AgentContext) -> ToolResult:
    """Dummy tool call for testing."""
    return ToolResult.ok({"results": [f"result for '{inputs['query']}'"]})


@pytest.fixture
def dummy_tool() -> AgentTool:
    return build_tool(AgentToolDef(
        name="dummy_search",
        description="A dummy search tool for testing",
        input_schema=DummyInput,
        call=_dummy_call,
    ))


@pytest.fixture
def agent_context() -> AgentContext:
    return AgentContext(
        session_id="test-session",
        user_id="test-user",
        org_id="test-org",
    )


# ---------------------------------------------------------------------------
# Tests: ToolResult
# ---------------------------------------------------------------------------

class TestToolResult:
    def test_ok(self):
        result = ToolResult.ok({"key": "value"})
        assert result.is_success
        assert result.status == ToolResultStatus.SUCCESS
        assert result.data == {"key": "value"}
        assert result.error_message is None

    def test_fail(self):
        result = ToolResult.fail("Something went wrong")
        assert not result.is_success
        assert result.status == ToolResultStatus.ERROR
        assert result.error_message == "Something went wrong"
        assert result.data == {}


# ---------------------------------------------------------------------------
# Tests: build_tool
# ---------------------------------------------------------------------------

class TestBuildTool:
    def test_basic_construction(self, dummy_tool):
        assert dummy_tool.name == "dummy_search"
        assert dummy_tool.description == "A dummy search tool for testing"
        assert dummy_tool.input_schema is DummyInput

    def test_defaults_applied(self, dummy_tool):
        """build_tool fills in safe defaults like Claude Code's TOOL_DEFAULTS."""
        assert dummy_tool.is_read_only is False
        assert dummy_tool.is_concurrency_safe is False
        assert dummy_tool.max_result_size_chars == 100_000
        assert dummy_tool.is_enabled()

    def test_custom_overrides(self):
        tool = build_tool(AgentToolDef(
            name="custom",
            description="Custom tool",
            input_schema=DummyInput,
            call=_dummy_call,
            is_read_only=True,
            is_concurrency_safe=True,
            max_result_size_chars=50_000,
        ))
        assert tool.is_read_only is True
        assert tool.is_concurrency_safe is True
        assert tool.max_result_size_chars == 50_000

    def test_openai_function_schema(self, dummy_tool):
        """Tool produces a valid OpenAI function schema."""
        schema = dummy_tool.get_openai_function_schema()
        assert schema["type"] == "function"
        assert schema["function"]["name"] == "dummy_search"
        assert "parameters" in schema["function"]
        params = schema["function"]["parameters"]
        assert params["type"] == "object"
        assert "query" in params.get("properties", {})

    def test_disabled_tool(self):
        tool = build_tool(AgentToolDef(
            name="disabled",
            description="Disabled tool",
            input_schema=DummyInput,
            call=_dummy_call,
            is_enabled=lambda: False,
        ))
        assert not tool.is_enabled()


# ---------------------------------------------------------------------------
# Tests: Tool execution
# ---------------------------------------------------------------------------

class TestToolExecution:
    @pytest.mark.asyncio
    async def test_call_success(self, dummy_tool, agent_context):
        result = await dummy_tool.call({"query": "protein folding"}, agent_context)
        assert result.is_success
        assert "results" in result.data
        assert result.data["results"][0] == "result for 'protein folding'"

    @pytest.mark.asyncio
    async def test_call_with_failing_tool(self, agent_context):
        async def _failing_call(inputs, ctx):
            return ToolResult.fail("Service unavailable")

        tool = build_tool(AgentToolDef(
            name="failing",
            description="A tool that always fails",
            input_schema=DummyInput,
            call=_failing_call,
        ))

        result = await tool.call({"query": "test"}, agent_context)
        assert not result.is_success
        assert "unavailable" in result.error_message


# ---------------------------------------------------------------------------
# Tests: AgentContext
# ---------------------------------------------------------------------------

class TestAgentContext:
    def test_abort(self, agent_context):
        assert not agent_context.abort
        agent_context.request_abort()
        assert agent_context.abort

    def test_identity_fields(self, agent_context):
        assert agent_context.session_id == "test-session"
        assert agent_context.user_id == "test-user"
        assert agent_context.org_id == "test-org"
        assert agent_context.project_id is None
