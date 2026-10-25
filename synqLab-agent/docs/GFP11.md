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
