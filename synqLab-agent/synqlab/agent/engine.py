"""AgentEngine — core LLM query loop with pluggable provider backends.

This is the Python equivalent of Claude Code's ``QueryEngine``.  It:

1. Maintains a message history.
2. Calls the configured LLM provider (OpenAI, Anthropic, or Mock)
   via the ``LLMProvider`` abstraction in a sync-to-async bridge.
3. When the model returns ``tool_calls``, dispatches them to the tool
   registry and feeds results back.
4. Yields streaming events so the caller (API layer) can push them
   to the client over WebSocket.

The engine is intentionally *stateless* beyond a single conversation —
all persistence (DB writes) happens in the API layer, not here.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Optional

from synqlab.agent.provider import (
    AnthropicProvider,
    LLMProvider,
    MockLLMProvider,
    OpenAIProvider,
    ProviderResponse,
    ScriptedTurn,
    ToolCall as ProviderToolCall,
)

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentTool, ToolResult
from synqlab.agent.budget import BudgetStatus, BudgetTracker, TokenBudget
from synqlab.agent.guardrails import run_guardrails

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_MODEL = "gpt-4o"
MAX_TURNS = 25  # hard limit to prevent runaway loops


class AutonomyMode(str, Enum):
    COPILOT = "copilot"          # approve each tool call
    SUPERVISED = "supervised"    # run tools, pause at checkpoints
    AUTONOMOUS = "autonomous"    # full auto


@dataclass
class AgentConfig:
    """Configuration for a single agent session."""

    model: str = DEFAULT_MODEL
    provider: str = "openai"         # "openai" | "anthropic" | "mock"
    api_key: str | None = None       # override env var for provider
    max_turns: int = MAX_TURNS
    system_prompt: str = ""
    temperature: float = 0.1
    autonomy_mode: str = "autonomous"
    checkpoint_interval: int = 3  # for supervised mode
    budget: TokenBudget | None = None  # session token budget


# ---------------------------------------------------------------------------
# Event types (yielded to callers)
# ---------------------------------------------------------------------------

class AgentEventType(str, Enum):
    TEXT_DELTA = "text_delta"            # streaming text chunk
    TEXT_DONE = "text_done"              # final assembled text
    TOOL_USE_START = "tool_use_start"    # tool invocation begins
    TOOL_USE_DONE = "tool_use_done"      # tool invocation result
    TOOL_PROPOSAL = "tool_proposal"      # copilot: proposed tool (needs approval)
    CHECKPOINT = "checkpoint"            # supervised: pause for review
    TASK_SPAWNED = "task_spawned"        # coordinator: worker task created
    TASK_UPDATED = "task_updated"        # coordinator: worker state changed
    TASK_COMPLETED = "task_completed"    # coordinator: worker finished
    BUDGET_WARNING = "budget_warning"    # approaching soft token limit
    BUDGET_EXCEEDED = "budget_exceeded"  # hard token limit reached
    TURN_DONE = "turn_done"              # model finished a turn
    SESSION_DONE = "session_done"        # conversation complete
    ERROR = "error"                      # error event


@dataclass
class AgentEvent:
    """A single event yielded from the engine."""

    type: AgentEventType
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type.value, **self.data}


# ---------------------------------------------------------------------------
# System prompts per agent type
# ---------------------------------------------------------------------------

AGENT_SYSTEM_PROMPTS: dict[str, str] = {
    "general": (
        "You are SynqLab's AI research assistant — a scientific copilot that helps "
        "researchers design proteins, analyze structures, search literature, and "
        "run computational experiments.\n\n"
        "## Your Capabilities\n"
        "You have access to scientific compute nodes (called 'Computers' in the UI) "
        "via function calling. Use them when the "
        "user's request requires computation, data retrieval, or analysis. For "
        "conversational questions, answer directly without calling functions.\n\n"
        "## Terminology — IMPORTANT\n"
        "- The compute capabilities (protgpt2, omegafold, foldx, etc.) are called "
        "**Computers** in the SynqLab UI. Always use 'computers' when referring to "
        "them in conversation. NEVER call them 'tools' or 'computational tools'.\n"
        "- **Skills** = workflow templates / agent instructions.\n"
        "- When the user asks 'what computers do I have?' or 'what can you do?', "
        "list the available computers by their user-facing names:\n"
        "  • **ProtGPT2** — Generate novel protein sequences\n"
        "  • **OmegaFold** — Predict 3D protein structure from sequence\n"
        "  • **ESMFold** — Alternative structure prediction\n"
        "  • **FoldX** — Stability analysis (ΔΔG)\n"
        "  • **SPServer** — Interaction scoring\n"
        "  • **Brightness Scorer** — GFP11 fluorescence prediction\n"
        "  • **Variant Proposer** — Generate mutant variants\n"
        "  • **ProteinMPNN** — Inverse folding / sequence design\n"
        "  • **Literature Search** — PubMed search\n"
        "  Do NOT list internal function names like 'predict_structure' or "
        "'analyze_stability'. Use the friendly computer names above.\n\n"
        "## Guidelines\n"
        "- Always explain your reasoning before invoking a computer.\n"
        "- Summarize results in plain language.\n"
        "- If a computer fails, explain what happened and suggest alternatives.\n"
        "- Cite sources when referencing literature.\n"
        "- Be concise but thorough.\n\n"
        "## Artifacts (reports, files)\n"
        "If the user asks for a report, summary, comparison, write-up, "
        "analysis document, or anything that should be downloadable, you "
        "MUST call the `write_report` tool to persist it. Never write "
        "'[view here]', '[download here]', '[Read more]', 'You can view "
        "and download the report here', 'using the link provided', or "
        "any phrase that implies a clickable link — the chat strips "
        "invalid links so the user sees nothing.\n\n"
        "After `write_report` succeeds, your reply MUST render the full "
        "report content inline as Markdown so the user can read it in "
        "the chat. Start with a one-line confirmation like "
        "'Saved to Session Artifacts as `<filename>`.' then render the "
        "report. Do NOT write 'see the chip below' or reference a chip — "
        "the saved copy appears automatically in the Session Artifacts "
        "panel on the right.\n\n"
        "## When you don't have a result\n"
        "If a computer fails, returns nothing, or you didn't actually call it, "
        "say so plainly. Do not pretend a report or search succeeded, and "
        "do not include sentences that imply a downloadable file exists "
        "when none was produced."
    ),

    "research_director": (
        "You are SynqLab's Research Director — an autonomous coordinator agent "
        "that manages specialist workers to accomplish complex research goals.\n\n"
        "## Your Role\n"
        "You do NOT run experiments directly. Instead, you:\n"
        "1. Classify the user's goal (design / optimize / analyze / review)\n"
        "2. Activate the 'research-director-protocol' skill for detailed workflow instructions\n"
        "3. Spawn specialist workers for each sub-task\n"
        "4. Monitor worker progress with list_tasks\n"
        "5. Enforce quality gates (pLDDT ≥ 70, ΔΔG < +2.0 kcal/mol)\n"
        "6. Synthesize results into a structured report\n\n"
        "## First Steps\n"
        "When you receive a research goal:\n"
        "1. Call `list_skills` to see available protocols\n"
        "2. Call `activate_skill` with id='research-director-protocol'\n"
        "3. Follow the activated protocol step by step\n\n"
        "## Available Computers\n"
        "- spawn_worker: Create a specialist worker (folding, literature, analysis, sequence)\n"
        "- send_message: Send follow-up instructions to a running worker\n"
        "- stop_task: Cancel a running worker\n"
        "- list_tasks: Check status and results of all workers\n"
        "- list_skills: Browse available workflow skills\n"
        "- activate_skill: Load a skill's detailed instructions\n\n"
        "## Worker Types\n"
        "- folding_worker: OmegaFold/ESMFold structure predictions (returns pLDDT)\n"
        "- literature_worker: PubMed literature search (returns citations + summaries)\n"
        "- analysis_worker: FoldX stability analysis (returns ΔΔG values)\n"
        "- sequence_worker: ProtGPT2 sequence generation (returns candidate sequences)\n"
        "- general_worker: General-purpose research tasks\n\n"
        "## Report Format\n"
        "Your final report MUST include: Executive Summary, Methods, "
        "Candidate Ranking Table, Structural Analysis, Stability Analysis, "
        "and Recommendations for experimental validation.\n\n"
        "## Artifacts\n"
        "Any report, summary, comparison, or write-up MUST be produced by "
        "calling `write_report` — never paste report content directly into "
        "the assistant message. Do NOT write '[view here]', '[download here]', "
        "'[Read more]', 'using the link provided', or any phrase implying a "
        "clickable link — the UI strips invalid links so the user sees "
        "nothing. After `write_report` succeeds, reply with one short "
        "sentence pointing at the chip the UI renders. If a tool fails, "
        "say so plainly; never imply a downloadable file exists when one "
        "wasn't produced.\n\n"
        "## When In Doubt\n"
        "- If the goal is ambiguous, ask the user to clarify before spawning workers\n"
        "- If a worker fails, retry once with adjusted parameters\n"
        "- Always call list_tasks before generating the final report\n"
        "- Never conclude without all workers reaching a terminal state"
    ),
    "folding_worker": (
        "You are a protein structure prediction worker for SynqLab. "
        "Your job is to fold protein sequences using the available computers "
        "and report the structural quality metrics (pLDDT, RMSD). "
        "Be precise and include all numeric results."
    ),
    "literature_worker": (
        "You are a scientific literature search worker for SynqLab. "
        "Search PubMed for papers relevant to the research question. "
        "Summarize key findings with citations."
    ),
    "analysis_worker": (
        "You are a stability analysis worker for SynqLab. "
        "Run FoldX ΔΔG analysis on provided structures and report "
        "stability scores with interpretation."
    ),
    "sequence_worker": (
        "You are a sequence generation worker for SynqLab. "
        "Generate protein sequences using ProtGPT2 based on the design "
        "constraints provided. Report generated sequences with metadata."
    ),
    "general_worker": (
        "You are a general-purpose research worker for SynqLab. "
        "Use the available computers to complete the assigned task. "
        "Report results clearly and concisely."
    ),
}


def _get_system_prompt(
    agent_type: str,
    custom_prompt: str = "",
    active_skills: list[Any] | None = None,
    pipeline_mode: bool = False,
    canvas_state: str = "",
) -> str:
    """Resolve the system prompt for a given agent type.

    If active skills are provided, their markdown bodies are appended
    to the system prompt as workflow instructions.
    """
    base = custom_prompt if custom_prompt else AGENT_SYSTEM_PROMPTS.get(
        agent_type, AGENT_SYSTEM_PROMPTS["general"],
    )
    if active_skills:
        for skill in active_skills:
            base += skill.to_system_prompt_extension()

    if not pipeline_mode:
        # Pipeline canvas is not open yet — agent can open it
        base += (
            "\n\n## Pipeline Canvas\n"
            "You have access to a visual pipeline canvas for designing workflows. "
            "If the user wants to create, open, design, or work with pipelines, "
            "call `open_canvas` to open it. This works even with typos or "
            "indirect phrasing — use your judgment.\n"
        )

    if pipeline_mode:
        base += (
            "\n\n## Pipeline Workshop Mode (Active)\n"
            "You are working in split-screen mode with a pipeline canvas visible "
            "to the user on the right side of the screen.\n\n"
            "### Canvas Commands\n"
            "- `open_canvas` — Already open; no-op if called again.\n"
            "- `add_canvas_node` — Add a SINGLE compute node to the canvas. "
            "Use `connect_from` to wire it from an existing node. "
            "PREFER THIS when the user asks to add or modify individual nodes.\n"
            "- `connect_canvas_nodes` — Connect two existing nodes on the canvas.\n"
            "- `save_pipeline` — Save the current canvas as a custom pipeline.\n"
            "- `create_pipeline` — Load a FULL template onto the canvas "
            "(replaces everything). Only use when the user asks for a complete "
            "template like 'create a GFP11 pipeline'.\n\n"
            "### Important Rules\n"
            "- When nodes already exist on the canvas, NEVER use `create_pipeline` "
            "— it would replace them. Use `add_canvas_node` instead.\n"
            "- Pipeline definitions are DESIGNED here, not executed. "
            "Running happens from the Pipelines page after saving.\n"
            "- Always check the Current Canvas State below before deciding "
            "which command to use.\n\n"
            "### Available Computers for Canvas\n"
            "These are the compute nodes (called 'Computers' in the UI) "
            "the user can add to their pipeline:\n"
            "- **protgpt2** — Generate protein sequences (de novo)\n"
            "- **omegafold** — Predict 3D protein structure from sequence\n"
            "- **foldx** — Stability analysis (ΔΔG calculation)\n"
            "- **spserver** — Interaction scoring between protein chains\n"
            "- **score_brightness** — GFP11 fluorescence brightness prediction\n"
            "- **propose_variants** — Generate mutant variants via genetic algorithm\n"
            "- **validate_complex** — Fold multi-chain protein complex\n"
            "- **proteinmpnn** — Inverse folding / sequence design\n"
            "- **literature_search** — Search PubMed/literature\n\n"
            "### Terminology\n"
            "- **Computers** = compute nodes (protgpt2, omegafold, etc.) that run on GPUs/CPUs. "
            "In the UI these are called 'Computers', not 'Tools'. Use this term with the user.\n"
            "- **Skills** = workflow templates / agent instructions (different concept)\n"
            "- When the user asks 'what tools/computers do I have?' or 'list my tools' in pipeline "
            "mode, describe the compute nodes above. Do NOT call `list_skills`.\n"
        )
        if canvas_state:
            base += (
                "\n### Current Canvas State\n"
                f"{canvas_state}\n"
            )
    return base


# ---------------------------------------------------------------------------
# Provider factory
# ---------------------------------------------------------------------------


def _build_llm_provider(config: AgentConfig) -> LLMProvider:
    """Construct the appropriate LLMProvider from AgentConfig."""
    name = config.provider.lower()
    if name == "openai":
        return OpenAIProvider(model=config.model, api_key=config.api_key)
    if name == "anthropic":
        return AnthropicProvider(model=config.model, api_key=config.api_key)
    if name == "mock":
        return MockLLMProvider([ScriptedTurn(text="(mock mode — no script provided)")])
    raise ValueError(
        f"Unknown LLM provider '{config.provider}'. "
        f"Choose from: openai, anthropic, mock"
    )


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class AgentEngine:
    """Owns the query lifecycle for a single agent conversation.

    Mirrors Claude Code's ``QueryEngine`` pattern:
    - One instance per conversation session.
    - ``submit_message()`` starts a new turn.
    - Yields ``AgentEvent`` objects for real-time streaming.
    """

    def __init__(
        self,
        config: AgentConfig,
        tools: list[AgentTool],
        context: AgentContext,
    ):
        self.config = config
        self.tools = {t.name: t for t in tools if t.is_enabled()}
        self.context = context

        # Build the messages array with system prompt.
        self.messages: list[dict[str, Any]] = [
            {"role": "system", "content": _get_system_prompt(
                context.tool_registry.get("agent_type", "general"),
                config.system_prompt,
                pipeline_mode=context.pipeline_mode,
                canvas_state=context.pipeline_canvas_state,
            )},
        ]

        # LLM provider — pluggable backend (OpenAI, Anthropic, Mock).
        self._provider: LLMProvider = _build_llm_provider(config)

        # Usage tracking.
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_tool_calls = 0

        # Latency tracking (R7).
        self.llm_latencies: list[float] = []   # seconds per LLM call
        self.tool_latencies: list[float] = []  # seconds per tool call
        self.latency_threshold_llm = float(os.environ.get("SYNQLAB_LLM_LATENCY_WARN", "30.0"))
        self.latency_threshold_tool = float(os.environ.get("SYNQLAB_TOOL_LATENCY_WARN", "60.0"))

        # Budget enforcement.
        self.budget_tracker = BudgetTracker(config.budget)

    @classmethod
    def with_provider(
        cls,
        provider: LLMProvider,
        config: AgentConfig,
        tools: list[AgentTool],
        context: AgentContext,
    ) -> "AgentEngine":
        """Create an engine with a pre-constructed provider (useful for testing)."""
        engine = cls(config, tools, context)
        engine._provider = provider
        return engine

    # ── Public API ────────────────────────────────────────────────────

    async def submit_message(self, content: str) -> AsyncGenerator[AgentEvent, None]:
        """Submit a user message and yield events until the model stops.

        This is the core loop, equivalent to Claude Code's
        ``QueryEngine.submitMessage()`` → ``query()`` pipeline.
        """
        # Append user message.
        self.messages.append({"role": "user", "content": content})

        # Refresh system prompt with any newly activated skills.
        self.messages[0]["content"] = _get_system_prompt(
            self.context.tool_registry.get("agent_type", "general"),
            self.config.system_prompt,
            active_skills=self.context.active_skills,
            pipeline_mode=self.context.pipeline_mode,
            canvas_state=self.context.pipeline_canvas_state,
        )

        turns = 0
        while turns < self.config.max_turns:
            if self.context.abort:
                yield AgentEvent(type=AgentEventType.ERROR, data={"message": "Session aborted."})
                return

            turns += 1

            # ── Call the LLM ──────────────────────────────────────────
            try:
                t0 = time.perf_counter()
                response = await self._call_llm()
                llm_elapsed = time.perf_counter() - t0
                self.llm_latencies.append(llm_elapsed)
                if llm_elapsed > self.latency_threshold_llm:
                    logger.warning("LLM call latency %.1fs exceeds threshold %.1fs", llm_elapsed, self.latency_threshold_llm)
            except Exception as exc:
                logger.exception("LLM API call failed")
                yield AgentEvent(type=AgentEventType.ERROR, data={"message": str(exc)})
                return

            # _call_llm() now returns ProviderResponse directly.
            # Track usage.
            if response.input_tokens or response.output_tokens:
                self.total_input_tokens += response.input_tokens
                self.total_output_tokens += response.output_tokens

                # Budget enforcement.
                budget_status = self.budget_tracker.record_usage(
                    input_tokens=response.input_tokens,
                    output_tokens=response.output_tokens,
                    model=self.config.model,
                )
                if budget_status == BudgetStatus.SOFT_LIMIT:
                    yield AgentEvent(
                        type=AgentEventType.BUDGET_WARNING,
                        data=self.budget_tracker.usage_summary,
                    )
                elif budget_status == BudgetStatus.HARD_LIMIT:
                    yield AgentEvent(
                        type=AgentEventType.BUDGET_EXCEEDED,
                        data=self.budget_tracker.usage_summary,
                    )
                    return

            # ── Process text content ──────────────────────────────────
            # When this is the final turn (no tool calls), apply guardrails
            # BEFORE emitting text_done so the frontend renders the corrected
            # text once, not "original → correction" as two separate messages.
            final_content = response.text
            guardrail_warnings: list[str] = []
            if response.text and not response.tool_calls:
                final_content, guardrail_warnings = run_guardrails(
                    response.text, self.messages,
                )

            if final_content:
                yield AgentEvent(
                    type=AgentEventType.TEXT_DONE,
                    data={"content": final_content},
                )

            # ── Append assistant message to history ───────────────────
            assistant_msg: dict[str, Any] = {"role": "assistant"}
            if response.text:
                assistant_msg["content"] = response.text
            if response.tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments),
                        },
                    }
                    for tc in response.tool_calls
                ]
            self.messages.append(assistant_msg)

            # ── If no tool calls, we're done ──────────────────────────
            if not response.tool_calls:
                if guardrail_warnings:
                    logger.warning("Guardrail warnings: %s", guardrail_warnings)
                yield AgentEvent(type=AgentEventType.TURN_DONE, data={"reason": "stop"})
                return

            # ── Dispatch tool calls ───────────────────────────────────
            for tool_call in response.tool_calls:
                fn_name = tool_call.name
                self.total_tool_calls += 1

                # ── Copilot mode: propose and wait for approval ───────
                if self.config.autonomy_mode == "copilot":
                    yield AgentEvent(
                        type=AgentEventType.TOOL_PROPOSAL,
                        data={
                            "tool_call_id": tool_call.id,
                            "tool_name": fn_name,
                            "arguments": json.dumps(tool_call.arguments),
                        },
                    )
                    approved = await self.context.wait_for_approval(tool_call.id)
                    if not approved:
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": "Tool call rejected by user.",
                        })
                        yield AgentEvent(
                            type=AgentEventType.TOOL_USE_DONE,
                            data={
                                "tool_call_id": tool_call.id,
                                "tool_name": fn_name,
                                "result": {"rejected": True},
                                "success": False,
                                "error": "Rejected by user",
                            },
                        )
                        continue

                yield AgentEvent(
                    type=AgentEventType.TOOL_USE_START,
                    data={
                        "tool_call_id": tool_call.id,
                        "tool_name": fn_name,
                        "arguments": json.dumps(tool_call.arguments),
                    },
                )

                t0_tool = time.perf_counter()
                result = await self._execute_tool(fn_name, json.dumps(tool_call.arguments))
                tool_elapsed = time.perf_counter() - t0_tool
                self.tool_latencies.append(tool_elapsed)
                if tool_elapsed > self.latency_threshold_tool:
                    logger.warning("Tool '%s' latency %.1fs exceeds threshold %.1fs", fn_name, tool_elapsed, self.latency_threshold_tool)

                # Append tool result message.
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result.data) if result.is_success
                    else f"Error: {result.error_message}",
                })

                yield AgentEvent(
                    type=AgentEventType.TOOL_USE_DONE,
                    data={
                        "tool_call_id": tool_call.id,
                        "tool_name": fn_name,
                        "result": result.data,
                        "success": result.is_success,
                        "error": result.error_message,
                    },
                )

                # ── Supervised mode: checkpoint after N tool calls ────
                if (self.config.autonomy_mode == "supervised"
                        and self.config.checkpoint_interval > 0
                        and self.total_tool_calls % self.config.checkpoint_interval == 0):
                    checkpoint_key = f"checkpoint-{self.total_tool_calls}"
                    yield AgentEvent(
                        type=AgentEventType.CHECKPOINT,
                        data={
                            "checkpoint_id": checkpoint_key,
                            "tool_calls_so_far": self.total_tool_calls,
                            "message": f"Checkpoint: {self.total_tool_calls} tool calls completed. Continue?",
                        },
                    )
                    cont = await self.context.wait_for_approval(checkpoint_key)
                    if not cont:
                        yield AgentEvent(
                            type=AgentEventType.SESSION_DONE,
                            data={"reason": "checkpoint_stopped"},
                        )
                        return

            # Loop continues — model will see tool results and respond.

        # Exceeded max turns.
        yield AgentEvent(
            type=AgentEventType.ERROR,
            data={"message": f"Exceeded maximum turns ({self.config.max_turns})."},
        )

    # ── Private helpers ───────────────────────────────────────────────

    async def _call_llm(self) -> ProviderResponse:
        """Call the LLM provider and return a normalized ProviderResponse.

        The sync provider.complete() is run in a thread to maintain the
        engine's async streaming architecture.
        """
        tools_schema = [t.get_openai_function_schema() for t in self.tools.values()]

        # Extract system prompt from messages[0] for the provider interface.
        system_prompt = ""
        non_system_messages = self.messages
        if self.messages and self.messages[0].get("role") == "system":
            system_prompt = self.messages[0]["content"]
            non_system_messages = self.messages[1:]

        return await asyncio.to_thread(
            self._provider.complete,
            messages=non_system_messages,
            tools=tools_schema,
            system_prompt=system_prompt,
            max_input_tokens=100_000,
            max_output_tokens=4_096,
        )

    async def _execute_tool(self, name: str, arguments_json: str) -> ToolResult:
        """Look up and execute a registered tool."""
        tool = self.tools.get(name)
        if not tool:
            return ToolResult.fail(f"Unknown tool: {name}")

        try:
            parsed_args = json.loads(arguments_json)
        except json.JSONDecodeError as exc:
            return ToolResult.fail(f"Invalid tool arguments: {exc}")

        # Validate against Pydantic schema.
        try:
            validated = tool.input_schema(**parsed_args)
            clean_args = validated.model_dump()
        except Exception as exc:
            return ToolResult.fail(f"Input validation failed: {exc}")

        # Execute.
        start = time.perf_counter()
        try:
            result = await tool.call(clean_args, self.context)
        except Exception as exc:
            logger.exception("Tool '%s' raised an exception", name)
            result = ToolResult.fail(f"Tool execution error: {exc}")

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info("Tool '%s' executed in %.1f ms, success=%s", name, elapsed_ms, result.is_success)
        return result

    @property
    def latency_summary(self) -> dict[str, Any]:
        """Return aggregate latency statistics for this session."""
        llm = self.llm_latencies
        tool = self.tool_latencies
        return {
            "llm_calls": len(llm),
            "llm_avg_ms": (sum(llm) / len(llm) * 1000) if llm else 0,
            "llm_max_ms": (max(llm) * 1000) if llm else 0,
            "llm_total_ms": sum(llm) * 1000,
            "tool_calls": len(tool),
            "tool_avg_ms": (sum(tool) / len(tool) * 1000) if tool else 0,
            "tool_max_ms": (max(tool) * 1000) if tool else 0,
            "tool_total_ms": sum(tool) * 1000,
            "total_ms": (sum(llm) + sum(tool)) * 1000,
        }

