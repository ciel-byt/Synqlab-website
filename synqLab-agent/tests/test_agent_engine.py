"""Tests for the AgentEngine query loop (mocked LLM provider)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.engine import AgentConfig, AgentEngine, AgentEventType
from synqlab.agent.provider import (
    LLMProvider,
    MockLLMProvider,
    ProviderResponse,
    ScriptedTurn,
    ToolCall as ProviderToolCall,
)
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

class SumInput(BaseModel):
    a: int = Field(..., description="First number")
    b: int = Field(..., description="Second number")


async def _sum_call(inputs: dict, ctx: AgentContext) -> ToolResult:
    return ToolResult.ok({"result": inputs["a"] + inputs["b"]})


@pytest.fixture
def sum_tool():
    return build_tool(AgentToolDef(
        name="add_numbers",
        description="Add two numbers",
        input_schema=SumInput,
        call=_sum_call,
    ))


@pytest.fixture
def agent_context():
    return AgentContext(
        session_id="test-session",
        user_id="test-user",
        org_id="test-org",
        tool_registry={"agent_type": "general"},
    )


def _make_text_response(content: str) -> ProviderResponse:
    """Create a ProviderResponse with text content (no tool calls)."""
    return ProviderResponse(
        text=content,
        tool_calls=[],
        input_tokens=100,
        output_tokens=50,
    )


def _make_tool_call_response(tool_name: str, arguments: dict) -> ProviderResponse:
    """Create a ProviderResponse with a tool call."""
    return ProviderResponse(
        text="",
        tool_calls=[ProviderToolCall(
            id="call_123",
            name=tool_name,
            arguments=arguments,
        )],
        input_tokens=100,
        output_tokens=50,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAgentEngine:
    @pytest.mark.asyncio
    async def test_simple_text_response(self, sum_tool, agent_context):
        """Engine yields TEXT_DONE + TURN_DONE for a simple response."""
        config = AgentConfig(model="gpt-4o-test", provider="mock")

        with patch("synqlab.agent.engine._build_llm_provider") as mock_build:
            provider = MockLLMProvider([
                ScriptedTurn(text="Hello! How can I help?", input_tokens=100, output_tokens=50),
            ])
            mock_build.return_value = provider

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            events = []
            async for event in engine.submit_message("Hi"):
                events.append(event)

        types = [e.type for e in events]
        assert AgentEventType.TEXT_DONE in types
        assert AgentEventType.TURN_DONE in types
        text_done = next(e for e in events if e.type == AgentEventType.TEXT_DONE)
        assert text_done.data["content"] == "Hello! How can I help?"

    @pytest.mark.asyncio
    async def test_tool_call_flow(self, sum_tool, agent_context):
        """Engine dispatches tool calls and feeds results back to LLM."""
        config = AgentConfig(model="gpt-4o-test", provider="mock")

        call_count = 0

        def mock_fn(messages, tools):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return ScriptedTurn(
                    tool_calls=[{"name": "add_numbers", "arguments": {"a": 3, "b": 5}}],
                    input_tokens=100, output_tokens=50,
                )
            else:
                return ScriptedTurn(
                    text="The sum of 3 and 5 is 8.",
                    input_tokens=100, output_tokens=50,
                )

        with patch("synqlab.agent.engine._build_llm_provider") as mock_build:
            mock_build.return_value = MockLLMProvider(mock_fn)

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            events = []
            async for event in engine.submit_message("What is 3 + 5?"):
                events.append(event)

        types = [e.type for e in events]
        assert AgentEventType.TOOL_USE_START in types
        assert AgentEventType.TOOL_USE_DONE in types
        assert AgentEventType.TEXT_DONE in types

        # Verify tool was actually executed
        tool_done = next(e for e in events if e.type == AgentEventType.TOOL_USE_DONE)
        assert tool_done.data["result"] == {"result": 8}
        assert tool_done.data["success"] is True

    @pytest.mark.asyncio
    async def test_abort_stops_engine(self, sum_tool, agent_context):
        """Engine respects abort signal."""
        config = AgentConfig(model="gpt-4o-test", provider="mock")
        agent_context.request_abort()

        with patch("synqlab.agent.engine._build_llm_provider") as mock_build:
            mock_build.return_value = MockLLMProvider([
                ScriptedTurn(text="This should not happen"),
            ])

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            events = []
            async for event in engine.submit_message("This should abort"):
                events.append(event)

        assert len(events) == 1
        assert events[0].type == AgentEventType.ERROR
        assert "aborted" in events[0].data["message"].lower()

    @pytest.mark.asyncio
    async def test_unknown_tool_error(self, sum_tool, agent_context):
        """Engine handles calls to unknown tools gracefully."""
        config = AgentConfig(model="gpt-4o-test", provider="mock")

        call_count = 0

        def mock_fn(messages, tools):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return ScriptedTurn(
                    tool_calls=[{"name": "nonexistent_tool", "arguments": {}}],
                    input_tokens=100, output_tokens=50,
                )
            else:
                return ScriptedTurn(
                    text="I encountered an error with that tool.",
                    input_tokens=100, output_tokens=50,
                )

        with patch("synqlab.agent.engine._build_llm_provider") as mock_build:
            mock_build.return_value = MockLLMProvider(mock_fn)

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            events = []
            async for event in engine.submit_message("Use a tool"):
                events.append(event)

        tool_done = next(e for e in events if e.type == AgentEventType.TOOL_USE_DONE)
        assert tool_done.data["success"] is False
        assert "Unknown tool" in tool_done.data["error"]

    @pytest.mark.asyncio
    async def test_usage_tracking(self, sum_tool, agent_context):
        """Engine accumulates token usage across turns."""
        config = AgentConfig(model="gpt-4o-test", provider="mock")

        with patch("synqlab.agent.engine._build_llm_provider") as mock_build:
            mock_build.return_value = MockLLMProvider([
                ScriptedTurn(text="Response", input_tokens=100, output_tokens=50),
            ])

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            async for _ in engine.submit_message("Test"):
                pass

        assert engine.total_input_tokens == 100
        assert engine.total_output_tokens == 50
