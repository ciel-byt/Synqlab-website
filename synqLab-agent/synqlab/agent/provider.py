"""LLMProvider — pluggable abstraction over chat-with-tools backends.

Three implementations:

  * :class:`AnthropicProvider`  — Claude (anthropic SDK; lazy import).
  * :class:`OpenAIProvider`     — GPT (openai SDK; lazy import).
  * :class:`MockLLMProvider`    — deterministic scripted responses; used by
                                  the unit tests and by ``run_agent(...)`` when
                                  the CLI is invoked with ``--mock-llm``.

A canonical, provider-agnostic message format is used across the agent loop:

    Message = {"role": "system" | "user" | "assistant" | "tool",
               "content": str,
               "tool_calls": [ToolCall] | None,    # assistant only
               "tool_call_id": str | None,         # tool only
               "name": str | None}                 # tool only

Each provider's ``complete(...)`` returns a :class:`ProviderResponse` with the
assistant's text reply, any tool calls, token counts, and a stop reason.
"""

from __future__ import annotations

import abc
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# Canonical types
# ----------------------------------------------------------------------


@dataclass
class ToolCall:
    """A single tool invocation requested by the LLM."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ProviderResponse:
    """Normalized response from any LLMProvider."""

    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    stop_reason: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


# ----------------------------------------------------------------------
# Provider ABC
# ----------------------------------------------------------------------


class LLMProvider(abc.ABC):
    """Abstract LLM backend. Subclasses implement ``complete``."""

    name: str = "abstract"

    @abc.abstractmethod
    def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_prompt: str,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> ProviderResponse:
        """Send messages + tool schemas to the LLM, return one assistant turn."""

    @staticmethod
    def _approx_token_count(text: str) -> int:
        """Cheap stand-in for tokenizer-based counts when none is available."""
        return max(1, len(text) // 4)


# ----------------------------------------------------------------------
# AnthropicProvider
# ----------------------------------------------------------------------


class AnthropicProvider(LLMProvider):
    """Claude backend using the official ``anthropic`` SDK (lazy-imported).

    Args:
        model:    Model id (e.g. ``claude-sonnet-4-5``).
        api_key:  Optional API key (defaults to ``ANTHROPIC_API_KEY`` env var).
    """

    name = "anthropic"

    def __init__(self, model: str, api_key: Optional[str] = None) -> None:
        self._model = model
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self._client: Any = None

    def _ensure_client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            import anthropic  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "AnthropicProvider requires the `anthropic` SDK. "
                "Install via `pip install anthropic` or use --mock-llm."
            ) from exc
        if not self._api_key:
            raise RuntimeError(
                "AnthropicProvider requires ANTHROPIC_API_KEY (or pass api_key=)."
            )
        self._client = anthropic.Anthropic(api_key=self._api_key)
        return self._client

    @staticmethod
    def _to_anthropic_messages(
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Translate canonical messages → Anthropic's content-block format."""
        out: list[dict[str, Any]] = []
        for m in messages:
            role = m["role"]
            if role == "system":
                continue  # system goes in a separate kwarg
            if role == "assistant":
                blocks: list[dict[str, Any]] = []
                if m.get("content"):
                    blocks.append({"type": "text", "text": m["content"]})
                for tc in m.get("tool_calls") or []:
                    tc_id = tc.id if isinstance(tc, ToolCall) else tc["id"]
                    tc_name = (
                        tc.name if isinstance(tc, ToolCall)
                        else tc.get("name") or tc.get("function", {}).get("name", "")
                    )
                    tc_input = (
                        tc.arguments if isinstance(tc, ToolCall)
                        else tc.get("arguments") or tc.get("function", {}).get("arguments", {})
                    )
                    blocks.append({
                        "type": "tool_use",
                        "id": tc_id,
                        "name": tc_name,
                        "input": tc_input,
                    })
                out.append({"role": "assistant", "content": blocks})
            elif role == "tool":
                out.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": m["tool_call_id"],
                        "content": m["content"],
                    }],
                })
            else:  # "user"
                out.append({"role": "user", "content": m["content"]})
        return out

    @staticmethod
    def _to_anthropic_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for t in tools:
            fn = t.get("function", t)
            out.append({
                "name": fn["name"],
                "description": fn.get("description", ""),
                "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
            })
        return out

    def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_prompt: str,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> ProviderResponse:
        client = self._ensure_client()
        api_messages = self._to_anthropic_messages(messages)
        api_tools = self._to_anthropic_tools(tools)
        resp = client.messages.create(
            model=self._model,
            system=system_prompt,
            messages=api_messages,
            tools=api_tools or None,
            max_tokens=max_output_tokens,
        )

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in resp.content:
            block_type = getattr(block, "type", None)
            if block_type == "text":
                text_parts.append(getattr(block, "text", ""))
            elif block_type == "tool_use":
                tool_calls.append(ToolCall(
                    id=getattr(block, "id", str(uuid.uuid4())),
                    name=getattr(block, "name", ""),
                    arguments=dict(getattr(block, "input", {}) or {}),
                ))

        usage = getattr(resp, "usage", None)
        return ProviderResponse(
            text="".join(text_parts),
            tool_calls=tool_calls,
            input_tokens=int(getattr(usage, "input_tokens", 0)) if usage else 0,
            output_tokens=int(getattr(usage, "output_tokens", 0)) if usage else 0,
            stop_reason=getattr(resp, "stop_reason", None),
        )


# ----------------------------------------------------------------------
# OpenAIProvider
# ----------------------------------------------------------------------


class OpenAIProvider(LLMProvider):
    """GPT backend using the official ``openai`` SDK (lazy-imported).

    Mirrors the patterns in ``synqlab.chat.llm`` so OPENAI_API_KEY /
    OPENAI_BASE_URL work the same way.
    """

    name = "openai"

    def __init__(self, model: str, api_key: Optional[str] = None) -> None:
        self._model = model
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._client: Any = None

    def _ensure_client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            from openai import OpenAI  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "OpenAIProvider requires the `openai` SDK. "
                "Install via `pip install openai` or use --mock-llm."
            ) from exc
        if not self._api_key:
            raise RuntimeError("OpenAIProvider requires OPENAI_API_KEY.")
        base_url = os.environ.get("OPENAI_BASE_URL") or None
        self._client = OpenAI(api_key=self._api_key, base_url=base_url)
        return self._client

    @staticmethod
    def _to_openai_messages(
        messages: list[dict[str, Any]], system_prompt: str,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role = m["role"]
            if role == "system":
                continue
            if role == "assistant" and m.get("tool_calls"):
                out.append({
                    "role": "assistant",
                    "content": m.get("content", ""),
                    "tool_calls": [{
                        "id": tc.id if isinstance(tc, ToolCall) else tc["id"],
                        "type": "function",
                        "function": {
                            "name": (
                                tc.name if isinstance(tc, ToolCall)
                                else tc.get("name") or tc.get("function", {}).get("name", "")
                            ),
                            "arguments": json.dumps(
                                tc.arguments if isinstance(tc, ToolCall)
                                else tc.get("arguments") or tc.get("function", {}).get("arguments", "{}")
                            ),
                        },
                    } for tc in m["tool_calls"]],
                })
            elif role == "tool":
                out.append({
                    "role": "tool",
                    "tool_call_id": m["tool_call_id"],
                    "content": m["content"],
                })
            else:
                out.append({"role": role, "content": m.get("content", "")})
        return out

    def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_prompt: str,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> ProviderResponse:
        client = self._ensure_client()
        api_messages = self._to_openai_messages(messages, system_prompt)
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": api_messages,
            "max_tokens": max_output_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        resp = client.chat.completions.create(**kwargs)
        choice = resp.choices[0].message

        tool_calls: list[ToolCall] = []
        for tc in choice.tool_calls or []:
            raw_args = tc.function.arguments or "{}"
            try:
                parsed_args = json.loads(raw_args)
            except json.JSONDecodeError:
                # LLM sometimes produces truncated or malformed JSON.
                # Attempt basic repair: strip trailing commas, close braces.
                repaired = raw_args.rstrip().rstrip(",")
                open_braces = repaired.count("{") - repaired.count("}")
                repaired += "}" * max(0, open_braces)
                try:
                    parsed_args = json.loads(repaired)
                except json.JSONDecodeError:
                    logger.warning(
                        "Could not parse tool arguments for %s (len=%d), using empty dict",
                        tc.function.name, len(raw_args),
                    )
                    parsed_args = {}
            tool_calls.append(ToolCall(
                id=tc.id,
                name=tc.function.name,
                arguments=parsed_args,
            ))

        usage = resp.usage
        return ProviderResponse(
            text=choice.content or "",
            tool_calls=tool_calls,
            input_tokens=int(getattr(usage, "prompt_tokens", 0)) if usage else 0,
            output_tokens=int(getattr(usage, "completion_tokens", 0)) if usage else 0,
            stop_reason=resp.choices[0].finish_reason,
        )


# ----------------------------------------------------------------------
# MockLLMProvider
# ----------------------------------------------------------------------


@dataclass
class ScriptedTurn:
    """A single canned turn returned by :class:`MockLLMProvider`."""

    text: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    stop_reason: Optional[str] = None


class MockLLMProvider(LLMProvider):
    """Deterministic provider — replays a list of :class:`ScriptedTurn` items.

    When a callable is given instead of a list, it is invoked with
    ``(messages, tools)`` for each ``complete`` call and must return a
    :class:`ScriptedTurn`. This lets tests express conditional behaviour
    (e.g. "after the third tool call, emit `stop`") without baking the
    state machine into the production code.
    """

    name = "mock"

    def __init__(
        self,
        script: list[ScriptedTurn] | Callable[
            [list[dict[str, Any]], list[dict[str, Any]]], ScriptedTurn
        ],
    ) -> None:
        self._script = script
        self._idx = 0
        self.calls: list[dict[str, Any]] = []

    def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_prompt: str,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> ProviderResponse:
        self.calls.append({
            "messages": list(messages),
            "tools": list(tools),
            "system_prompt": system_prompt,
        })
        if callable(self._script):
            turn = self._script(messages, tools)
        else:
            if self._idx >= len(self._script):
                turn = ScriptedTurn(text="(out of script)", stop_reason="end_of_script")
            else:
                turn = self._script[self._idx]
            self._idx += 1
        tool_calls = [
            ToolCall(
                id=tc.get("id") or f"tc-{uuid.uuid4().hex[:8]}",
                name=tc["name"],
                arguments=dict(tc.get("arguments", {})),
            )
            for tc in turn.tool_calls
        ]
        in_tokens = turn.input_tokens or self._approx_token_count(
            "\n".join(str(m.get("content", "")) for m in messages)
        )
        out_tokens = turn.output_tokens or self._approx_token_count(turn.text)
        return ProviderResponse(
            text=turn.text,
            tool_calls=tool_calls,
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            stop_reason=turn.stop_reason,
        )
