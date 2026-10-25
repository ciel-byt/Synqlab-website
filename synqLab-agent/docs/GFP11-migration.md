# Analysis: `feature/gfp11-agent` vs `feat/add-agentic-ai`

## Context

The teammate built an agent system on `feature/gfp11-agent` (currently
checked out locally). The work-in-progress branch `feat/add-agentic-ai`
already contains a different agent system, documented in
`docs/AGENT_ARCHITECTURE.md`. The two systems share the `synqlab.agent`
Python namespace but have very different goals. This document captures the
comparison so we can make a merge decision separately. **No code changes
are proposed here — this is analysis only.**

## A. Branch summary

GFP11 commit chain (last 6, in branch order):

```
61a80e8 Sync helm registry ConfigMap files from canonical registry/
b6dd99a Add GFP11 workflow scripts
c554402 Add GFP11 ReAct agent loop and task config
e140b0b Add GFP11 scientific adapter palette
f584fd8 Add laptop-friendly mock_mode to ESMFold and OmegaFold
4d489b9 Auto-detect columns and persist Knowledge Store in label ingest
```

Diff vs `main`: **30 files changed, +6394 / -154** (per
`git diff --stat main...HEAD`). The branch is built on `main`, **not** on
`feat/add-agentic-ai`. Our chat-server agent system (engine.py, tools/
registry, skills, frontend) is therefore absent from this branch.

Elevator pitch: a single-purpose ReAct optimization loop that iteratively
generates GFP11 sequence variants, folds them, scores brightness +
complex stability, and writes per-round "finding" knowledge artifacts
until a fitness threshold is hit or bounds are exhausted. Driven from
the CLI (`python -m synqlab.agent.loop --config configs/gfp11.yaml`).

## B. What it adds

**Agent system (`synqlab/agent/`, parallel to ours):**

| File | Lines | Role |
|------|-------|------|
| `__init__.py` | ~17 | Module docstring + public re-exports |
| `loop.py` | ~750 | `run_agent(config) -> AgentRunSummary`. ReAct loop with `Bounds` (max_loops, max_tool_calls_per_loop, fitness threshold band, input/output token budgets). Per-round "finding" Knowledge Store artifacts. CLI entry point. |
| `provider.py` | ~400 | `LLMProvider` ABC + `AnthropicProvider`, `OpenAIProvider`, `MockLLMProvider`. Canonical message format. `ScriptedTurn` for testable mock runs. |
| `tools.py` | ~500 | `TOOL_SCHEMAS` (raw OpenAI-style JSON) + `ToolDispatcher` class. Enforces a "PDB-dependency" rule: `score_stability` / `score_interaction` short-circuit if no prior `predict_structure` produced the pdb_path. |

The single-file `tools.py` exposes ~6 tools to the LLM (`tools.py:45-100+`):
`propose_variants`, `predict_structure`, `score_brightness`,
`score_stability`, `score_interaction`, `validate_complex`, `stop`.

**Adapter palette (`synqlab/adapters/`, all new or modified):**

| File | Status | Purpose |
|------|--------|---------|
| `brightness_model.py` | new (~263 ln) | Trained sklearn model wrapping ESM-2 embeddings → `p_hit` + `predicted_brightness` |
| `complex_stability.py` | new (~230 ln) | Folds GFP11+GFP1-10 complex via ESMFold/OmegaFold/AF-Multimer; proxy iPTM = mean pLDDT |
| `pyrosetta.py` | new (~237 ln) | Interface ΔG via ref15 score function |
| `spserver.py` | new (~213 ln) | Calls IRB Barcelona's SPServer for protein-protein interaction scoring |
| `esmfold.py` | modified (+32 ln) | Adds `mock_mode` for laptop dev without GPU |
| `omegafold.py` | modified (+31 ln) | Same |
| `label_ingest.py` | modified (+132 ln) | Auto-detect columns, persist into Knowledge Store |

**Configs / scripts / data:**

- `configs/gfp11.yaml` (104 ln) — task identity, registry path
  (`../registry/v2.yaml`), brightness model paths, stability gate, agent
  bounds, knowledge store paths. Provider configurable
  (`agent.llm_provider: anthropic | openai | mock`).
- `scripts/register_gfp11_target.py` (228 ln)
- `scripts/train_brightness_model.py` (622 ln)
- `scripts/sync_helm_registry.py` (114 ln)
- `scripts/ingest_brightness.py` extensions
- `deploy/helm/synqlab/files/{planned,v1,v2}.yaml` — registry data file
  expansions

**Tests:** ~2000 lines across 7 unit-test files
(`tests/unit/test_agent_loop.py` 597 ln, plus per-adapter tests). Notable
because `feat/add-agentic-ai` has essentially no agent-system unit tests.

## C. What it changes about existing things

Nothing in our chat-server agent stack is touched (it doesn't exist on
this branch). Files that overlap with our branch's scope:

- `synqlab/engine/adapter_resolver.py` — 4-line addition to wire new
  adapter classes into the existing engine resolver.
- `synqlab/adapters/{esmfold,omegafold,label_ingest}.py` — backward-
  compatible additions (mock mode, column auto-detect).
- `synqlab/adapters/__init__.py` — re-export wiring (implicit from the
  diff).

No prompt edits, no router changes, no event-type changes — none of our
6 documented agent types, 14 tools, or WS event vocabulary exists here
to be modified.

## D. Architecture comparison

| Dimension | `feat/add-agentic-ai` (ours) | `feature/gfp11-agent` |
|-----------|------------------------------|-----------------------|
| Purpose | Multi-purpose chat agent platform | Single-purpose ReAct fitness optimizer (GFP11) |
| Entry point | WebSocket + REST chat (`/api/agents/sessions/...`) | CLI `python -m synqlab.agent.loop` |
| Session state | Per-session DB-backed (Postgres tables for sessions, messages, tasks, artifacts) | Stateless run; outputs to Knowledge Store JSON file |
| LLM provider | Hardcoded OpenAI client (`engine.py:247`) | `LLMProvider` ABC, 3 backends (Anthropic / OpenAI / Mock) |
| Tool registry | 14 tools via `AgentTool` / `build_tool` / Pydantic input schemas | ~6 tools via raw `TOOL_SCHEMAS` dict + `ToolDispatcher` class |
| Loop control | `max_turns=25` hard cap inside `engine.submit_message` | `Bounds` dataclass: max_loops, max_tool_calls/loop, fitness band, input + output token budgets |
| Coordination | Coordinator/Worker via `spawn_worker` | None — single agent |
| Skills | Markdown-based, runtime activation (`activate_skill`, `list_skills`, 4 bundled) | Static system prompt loaded from file |
| Frontend | React + WebSocket streaming + InlineArtifactChip | None |
| Mock mode | Not present | First-class (`--mock-llm`, `mock_mode` per adapter) |
| Observability | Token tracker, latency metrics, guardrails | Token bounds enforced; per-round finding artifacts |
| Tests | None for the agent itself | ~2000 ln across 7 files |

## E. Conflict / alignment / extends classification

**CONFLICTS** (cannot coexist without intervention):

1. **Same module namespace, incompatible shapes.** `synqlab/agent/loop.py`
   from GFP11 cannot live next to our `synqlab/agent/engine.py` /
   `tools/` directory unless one is renamed; their `__init__.py` exports
   `run_agent`/`LLMProvider`/`ToolDispatcher`, ours implicitly exports
   `AgentEngine`/`AgentTool`. A naive merge would make both subsystems
   fail to import.
2. **Tool definition style.** GFP11's raw JSON `TOOL_SCHEMAS` + class
   dispatcher does not implement our `AgentToolDef` contract
   (`build_tool`, Pydantic input schema, `is_read_only`,
   `is_concurrency_safe`, `search_hint`). The OpenAI function-call shape
   is the same on the wire — the registry abstractions differ.
3. **Loop semantics.** Their explicit "PDB-dependency rule" (tools.py:13-21)
   has no analogue in our engine — short-circuiting tool calls based on
   prior tool results is a pattern we don't currently support.

**EXTENDS** (compatible additions if integrated):

4. **`LLMProvider` ABC** (provider.py:67-86) — provider-agnostic message
   format with text + tool_calls + token counts + stop_reason. Plug-in
   for our hardcoded OpenAI client would be straightforward.
5. **`MockLLMProvider` / `ScriptedTurn`** — the architectural reason
   their unit tests exist and ours don't.
6. **Adapter palette** — fully orthogonal to our agent system; the four
   new adapters (brightness/complex_stability/pyrosetta/spserver) could
   each become an `AgentTool` in our registry.
7. **Knowledge Store** (per-round findings as JSON-backed artifacts) —
   our `agent_artifacts` table can play the same role; the GFP11 model
   is just a different storage choice for the same data shape.
8. **Mock mode in adapters** — `f584fd8` is a clean, reusable change
   independent of either agent system.

**ALIGNED** (no conflict, drop-in compatible):

9. `configs/gfp11.yaml` is a task overlay; doesn't touch agent code
   directly. Could be loaded by either system.
10. The scripts (`register_gfp11_target`, `train_brightness_model`,
    `sync_helm_registry`) are standalone CLI utilities.
11. Helm registry files (`planned.yaml`, `v1.yaml`, `v2.yaml`) — pure
    data, no code coupling.
12. The label-ingest auto-detect change (`4d489b9`) is independent.

## F. Risks / smells

1. **Namespace collision** is the dominant risk — see CONFLICTS #1.
   Until that's resolved, nothing from `synqlab/agent/` on the GFP11
   branch can land on our branch.
2. **`tools.py:34` imports `synqlab.engine.executor`** — couples the
   agent layer to the engine layer. Our chat agent intentionally does
   not reach into adjacent layers like that.
3. **`configs/gfp11.yaml:65`** — `endpoint: "https://mmb.irbbarcelona.org/SPServer/api"`
   is annotated *"placeholder; confirm with IRB Barcelona"*. SPServer
   integration is not production-ready.
4. **`gfp11.yaml:99`** — `seed_sequence_artifact_id: ""` empty default
   plus hardcoded `linker: "GGGGSGGGGS"`; both should be required /
   validated, not silently accepted as empty strings.
5. **PR review burden.** +6394 LOC in a single branch is hard to review
   safely — natural splits would be: (a) adapters + label-ingest
   change, (b) `LLMProvider` + mock mode, (c) GFP11 agent loop
   + config + scripts.
6. **Tests don't run against our agent system.** Even the ones that
   look generic (e.g. `test_agent_loop.py`) test the GFP11 ReAct loop,
   not our chat engine.

## G. Quick-merge verdict

This branch will **not** merge cleanly into `feat/add-agentic-ai` today.
The `synqlab.agent` namespace collision is a hard blocker — both
subsystems would fail to import side by side without a rename. The
adapter palette, configs, scripts, helm registry data, and the
mock-mode change are independent and could land on any base branch
without touching the agent question.

The interesting architectural question is not which agent system
"wins" — they target different products (chat copilot vs. autonomous
optimization loop) — but which **abstractions** from the GFP11 work
should be lifted into ours: the `LLMProvider` ABC and `MockLLMProvider`
are particularly attractive because they fix two real gaps in our
current code (single-vendor lock-in, untestable engine).

---

## H. Merge difficulty against `docs/AGENT_ARCHITECTURE.md`

This section walks the architecture document section-by-section and
classifies how hard it is to land the GFP11 work without violating any
of the documented contracts.

**Difficulty scale:**

- 🟢 **Trivial** — no code changes to either side; the GFP11 piece is
  already orthogonal.
- 🔵 **Easy** — wrap or rename; <1 day of mechanical work, no behavior
  change.
- 🟡 **Medium** — 1–3 days; requires re-implementing a GFP11 concept on
  top of our abstractions (e.g. registering tools via `build_tool`).
- 🟠 **Hard** — 3+ days; touches engine internals, event protocol, or
  data model.
- 🔴 **Blocker** — cannot land in current shape; requires architectural
  decision before any merge attempt.

### H.1 — Design principles (architecture §"Design Principles", line 33-41)

| Principle | GFP11 alignment | Difficulty |
|-----------|-----------------|------------|
| **Async-first** — "All operations are `async def`" | GFP11 `loop.py` is **synchronous**. `LLMProvider.complete(...)` is a blocking method, `BaseAdapter.run(...)` is sync. | 🟠 Hard. Wrapping GFP11 tools as our `AgentTool` (which expects `async def call`) means awaiting them in a thread pool or rewriting the providers to use `AsyncOpenAI` / `AsyncAnthropic`. ~2 days. |
| **Stateless Engine** | GFP11 carries `Bounds`, `Candidate` lists, and Knowledge Store handles in-process across the loop. `AgentEngine` is intentionally per-session-stateful but does not hold optimization state. | 🟢 Trivial. GFP11's loop state lives in its own module; our `AgentEngine` wouldn't import it. |
| **Pydantic Validation** | GFP11 uses raw JSON tool schemas (`tools.py:45+`) — no Pydantic. | 🟡 Medium. Re-define each of the ~6 GFP11 tools with a Pydantic input schema and `build_tool(...)`. Mechanical, ~1 day for all six. |
| **Event-Driven** — WS streaming | GFP11 has no streaming — `run_agent` returns `AgentRunSummary` after the full run. No `text_delta` or `tool_use_*` events. | 🟠 Hard. To run GFP11 *as a chat session*, the loop must emit our 12 event types. Refactoring `loop.py` to yield events (or wrapping it inside `AgentEngine.submit_message`) is the major piece. ~2-3 days. |
| **Budget-Aware** | GFP11 enforces `token_budget_input` / `token_budget_output` inside `loop.py` directly. Our `BudgetTracker` (architecture §"Budget & Cost Control", line 600-661) does the same per session. | 🟢 Trivial — GFP11 budgets are a SUBSET of what our `BudgetTracker` already tracks; just route GFP11's bounds through `TokenBudget`. |

### H.2 — Three-layer hierarchy (architecture line 68-103)

GFP11 has **no** Coordinator/Worker concept. It runs as a single agent
loop. To use the GFP11 toolbelt from our hierarchy, the natural place
is:

- A `general` or `protein_designer` agent calls the 6 GFP11 tools
  directly (no coordinator needed for single-objective optimization), OR
- A `research_director` spawns a worker (new `gfp11_worker` agent_type)
  that executes the GFP11 loop and reports back.

**Difficulty: 🔵 Easy** — fits our existing model without new
infrastructure. Pick whichever entry is more useful.

### H.3 — Core Components (architecture §"Core Components", line 109-159)

| Component | GFP11 equivalent | Difficulty |
|-----------|------------------|------------|
| `AgentEngine` | `synqlab.agent.loop.run_agent` | 🔴 Blocker — same Python module name `synqlab.agent`. One must be renamed (e.g. GFP11's loop module → `synqlab/agent/gfp11_loop.py`) or absorbed. Without resolution, neither side imports. |
| `AgentContext` | None — GFP11 passes config as a dict | 🟢 Trivial — no conflict. |
| `ToolRegistry` | `synqlab.agent.tools.ToolDispatcher` + `TOOL_SCHEMAS` | 🟡 Medium — re-register the 6 GFP11 tools as `AgentTool` instances. |
| `TaskManager` | None — single-agent | 🟢 Trivial. |
| `BudgetTracker` | Inlined bounds in `loop.py` | 🔵 Easy — switch to our tracker (see H.1 Budget-Aware). |
| `Guardrails` | None | 🟢 Trivial. Our `run_guardrails` already runs on every assistant turn — it'll guardrail GFP11 outputs for free once the loop emits assistant messages. |
| `SkillLoader` | Static system prompt loaded from `synqlab/agent/prompts/gfp11_system.md` | 🔵 Easy — convert their static prompt file into a `gfp11-protocol.skill.md` and register via skill loader. |

### H.4 — Agent types (architecture §"Agent Types", line 162-202)

We document 6 types: `general`, `protein_designer`, `research_director`,
`folding_worker`, `literature_worker`, `analysis_worker`,
`sequence_worker`, `general_worker`. GFP11 introduces **no new type**
out of the box — it runs as a self-contained loop.

To merge: add `gfp11_worker` (or `optimization_worker`) to
`AGENT_SYSTEM_PROMPTS` in `engine.py`. **Difficulty: 🔵 Easy** —
~5 lines.

### H.5 — Autonomy modes (architecture §"Autonomy Modes", line 207-256)

GFP11's loop operates in pure-autonomous mode: the LLM picks tools, the
loop runs them, no checkpoints, no per-tool approval. Our 3 modes
(copilot / supervised / autonomous) wrap exactly this behavior.

**Difficulty: 🟢 Trivial** — running GFP11 as a `protein_designer` /
`gfp11_worker` session in `autonomous` mode is the closest match. If
the user wants checkpoints, our `supervised` mode already provides them
without GFP11 needing to know.

### H.6 — Tool system (architecture §"Tool System", line 263-379)

The wire shape (OpenAI function calling) is identical. The **registry
shape** differs — see H.1 Pydantic Validation. The 6 GFP11 tools map to:

| GFP11 tool | Mapped to | New AgentTool needed? |
|-----------|-----------|------------------------|
| `propose_variants` | New (random point-mutation tool) | Yes |
| `predict_structure` | Closely matches our existing `protein_folding` tool | Maybe extend ours; not strictly new |
| `score_brightness` | New (uses `BrightnessModelAdapter`) | Yes |
| `score_stability` | Overlaps `stability_analysis` (FoldX) but uses PyRosetta — different backend | Yes (separate tool, both useful) |
| `score_interaction` | New (uses `SPServerAdapter`) | Yes |
| `validate_complex` | New (uses `ComplexStabilityAdapter`) | Yes |
| `stop` | We don't have an explicit stop-tool; the model just stops emitting tool calls | Trivial to add |

**Difficulty: 🟡 Medium** — re-defining 5 new tools with Pydantic input
schemas + `build_tool(...)` registration. ~1 day.

### H.7 — Coordinator/Worker pattern (architecture §"Coordinator/Worker Pattern", line 384-433)

GFP11 doesn't use it. If we keep GFP11 as a single-agent loop, no
integration needed. If we want a `research_director` to spawn a
GFP11 sub-task, we'd add `gfp11_worker` to `agent_type` enum and let
the coordinator's existing `spawn_worker` machinery handle it.
**Difficulty: 🟢 Trivial** (don't integrate) or 🔵 Easy (add worker
type).

### H.8 — Execution flow (architecture §"Execution Flow", line 461-533)

Our turn loop: `AgentEngine.submit_message` yields events as the LLM
streams + dispatches tools. GFP11's loop: synchronous, returns the
whole `AgentRunSummary` at the end.

To run GFP11 *as a session*: refactor `run_agent` to yield events
matching our 12 documented types — `text_done` per LLM turn,
`tool_use_start` / `tool_use_done` per tool call, `turn_done` per
round, `session_done` at the end. **Difficulty: 🟠 Hard** — this is
the largest single change. ~2-3 days, mostly mechanical, but every
test that asserts `AgentRunSummary` shape needs updating.

Alternative: **don't run GFP11 as a session.** Keep it as a CLI tool
and only pull abstractions (LLMProvider, mock mode, adapters) into our
chat agent. **Difficulty: 🟢 Trivial.** Most pragmatic path.

### H.9 — Skill system (architecture §"Skill System", line 537-594)

GFP11's static `gfp11_system.md` system prompt becomes a perfect
skill: id `gfp11-protocol`, agent_types `[protein_designer,
research_director]`, tools `[propose_variants, predict_structure,
score_brightness, score_stability, score_interaction,
validate_complex, stop]`. The chat agent can `activate_skill` it on
demand. **Difficulty: 🔵 Easy** — copy the `.md`, add front matter,
done.

### H.10 — Budget & cost control (architecture §"Budget & Cost Control", line 598-661)

Already covered in H.1. GFP11's per-loop bounds map cleanly to
`TokenBudget` per session. **Difficulty: 🟢 Trivial.**

### H.11 — Event streaming (architecture §"Event Streaming", line 665-757)

12 documented event types. GFP11 emits zero — see H.8.
**Difficulty: 🟠 Hard** if running GFP11 as a session;
🟢 Trivial otherwise.

### H.12 — Data models (architecture §"Data Models", line 761-833)

Four tables: `agent_sessions`, `agent_messages`, `agent_tasks`,
`agent_artifacts`. GFP11's Knowledge Store is a JSON file at
`artifacts/knowledge/store.json` — different storage, same data shape
(per-round findings). To run GFP11 as a session, write findings as
`agent_artifacts` rows instead of JSON. **Difficulty: 🔵 Easy** —
~30 lines in the loop's finding-write path. **Bonus: free** —
artifacts then surface in `ArtifactViewer` and as `InlineArtifactChip`
in the chat without extra UI work.

### H.13 — REST/WS API (architecture §"API Reference", line 861-877)

10 REST endpoints + 1 WS. GFP11 adds no endpoints. To run GFP11 as a
session, no new endpoints are needed — `/api/agents/sessions/{id}/message`
already accepts the user's "run a GFP11 round" prompt. **Difficulty:
🟢 Trivial.**

### H.14 — Frontend components (architecture §"Frontend Components")

GFP11 has no frontend. Running it as a session means it inherits the
existing UI for free: `AgentChat` + `AgentToolCall` per tool call +
`InlineArtifactChip` per per-round finding. **Difficulty: 🟢 Trivial**
— UI is automatic if the data model is right.

### H.15 — Aggregate score

| Layer | Worst-case difficulty |
|-------|------------------------|
| Adapter palette + scripts + helm registry data + mock mode | 🟢 Trivial |
| `LLMProvider` ABC + `MockLLMProvider` adoption | 🟡 Medium |
| Re-register 6 GFP11 tools as `AgentTool` instances | 🟡 Medium |
| `gfp11-protocol` skill | 🔵 Easy |
| New `gfp11_worker` agent type (optional) | 🔵 Easy |
| Run GFP11 loop **as a chat session** (full event-stream conversion) | 🟠 Hard |
| Avoid namespace collision (`synqlab.agent.loop`) | 🔴 Blocker until renamed |

### H.16 — Bottom line

Two distinct merge paths, very different cost:

1. **"Lift the abstractions" path** — keep our chat agent, drop
   GFP11's `loop.py`, port adapters + `LLMProvider` + skills + tools
   into our system. **~3-5 days of work, no new architecture.** All
   green/blue/yellow above. The single 🔴 blocker (namespace
   collision) goes away because we don't keep GFP11's `loop.py`.

2. **"Run GFP11 as a session" path** — same as path 1 PLUS refactor
   `loop.py` to yield our 12 event types so it can drive a chat
   session end-to-end. **~5-8 days.** Adds the 🟠 Hard event-stream
   conversion. Pays back with: GFP11 runs become resumable (they're
   sessions), get the chat UI for free, and inherit guardrails +
   budget tracking.

Path 1 is what `feat/add-agentic-ai`'s architecture is designed to
support without modification. Path 2 is the more ambitious "GFP11 lives
inside our chat agent" outcome — it doesn't violate any documented
contract, but it does require GFP11's loop to be event-emitting rather
than batch-returning, which is the single largest engineering item in
the merge.

The namespace collision is the only thing that absolutely cannot ship
as-is. Everything else is "more code, same architecture."

