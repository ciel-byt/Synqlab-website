"""Unit tests for the LLMProvider abstraction (synqlab.agent.provider).

Covers MockLLMProvider scripted turns, ToolCall/ProviderResponse dataclasses,
ABC contract verification, and provider construction. No real API calls are
made — OpenAI/Anthropic providers are tested for construction only (lazy
client init).
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from synqlab.agent.provider import (
    AnthropicProvider,
    LLMProvider,
    MockLLMProvider,
    OpenAIProvider,
    ProviderResponse,
    ScriptedTurn,
    ToolCall,
)


# ------------------------------------------------------------------
# ToolCall dataclass
# ------------------------------------------------------------------


def test_tool_call_fields() -> None:
    tc = ToolCall(id="tc_1", name="predict_structure", arguments={"sequence": "ACDEF"})
    assert tc.id == "tc_1"
    assert tc.name == "predict_structure"
    assert tc.arguments == {"sequence": "ACDEF"}


# ------------------------------------------------------------------
# ProviderResponse dataclass
# ------------------------------------------------------------------


def test_text_response_construction() -> None:
    resp = ProviderResponse(text="Hello, world!", input_tokens=10, output_tokens=5)
    assert resp.text == "Hello, world!"
    assert resp.tool_calls == []
    assert resp.input_tokens == 10
    assert resp.output_tokens == 5


def test_tool_call_response_construction() -> None:
    calls = [
        ToolCall(id="tc_1", name="score_brightness", arguments={"sequence": "AAA"}),
        ToolCall(id="tc_2", name="stop", arguments={"reason": "done"}),
    ]
    resp = ProviderResponse(text="scoring", tool_calls=calls)
    assert len(resp.tool_calls) == 2
    assert resp.tool_calls[0].name == "score_brightness"
    assert resp.tool_calls[1].name == "stop"


# ------------------------------------------------------------------
# MockLLMProvider — scripted turns
# ------------------------------------------------------------------


def _dummy_messages() -> list[dict[str, Any]]:
    return [{"role": "user", "content": "hello"}]


def _dummy_tools() -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": "test", "parameters": {}}}]


def test_scripted_turn_text_response() -> None:
    provider = MockLLMProvider([ScriptedTurn(text="hello there")])
    resp = provider.complete(
        messages=_dummy_messages(),
        tools=_dummy_tools(),
        system_prompt="sys",
        max_input_tokens=1000,
        max_output_tokens=1000,
    )
    assert isinstance(resp, ProviderResponse)
    assert resp.text == "hello there"
    assert resp.tool_calls == []


def test_scripted_turn_tool_call() -> None:
    provider = MockLLMProvider([
        ScriptedTurn(
            text="scoring",
            tool_calls=[{"name": "score_brightness", "arguments": {"sequence": "AAA"}}],
        )
    ])
    resp = provider.complete(
        messages=_dummy_messages(),
        tools=_dummy_tools(),
        system_prompt="sys",
        max_input_tokens=1000,
        max_output_tokens=1000,
    )
    assert len(resp.tool_calls) == 1
    assert resp.tool_calls[0].name == "score_brightness"
    assert resp.tool_calls[0].arguments == {"sequence": "AAA"}
    assert resp.tool_calls[0].id  # should have an auto-generated ID


def test_multiple_turns_replay_in_order() -> None:
    turns = [
        ScriptedTurn(text="first"),
        ScriptedTurn(text="second"),
        ScriptedTurn(text="third"),
    ]
    provider = MockLLMProvider(turns)
    msgs = _dummy_messages()
    tools = _dummy_tools()

    r1 = provider.complete(msgs, tools, "sys", 1000, 1000)
    r2 = provider.complete(msgs, tools, "sys", 1000, 1000)
    r3 = provider.complete(msgs, tools, "sys", 1000, 1000)

    assert r1.text == "first"
    assert r2.text == "second"
    assert r3.text == "third"


def test_exhausted_turns_returns_end_of_script() -> None:
    provider = MockLLMProvider([ScriptedTurn(text="only")])
    msgs = _dummy_messages()
    tools = _dummy_tools()

    provider.complete(msgs, tools, "sys", 1000, 1000)
    # Second call — script exhausted
    resp = provider.complete(msgs, tools, "sys", 1000, 1000)
    assert resp.stop_reason == "end_of_script"


def test_mock_provider_records_calls() -> None:
    provider = MockLLMProvider([ScriptedTurn(text="a")])
    msgs = _dummy_messages()
    tools = _dummy_tools()
    provider.complete(msgs, tools, "sys_prompt", 1000, 1000)
    assert len(provider.calls) == 1
    assert provider.calls[0]["system_prompt"] == "sys_prompt"
    assert provider.calls[0]["tools"] == tools


def test_mock_provider_callable_script() -> None:
    call_count = 0

    def _factory(messages, tools):
        nonlocal call_count
        call_count += 1
        return ScriptedTurn(text=f"call_{call_count}")

    provider = MockLLMProvider(_factory)
    msgs = _dummy_messages()
    tools = _dummy_tools()

    r1 = provider.complete(msgs, tools, "sys", 1000, 1000)
    r2 = provider.complete(msgs, tools, "sys", 1000, 1000)

    assert r1.text == "call_1"
    assert r2.text == "call_2"
    assert call_count == 2


def test_scripted_turn_custom_token_counts() -> None:
    provider = MockLLMProvider([
        ScriptedTurn(text="hi", input_tokens=42, output_tokens=7)
    ])
    resp = provider.complete(_dummy_messages(), _dummy_tools(), "sys", 1000, 1000)
    assert resp.input_tokens == 42
    assert resp.output_tokens == 7


# ------------------------------------------------------------------
# ABC contract
# ------------------------------------------------------------------


def test_mock_provider_implements_abc() -> None:
    provider = MockLLMProvider([ScriptedTurn(text="x")])
    assert isinstance(provider, LLMProvider)


def test_anthropic_provider_implements_abc() -> None:
    provider = AnthropicProvider(model="claude-3-5-sonnet")
    assert isinstance(provider, LLMProvider)
    assert provider.name == "anthropic"


def test_openai_provider_implements_abc() -> None:
    provider = OpenAIProvider(model="gpt-4o")
    assert isinstance(provider, LLMProvider)
    assert provider.name == "openai"


# ------------------------------------------------------------------
# Provider construction (no API calls)
# ------------------------------------------------------------------


def test_anthropic_provider_construction() -> None:
    """Construction should not trigger API calls or import anthropic."""
    provider = AnthropicProvider(model="claude-3-5-sonnet", api_key="sk-test")
    assert provider._model == "claude-3-5-sonnet"
    assert provider._client is None  # lazy init


def test_openai_provider_construction() -> None:
    """Construction should not trigger API calls or import openai."""
    provider = OpenAIProvider(model="gpt-4o", api_key="sk-test")
    assert provider._model == "gpt-4o"
    assert provider._client is None  # lazy init
