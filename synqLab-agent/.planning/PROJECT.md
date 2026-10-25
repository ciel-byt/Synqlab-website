# SynqLab — Agentic AI Platform for Scientific Research

## What This Is

SynqLab is a **product-grade agentic AI platform** for protein engineering
and computational biology, shipped as **v1.0** on 2026-04-30. Researchers
at biotech companies describe goals in natural language and AI agents
orchestrate the full design pipeline — generate sequences → fold
structures → analyse stability → write reports — through three
configurable autonomy modes (copilot / supervised / autonomous), with a
coordinator/sub-agent pattern, an extensible skill system, real-time
WebSocket streaming, and per-session/org cost controls.

## Core Value

**Autonomous scientific research at scale.** The platform's
differentiator vs. tool-marketplace competitors (e.g., Tamarind Bio) is
*true agent autonomy with sub-agent coordination* — a Research Director
agent that decomposes goals, spawns specialist workers (folding,
literature, stability, sequence), enforces quality gates (pLDDT ≥ 70,
ΔΔG < +2.0 kcal/mol), and synthesises results into reproducible
reports. Validated in v1.0 by an end-to-end demo workflow ("Design a
stable binder for target X").

## Context

### Existing Infrastructure
- **Backend:** FastAPI + PostgreSQL + SQLAlchemy (Python 3.12)
- **Frontend:** React + TypeScript + Vite + Shadcn UI
- **Compute Services:** OmegaFold, ESMFold, ProtGPT2, FoldX, ProteinMPNN, Reranker (Docker microservices)
- **Deployment:** Docker Compose (dev), Helm/K8s (prod)
- **Auth:** JWT-based, multi-org/multi-project tenancy

### Current State (after v1.0 ship)

- **Python LOC:** ~14,579 (synqlab + app + tests + evals)
- **TypeScript LOC:** ~26,456 (frontend/src)
- **Tests passing:** 103 in agent system (was 16 at milestone start)
- **Phases shipped:** 8 of 9 (Phase 9 deferred to M2)
- **Requirements satisfied:** 13/13 in-scope
- **Eval coverage:** `tool_selection.json` (21 cases), workflows, faithfulness scorer, 5 online guardrails
- **Known tech debt:** 10 failing legacy `tests/unit/` tests (V1 orchestrator/registry, predates M1); EVAL-REVIEW G1–G6 gaps deferred to M2

### Competitive Landscape (Tamarind Bio)
- 250+ models via no-code GUI + API
- Structure prediction, design, simulation
- Automated pipelines: tool → filter → simulate workflows
- **Weak on agentic AI** — still exploring, no coordinator/sub-agent system
- Custom model deployment for enterprise clients

### Architecture Inspiration (Claude Code)
- **QueryEngine** → `AgentEngine` (query loop with tool dispatch)
- **Tool + buildTool** → `AgentTool + build_tool()` (Pydantic schemas)
- **Task** → Sub-agent spawning with lifecycle management
- **Coordinator Mode** → Restricted tool set for orchestrating workers
- **Skills System** → Markdown-based skill definitions with YAML frontmatter
- **AppState** → Centralized state management

## Requirements

### Validated (v1.0)

- ✓ **REQ-01** Agent Console UI — v1.0 (Phase 1)
- ✓ **REQ-02** Autonomy Modes (copilot / supervised / autonomous) — v1.0 (Phase 2)
- ✓ **REQ-03** Coordinator Agent — v1.0 (Phase 3)
- ✓ **REQ-04** Sub-Agent Lifecycle — v1.0 (Phase 3)
- ✓ **REQ-05** Skill System — v1.0 (Phase 4)
- ✓ **REQ-06** Streaming Events (WebSocket) — v1.0 (Phase 1)
- ✓ **REQ-07** Multi-User Sessions — v1.0 (Phase 3 → stress-tested in Phase 8)
- ✓ **REQ-08** Research Director Workflow — v1.0 (Phase 5 → chain-tested in Phase 8)
- ✓ **REQ-09** Pipeline Builder — v1.0 (Phase 6)
- ✓ **REQ-10** Agent Artifacts — v1.0 (Phase 5)
- ✓ **REQ-11** Token/Cost Controls — v1.0 (Phase 7) — *org-level aggregation deferred to M2*
- ✓ **REQ-12** Batch Processing — v1.0 (Phase 6)
- ✓ **REQ-13** Agent Templates — v1.0 (Phase 7)

## Current Milestone: v1.2 Productionize Artifacts and Data Storages

**Goal:** Segment `data/agent_artifacts/` from a flat dump into properly namespaced subdirectories.

**Target features:**
- Namespaced artifact directory structure (sessions, pipelines, folding, sandbox, bundled)
- Update all writers (adapters, tools, pipeline engine) to use the new paths
- Backward-compatible migration for existing flat files
- Consistent path resolution across Docker mounts and local dev

### Active

### Deferred to Milestone 2

- **Production observability** — Arize Phoenix tracing, org-level metrics endpoint, session outcome tracking, Promptfoo CI/CD eval regression *(originally Phase 9, skipped 2026-04-30)*
- **REQ-14** Skill Marketplace — community skill discovery
- **REQ-15** Agent Memory — cross-session learning
- **Domain-expert eval review** (EVAL-REVIEW G6)
- **`--live` eval validation** against real OpenAI (EVAL-REVIEW G5)
- **Legacy `tests/unit/` repair** — 10 failing V1 orchestrator/registry tests

### Out of Scope

- GPU infrastructure management (defer to existing Docker/K8s services) — *still valid*
- Custom model training (use pre-trained models via services) — *still valid*
- On-premise deployment (cloud-first for now) — *still valid*
- Real-time 3D molecular visualization (separate frontend concern) — *still valid*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenAI as LLM provider | Native function calling, proven reliability | ✓ Good (v1.0) |
| Python/FastAPI for agent backend | Matches existing stack, async-native | ✓ Good (v1.0) |
| Coordinator/Worker pattern (from Claude Code) | Proven at scale, clean separation of concerns | ✓ Good (v1.0) |
| Pydantic for tool schemas (replacing Zod) | Python-native, excellent validation, auto-generates OpenAI schemas | ✓ Good (v1.0) |
| Three autonomy modes | Different researchers have different comfort levels | ✓ Good (v1.0) |
| Skills as markdown files with YAML frontmatter | Maximum portability, easy for researchers to create | ✓ Good (v1.0) |
| WebSocket for streaming (not SSE) | Already implemented, bidirectional comm needed for abort | ✓ Good (v1.0) |
| Skip Phase 9 production observability for v1.0 | Functional scope already complete; observability is operational tooling, not user-facing | — Pending (revisit at M2) |
| In-memory `_active_engines` registry | Simple for single-node; will need Redis/distributed on scale | ⚠️ Revisit (M2 if multi-node) |
| `httpx.ASGITransport` + temp SQLite for E2E tests | Avoids server boot, deterministic, no real DB | ✓ Good (Phase 8) |

## Constraints

- LLM provider is OpenAI (no Anthropic/local model support yet — would
  require provider abstraction)
- Tool catalogue is built-in (no plugin/MCP discovery yet — REQ-14
  marketplace is the M2 path)
- Single-node deployment assumed for in-process state
  (`_active_engines`, `TaskManager`)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-05 — milestone v1.2 started*
