# SynqLab Agent Architecture

> A comprehensive guide to the multi-agent autonomous task system for scientific research.

---

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Core Components](#core-components)
4. [Agent Types](#agent-types)
5. [Autonomy Modes](#autonomy-modes)
6. [Tool System](#tool-system)
7. [Coordinator/Worker Pattern](#coordinatorworker-pattern)
8. [Execution Flow](#execution-flow)
9. [Skill System](#skill-system)
10. [Budget & Cost Control](#budget--cost-control)
11. [Event Streaming](#event-streaming)
12. [Data Models](#data-models)

---

## Overview

SynqLab's agent system is a **multi-agent autonomous task system** designed for scientific research workflows. It enables AI agents to:

- Execute complex protein engineering workflows autonomously
- Coordinate multiple specialist workers for parallel processing
- Integrate with 14+ scientific tools (folding, sequence generation, stability analysis)
- Provide configurable human oversight (copilot, supervised, autonomous modes)

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Async-first** | All operations are `async def`, enabling concurrent tool execution |
| **Stateless Engine** | AgentEngine holds no persistent state; all data in PostgreSQL |
| **Pydantic Validation** | Type-safe tool inputs with automatic error recovery |
| **Event-Driven** | Real-time WebSocket streaming to frontend |
| **Budget-Aware** | Token limits enforced at session and organization levels |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYNQLAB AGENT SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │   Frontend  │    │   REST API  │    │   Agent     │    │   External  │   │
│  │   (React)   │◄──►│  (FastAPI)  │◄──►│   Engine    │◄──►│   Services  │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│        │                  │                  │                  │           │
│        │ WebSocket        │ HTTP             │ Tool Calls       │ HTTP      │
│        ▼                  ▼                  ▼                  ▼           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │   Event     │    │  PostgreSQL │    │   OpenAI    │    │  OmegaFold  │   │
│  │   Stream    │    │   Database  │    │   GPT-4o    │    │  ProtGPT2   │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    │  FoldX      │   │
│                                                           │  ESMFold    │   │
│                                                           └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Three-Layer Agent Hierarchy

```
                    ┌────────────────────────┐
                    │   COORDINATOR AGENT    │
                    │   (Research Director)  │
                    │                        │
                    │  • Orchestrates tasks  │
                    │  • Spawns workers      │
                    │  • Synthesizes results │
                    └───────────┬────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │ WORKER AGENT  │   │ WORKER AGENT  │   │ WORKER AGENT  │
    │ (Folding)     │   │ (Stability)   │   │ (Sequence)    │
    │               │   │               │   │               │
    │ • OmegaFold   │   │ • FoldX       │   │ • ProtGPT2    │
    │ • ESMFold     │   │ • ΔΔG calc    │   │ • Design      │
    └───────────────┘   └───────────────┘   └───────────────┘
            │                   │                   │
            └───────────────────┴───────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     TOOL REGISTRY     │
                    │                       │
                    │  14+ Scientific Tools │
                    │  • protein_folding    │
                    │  • sequence_generation│
                    │  • stability_analysis │
                    │  • literature_search  │
                    │  • ...                │
                    └───────────────────────┘
```

---

## Core Components

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         synqlab/agent/                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │ AgentEngine  │────►│ AgentContext │────►│ ToolRegistry │             │
│  │              │     │              │     │              │             │
│  │ • LLM loop   │     │ • Session    │     │ • 14+ tools  │             │
│  │ • Turn mgmt  │     │   state      │     │ • Pydantic   │             │
│  │ • Streaming  │     │ • Messages   │     │   validation │             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│         │                    │                    │                     │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐         │
│  │ TaskManager  │     │ BudgetTracker│     │   Guardrails     │         │
│  │              │     │              │     │                  │         │
│  │ • Spawn      │     │ • Token      │     │ • Numerical      │         │
│  │   workers    │     │   limits     │     │   claim check    │         │
│  │ • Lifecycle  │     │ • Cost calc  │     │ • Dead-artifact  │         │
│  │              │     │              │     │   claim strip    │         │
│  └──────────────┘     └──────────────┘     └──────────────────┘         │
│         │                    │                    │                     │
│         └────────────────────┼────────────────────┘                     │
│                              │                                          │
│                              ▼                                          │
│                    ┌──────────────────┐                                 │
│                    │   SkillLoader    │                                 │
│                    │                  │                                 │
│                    │ • Load .skill.md │                                 │
│                    │ • Inject prompts │                                 │
│                    └──────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | File | Purpose |
|-----------|------|---------|
| AgentEngine | `synqlab/agent/engine.py` | Core LLM loop with OpenAI function calling |
| AgentContext | `synqlab/agent/context.py` | Per-session state isolation |
| ToolRegistry | `synqlab/agent/tool.py` | Tool type system with `AgentTool` & `build_tool()` |
| TaskManager | `synqlab/agent/task.py` | Coordinator → worker lifecycle management |
| BudgetTracker | `synqlab/agent/budget.py` | Token/cost tracking and limits |
| Guardrails | `synqlab/agent/guardrails.py` | Post-response validation: numerical-claim grounding + dead-artifact-claim stripping |
| SkillLoader | `synqlab/agent/skill.py` | Markdown-based skill system |
| Models | `synqlab/agent/models.py` | SQLAlchemy ORM (sessions, messages, tasks) |

---

## Agent Types

Six specialized agent profiles, each with a custom system prompt:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT TYPES                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  COORDINATORS                          WORKERS                          │
│  ════════════                          ═══════                          │
│                                                                         │
│  ┌─────────────────────┐               ┌─────────────────────┐          │
│  │  research_director  │               │   folding_worker    │          │
│  │                     │               │                     │          │
│  │  • Spawns workers   │               │  • OmegaFold        │          │
│  │  • Orchestrates     │───spawns────► │  • ESMFold          │          │
│  │  • Synthesizes      │               │  • Structure pred   │          │
│  └─────────────────────┘               └─────────────────────┘          │
│                                                                         │
│  GENERAL PURPOSE                       ┌─────────────────────┐          │
│  ═══════════════                       │  stability_worker   │          │
│                                        │                     │          │
│  ┌─────────────────────┐               │  • FoldX ΔΔG        │          │
│  │      general        │               │  • Mutation scan    │          │
│  │                     │               └─────────────────────┘          │
│  │  • Scientific       │                                                │
│  │    copilot          │               ┌─────────────────────┐          │
│  │  • Diverse tasks    │               │   sequence_worker   │          │
│  └─────────────────────┘               │                     │          │
│                                        │  • ProtGPT2         │          │
│  ┌─────────────────────┐               │  • Sequence design  │          │
│  │  protein_designer   │               └─────────────────────┘          │
│  │                     │                                                │
│  │  • De novo design   │                                                │
│  │  • Generate→Fold→   │                                                │
│  │    Validate         │                                                │
│  └─────────────────────┘                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Autonomy Modes

Three configurable control levels for human oversight:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AUTONOMY MODES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  COPILOT MODE                 SUPERVISED MODE           AUTONOMOUS MODE │
│  ════════════                 ═══════════════           ═══════════════ │
│                                                                         │
│  User ──────► Agent        User ──────► Agent         User ─────► Agent |
│       │                            │                          │         │
│       │ "Analyze this"             │ "Design protein"         │ "Full   │
│       │                            │                          │  auto"  │
│       ▼                            ▼                          ▼         │
│  ┌─────────┐                 ┌─────────┐                ┌─────────┐     │
│  │ PROPOSE │                 │  RUN    │                │  RUN    │     │
│  │  tool   │                 │ tools   │                │ tools   │     │
│  └────┬────┘                 └────┬────┘                └────┬────┘     │
│       │                           │                          │          │
│       ▼                           ▼                          │          │
│  ┌─────────┐                 ┌──────-───┐                    │          │
│  │ AWAIT   │                 │CHECKPOINT│                    │          │
│  │ approval│                 │ (3 turns)│                    │          │
│  └────┬────┘                 └────┬──-──┘                    │          │
│       │                           │                          │          │
│  ┌────┴────┐                 ┌────┴────┐                     │          │
│  │Approve? │                 │Continue?│                     │          │
│  └────┬────┘                 └────┬────┘                     │          │
│   Yes │ No                    Yes │ No                       │          │
│       │  │                      │   │                        │          │
│       ▼  ▼                      ▼   ▼                        ▼          │
│    Execute Stop              Continue Stop             ┌─────────┐      │
│                                                        │COMPLETE │      │
│  Max control              Balanced                     │(25 turns│      │
│  Each tool                Human review                 │  limit) │      │
│  approved                 at intervals                 └─────────┘      │
│                                                        Full auto        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mode Comparison

| Aspect | Copilot | Supervised | Autonomous |
|--------|---------|------------|------------|
| Tool approval | Each tool | Automatic | Automatic |
| Checkpoints | N/A | Every 3 turns | None |
| Max turns | Unlimited | 25 | 25 |
| Use case | Critical research | Standard workflow | Batch processing |

---

## Tool System

### Tool Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TOOL SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │   AgentToolDef   │  Definition (name, description, input schema)     │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ build_tool()                                                │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │    AgentTool     │  Wrapper with metadata + handler                  │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ invoke(input, context)                                      │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │    ToolResult    │  {data, status, error_message}                    │
│  └──────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14 Built-in Tools

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOOL REGISTRY                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCIENCE TOOLS (7)                    COORDINATOR TOOLS (4)             │
│  ═════════════════                    ═════════════════════             │
│                                                                         │
│  ┌─────────────────┐                 ┌─────────────────┐                │
│  │ protein_folding │ OmegaFold       │  spawn_worker   │ Create worker  │
│  ├─────────────────┤ ESMFold         ├─────────────────┤                │
│  │ sequence_gen    │ ProtGPT2        │  send_message   │ Instruct       │
│  ├─────────────────┤                 ├─────────────────┤ worker         │
│  │ stability_      │ FoldX ΔΔG       │  stop_task      │ Cancel worker  │
│  │ analysis        │                 ├─────────────────┤                │
│  ├─────────────────┤                 │  list_tasks     │ Get status     │
│  │ literature_     │ PubMed/         └─────────────────┘                │
│  │ search          │ bioRxiv                                            │
│  ├─────────────────┤                  SKILL TOOLS (2)                   │
│  │ read_artifact   │ Load outputs    ═══════════════                    │
│  ├─────────────────┤                                                    │
│  │ write_report    │ Markdown        ┌─────────────────┐                │
│  ├─────────────────┤                 │  list_skills    │ Browse         │
│  │ save_artifact   │ Persist files   ├─────────────────┤                │
│  └─────────────────┘                 │  activate_skill │ Load skill     │
│                                      └─────────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tool I/O Contract (Phase 13)

Path-consuming tools accept **`artifact_id`** (a string handle), not filesystem
paths. The gateway resolves the handle to a `file_path` via the
`agent_artifacts` table before forwarding the request to a downstream tool
service. The LLM never sees a filesystem path.

Example: `analyze_stability` no longer accepts `pdb_path`. Its input schema is:

```python
class StabilityAnalysisInput(BaseModel):
    artifact_id: str = Field(
        ...,
        description=(
            "Artifact handle for the PDB structure to analyze. Use "
            "list_pdb_samples to discover bundled samples, or pass the "
            "artifact_id returned by predict_structure. Filesystem paths "
            "are not accepted."
        ),
    )
    mutations: list[str] = Field(
        default_factory=list,
        description="Optional list of mutations to evaluate (e.g. ['A42G']).",
    )
```

**Discovery:** an LLM that needs a PDB calls `list_pdb_samples` (returns
`scope='global'` bundled rows) or inspects the session's existing artifact
list; it never composes filesystem paths.

### Auto-Persistence

Tools that produce file-typed output above the inline threshold
(**100 KB**; PDB / FASTA / CSV) auto-persist via the canonical helper:

```python
from synqlab.agent.tools._persist import persist_artifact

artifact_id = await persist_artifact(
    content=pdb_text,
    name=f"fold_{run_id}.pdb",
    artifact_type="pdb_structure",
    ctx=context,
)
```

The result includes `artifact_id` in `ToolResult.ok({...})`, which triggers
`useAgentSession.refreshArtifacts()` on the frontend so a chip appears inline
immediately. Inline scalars (pLDDT, ΔΔG, citation lists) stay in the tool
result JSON; no row, no chip.

Today's auto-persisting producers: `predict_structure` (OmegaFold/ESMFold
PDB output), `write_report` (markdown), `save_artifact` (any tool-author-
provided content). `_persist.py` is the single canonical owner of
`ARTIFACT_DIR`, `_INLINE_LIMIT`, `_CONTENT_TYPES`, and `_EXTENSIONS` — every
other tool imports these constants rather than redefining them.

### Artifact Scopes

Phase 13 introduces a three-tier scope model on the `agent_artifacts` table:

| Scope       | Owner                  | Lifecycle                                                                                           |
|-------------|------------------------|-----------------------------------------------------------------------------------------------------|
| `session`   | A specific agent session | Created by `save_artifact`, auto-persist, or user upload. Visible only to that session.            |
| `project`   | A project              | Created by promoting a session-scoped row (`POST /api/agents/artifacts/{id}/promote`). Visible to every session in that project. |
| `global`    | All sessions          | Created at app boot by the FastAPI lifespan handler ingesting `resources/pdb_samples/*.pdb`. Idempotent by SHA-256 `content_hash`. |

The list endpoint `GET /api/agents/sessions/{id}/artifacts` returns the
union of: this session's rows, the session project's `scope='project'`
rows, and all `scope='global'` rows. Each row carries the `scope` field.
The frontend `ArtifactViewer` partitions by scope into three labeled
sections (**Session Artifacts**, **Project Datasets**, **Bundled Samples**).

A dedicated project-only feed at `GET /api/agents/datasets?project_id=...`
backs the `/lab/agents/datasets` page (no session context required).

### Cross-Service File Access

Gateway and every path-consuming tool service mount the same host
directory at `/app/data/agent_artifacts`:

- **docker-compose:** bind-mount `./data/agent_artifacts:/app/data/agent_artifacts`
  on the gateway and on every path-consuming tool (`foldx-svc`,
  `proteinmpnn-svc`, `omegafold-svc`, `esmfold-svc`, `protgpt2-svc`).
- **Helm:** GCS Fuse CSI volume `agent-artifacts` mounting the
  `agent_artifacts/` sub-directory of the assets bucket on the gateway
  deployment and the tools deployment template.

The env var `SYNQLAB_ARTIFACT_DIR=/app/data/agent_artifacts` aligns the
gateway's writes with the tool services' reads (set via compose
`x-app-env`, Helm gateway ConfigMap, and per-tool `env:` map). Tool
services do **not** talk to the database; they read what the gateway
resolved and forwarded.

### Tool Execution Flow (Phase 13)

```
LLM → tool call (artifact_id)
        ↓
Gateway: resolve artifact_id → AgentArtifact row → file_path
        ↓
Gateway: visibility check (session vs project vs global)
        ↓
Gateway: HTTP POST {inputs.pdb_path: <resolved>} → tool-svc
        ↓
Tool-svc: read /app/data/agent_artifacts/<...> from shared mount
        ↓
Tool-svc: write outputs to same shared mount (if applicable)
        ↓
Gateway: read outputs, persist via persist_artifact()
        ↓
LLM receives ToolResult.ok({"artifact_id": <new>, ...})
```

Visibility check rules (enforced at the tool layer in
`stability_analysis._call` and at the HTTP layer in
`app/routers/agents.py`):

- `scope == "session"` → row's `session_id` MUST match the calling
  session's id (else `not accessible`).
- `scope == "project"` → caller's `project_id` MUST match the row's
  `project_id` (else `not accessible`).
- `scope == "global"` → unconditionally visible.

The legacy Pydantic-validation / mode-handling steps (Copilot proposal,
Supervised checkpoint, budget tally) still run before and after this
flow — see `Execution Flow` below for the full message-processing path.

### Phase 13 Decisions

The locked decision register for the orchestration / data-flow contract
(D-01 through D-14) lives at
`.planning/phases/13-tool-orchestration-data-flow/13-CONTEXT.md`. Notable
constraints carried into the architecture:

- **D-05/D-06/D-13:** `artifact_id` is the only handle the LLM ever
  manipulates; `pdb_path` is removed from the tool schema with no
  backwards-compat union.
- **D-12/D-14:** the shared mount is declared on every path-consuming
  service; tool services do not touch the DB.
- **D-04:** bundled `pdb_samples/*.pdb` are ingested at lifespan startup
  as `scope='global'` rows, idempotent by SHA-256 `content_hash`.
- **D-08/D-10:** Datasets are `agent_artifacts` rows with
  `scope='project'`, created by promoting a session row. Promote is COPY,
  not MOVE — the source `file_path` is shared.

---

## Coordinator/Worker Pattern

### How Coordination Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COORDINATOR/WORKER PATTERN                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     RESEARCH DIRECTOR                           │    │
│  │                     (Coordinator Agent)                         │    │
│  │                                                                 │    │
│  │  1. Receive complex request                                     │    │
│  │     "Design a stable binder for target X"                       │    │
│  │                                                                 │    │
│  │  2. Plan workflow & spawn workers                               │    │
│  │     spawn_worker(agent_type="sequence_worker", goal="...")      │    │
│  │     spawn_worker(agent_type="folding_worker", goal="...")       │    │
│  │     spawn_worker(agent_type="stability_worker", goal="...")     │    │
│  │                                                                 │    │
│  │  3. Monitor progress                                            │    │
│  │     list_tasks() → see all worker statuses                      │    │
│  │                                                                 │    │
│  │  4. Send follow-up instructions                                 │    │
│  │     send_message(task_id, "Try higher temperature...")          │    │
│  │                                                                 │    │
│  │  5. Synthesize results                                          │    │
│  │     Combine worker outputs into final report                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                    │
│              ┌─────────────────────┼─────────────────────┐              │
│              │                     │                     │              │
│              ▼                     ▼                     ▼              │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐      │
│  │  SEQUENCE WORKER  │ │  FOLDING WORKER   │ │  STABILITY WORKER │      │
│  │                   │ │                   │ │                   │      │
│  │  Goal: Generate   │ │  Goal: Predict    │ │  Goal: Calculate  │      │
│  │  10 variants      │ │  structures       │ │  ΔΔG scores       │      │
│  │                   │ │                   │ │                   │      │
│  │  Uses:            │ │  Uses:            │ │  Uses:            │      │
│  │  • ProtGPT2       │ │  • OmegaFold      │ │  • FoldX          │      │
│  │  • sequence_gen   │ │  • protein_fold   │ │  • stability_anal │      │
│  │                   │ │                   │ │                   │      │
│  │  Returns:         │ │  Returns:         │ │  Returns:         │      │
│  │  • 10 sequences   │ │  • PDB files      │ │  • ΔΔG values     │      │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Task State Machine

```
                    ┌─────────────────┐
                    │     PENDING     │
                    │   (Created)     │
                    └────────┬────────┘
                             │
                             │ Worker starts
                             ▼
                    ┌─────────────────┐
                    │     RUNNING     │
                    │   (Executing)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  COMPLETED  │  │   FAILED    │  │   KILLED    │
     │  (Success)  │  │   (Error)   │  │ (Cancelled) │
     └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Execution Flow

### Complete Message Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE EXECUTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐                                                       │
│  │   FRONTEND   │  User types message                                   │
│  │   (React)    │                                                       │
│  └──────┬───────┘                                                       │
│         │                                                               │
│         │ POST /api/agents/sessions/{id}/message                        │
│         ▼                                                               │
│  ┌──────────────┐                                                       │
│  │   REST API   │  app/routers/agents.py                                │
│  │   (FastAPI)  │                                                       │
│  └──────┬───────┘                                                       │
│         │                                                               │
│         │ Retrieve AgentEngine from registry                            │
│         ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      AGENT ENGINE LOOP                           │   │
│  │                      (turns = 1..25)                             │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │                                                            │  │   │
│  │  │  1. Build system prompt (agent type + active skills)       │  │   │
│  │  │                                                            │  │   │
│  │  │  2. Call OpenAI Chat Completions API (streaming)           │  │   │
│  │  │     └─► Emit text_delta events                             │  │   │
│  │  │                                                            │  │   │
│  │  │  3. Parse tool_use blocks from response                    │  │   │
│  │  │                                                            │  │   │
│  │  │  4. Mode-specific handling:                                │  │   │
│  │  │     ├─ Copilot:    Emit tool_proposal, wait approval       │  │   │
│  │  │     ├─ Supervised: Emit checkpoint every N turns           │  │   │
│  │  │     └─ Autonomous: Continue directly                       │  │   │
│  │  │                                                            │  │   │
│  │  │  5. Validate inputs (Pydantic schema)                      │  │   │
│  │  │                                                            │  │   │
│  │  │  6. Execute tool (invoke async handler)                    │  │   │
│  │  │     └─► Emit tool_use_start, tool_use_done                 │  │   │
│  │  │                                                            │  │   │
│  │  │  7. Append tool result to message history                  │  │   │
│  │  │                                                            │  │   │
│  │  │  8. Budget check:                                          │  │   │
│  │  │     ├─ Soft limit (80%) → emit budget_warning              │  │   │
│  │  │     └─ Hard limit       → emit budget_exceeded, STOP       │  │   │
│  │  │                                                            │  │   │
│  │  │  9. Yield AgentEvent to WebSocket stream                   │  │   │
│  │  │                                                            │  │   │
│  │  │  10. If LLM done → emit turn_done                          │  │   │
│  │  │                                                            │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         │ Persist to database                                           │
│         ▼                                                               │
│  ┌──────────────┐                                                       │
│  │  PostgreSQL  │  AgentSession, AgentMessage, AgentTask                │
│  └──────┬───────┘                                                       │
│         │                                                               │
│         │ WebSocket broadcast                                           │
│         ▼                                                               │
│  ┌──────────────┐                                                       │
│  │   FRONTEND   │  useAgentSession hook                                 │
│  │   (React)    │  Real-time UI updates                                 │
│  └──────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Skill System

### Skill Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          SKILL SYSTEM                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SKILL FILE FORMAT (.skill.md)                                           │
│  ═════════════════════════════                                           │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  ---                                                             │    │
│  │  id: research-director-protocol                                  │    │
│  │  name: Research Director Protocol                                │    │
│  │  description: Detailed workflow for coordinating research        │    │
│  │  version: 1.0.0                                                  │    │
│  │  author: SynqLab Core                                            │    │
│  │  tags: [coordinator, workflow, research]                         │    │
│  │  agent_types: [research_director]                                │    │
│  │  tools: [spawn_worker, send_message, stop_task, list_tasks]      │    │
│  │  autonomy_default: autonomous                                    │    │
│  │  ---                                                             │    │
│  │                                                                  │    │
│  │  ## Workflow Instructions                                        │    │
│  │                                                                  │    │
│  │  1. Classify the user's goal...                                  │    │
│  │  2. Activate appropriate sub-protocols...                        │    │
│  │  3. Spawn workers for each sub-task...                           │    │
│  │  ...                                                             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                                                                          │
│  SKILL LOADING FLOW                                                      │
│  ═════════════════                                                       │
│                                                                          │
│  ┌────────────┐     ┌────────────┐     ┌────────────────────────┐        │
│  │ list_skills│────►│ SkillLoader│────►│ Return skill metadata  │        │
│  │ (tool)     │     │            │     └────────────────────────┘        │
│  └────────────┘     └────────────┘                                       │
│                                                                          │
│  ┌──────────────┐   ┌────────────┐     ┌────────────────────────┐        │
│  │activate_skill│──►│ SkillLoader│────►│ Inject into system     │        │
│  │ (tool)       │   │            │     │ prompt                 │        │
│  └──────────────┘   └────────────┘     └────────────────────────┘        │
│                                                                          │
│                                                                          │
│  BUNDLED SKILLS (4)                                                      │
│  ═════════════════                                                       │
│                                                                          │
│  1. research-director-protocol.skill.md  - Coordinator workflow          │
│  2. protein-optimization.skill.md        - Design optimization           │
│  3. literature-review.skill.md           - Research methodology          │
│  4. binder-design.skill.md               - Binder engineering            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Budget & Cost Control

### Budget System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BUDGET & COST CONTROL                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TOKEN BUDGET CONFIGURATION                                             │
│  ══════════════════════════                                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TokenBudget(                                                   │    │
│  │      session_limit     = 500,000,      # Max per session        │    │
│  │      org_monthly_limit = 10,000,000,   # Max per org/month      │    │
│  │      soft_ratio        = 0.8,          # Warn at 80%            │    │
│  │  )                                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│                                                                         │
│  BUDGET STATUS STATES                                                   │
│  ═══════════════════                                                    │
│                                                                         │
│      0%          80%                    100%                            │
│      │───────────│────────────────────────│                             │
│      │           │                        │                             │
│      │    OK     │    SOFT_LIMIT          │  HARD_LIMIT                 │
│      │           │    (Warning)           │  (Terminate)                │
│      │           │                        │                             │
│      └───────────┴────────────────────────┘                             │
│                                                                         │
│                                                                         │
│  MODEL PRICING (USD per 1M tokens)                                      │
│  ═════════════════════════════════                                      │
│                                                                         │
│  ┌─────────────────┬────────────┬─────────────┐                         │
│  │     Model       │   Input    │   Output    │                         │
│  ├─────────────────┼────────────┼─────────────┤                         │
│  │ gpt-4o          │   $2.50    │   $10.00    │                         │
│  │ gpt-4o-mini     │   $0.15    │   $0.60     │                         │
│  │ gpt-4-turbo     │   $10.00   │   $30.00    │                         │
│  └─────────────────┴────────────┴─────────────┘                         │
│                                                                         │
│                                                                         │
│  BUDGET ENFORCEMENT FLOW                                                │
│  ═══════════════════════                                                │
│                                                                         │
│  ┌───────────┐     ┌───────────┐     ┌───────────────────┐              │
│  │ LLM Call  │────►│ Budget    │────►│ Check status      │              │
│  │ Complete  │     │ Tracker   │     └──────────┬────────┘              │
│  └───────────┘     └───────────┘                │                       │
│                                                 │                       │
│                          ┌──────────────────────┼──────────────────┐    │
│                          │                      │                  │    │
│                          ▼                      ▼                  ▼    │
│                    ┌──────────┐          ┌──────────┐        ┌────────┐ │
│                    │    OK    │          │SOFT_LIMIT│        │HARD    │ │
│                    │ Continue │          │  Warning │        │LIMIT   │ │
│                    └──────────┘          │  Event   │        │STOP    │ │
│                                          └──────────┘        └────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Event Streaming

### WebSocket Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EVENT STREAMING                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONNECTION                                                             │
│  ══════════                                                             │
│                                                                         │
│  WS /ws/agent/{session_id}?token={auth_token}                           │
│                                                                         │
│                                                                         │
│  EVENT TYPES                                                            │
│  ═══════════                                                            │
│                                                                         │
│  ┌────────────────┬─────────────────────────────────────────────────┐   │
│  │ Event Type     │ Description                                     │   │
│  ├────────────────┼─────────────────────────────────────────────────┤   │
│  │ text_delta     │ Streaming text chunk from LLM                   │   │
│  │ text_done      │ Final text block complete                       │   │
│  │ tool_use_start │ Tool execution beginning                        │   │
│  │ tool_use_done  │ Tool execution complete with result             │   │
│  │ tool_proposal  │ [Copilot] Tool awaiting approval                │   │
│  │ checkpoint     │ [Supervised] Pause for user review              │   │
│  │ task_spawned   │ Worker agent created                            │   │
│  │ task_updated   │ Worker status changed                           │   │
│  │ task_completed │ Worker finished                                 │   │
│  │ budget_warning │ Approaching token limit (80%)                   │   │
│  │ budget_exceeded│ Token limit reached, session stopping           │   │
│  │ turn_done      │ LLM turn complete                               │   │
│  │ session_done   │ Session complete                                │   │
│  │ error          │ Error occurred                                  │   │
│  └────────────────┴─────────────────────────────────────────────────┘   │
│                                                                         │
│                                                                         │
│  EVENT LIFECYCLE (Typical Flow)                                         │
│  ══════════════════════════════                                         │
│                                                                         │
│  User sends message                                                     │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                        │
│  │ text_delta  │──► (streaming chunks)                                  │
│  │ text_delta  │                                                        │
│  │ text_delta  │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │ text_done   │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌───────────────┐                                                      │
│  │tool_use_start │                                                      │
│  └───────┬───────┘                                                      │
│          │                                                              │
│          ├───────────────────────────────────┐                          │
│          │ [Copilot Mode]                    │                          │
│          ▼                                   │                          │
│  ┌───────────────┐                           │                          │
│  │ tool_proposal │ ◄── User approves/rejects │                          │
│  └───────────────┘                           │                          │
│          │                                   │                          │
│          ▼                                   │                          │
│  ┌───────────────┐◄──────────────────────────┘                          │
│  │ tool_use_done │                                                      │
│  └───────┬───────┘                                                      │
│          │                                                              │
│          │ (repeat for more tools)                                      │
│          │                                                              │
│          ├───────────────────────────────────┐                          │
│          │ [Supervised Mode, every N turns]  │                          │
│          ▼                                   │                          │
│  ┌───────────────┐                           │                          │
│  │  checkpoint   │ ◄── User continues/stops  │                          │
│  └───────────────┘                           │                          │
│          │                                   │                          │
│          ▼                                   │                          │
│  ┌───────────────┐◄──────────────────────────┘                          │
│  │   turn_done   │                                                      │
│  └───────┬───────┘                                                      │
│          │                                                              │
│          ▼                                                              │
│  ┌───────────────┐                                                      │
│  │ session_done  │                                                      │
│  └───────────────┘                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Database Schema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA MODELS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      agent_sessions                             │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ id              UUID        PRIMARY KEY                         │    │
│  │ org_id          UUID        FK → organizations                  │    │
│  │ project_id      UUID        FK → projects (nullable)            │    │
│  │ user_id         UUID        FK → users                          │    │
│  │ agent_type      VARCHAR     general|protein_designer|...        │    │
│  │ status          VARCHAR     active|completed|cancelled|failed   │    │
│  │ autonomy_mode   VARCHAR     copilot|supervised|autonomous       │    │
│  │ model           VARCHAR     gpt-4o|gpt-4o-mini|...              │    │
│  │ total_input_tokens   INT                                        │    │
│  │ total_output_tokens  INT                                        │    │
│  │ total_tool_calls     INT                                        │    │
│  │ created_at      TIMESTAMP                                       │    │
│  │ updated_at      TIMESTAMP                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                          │                                              │
│                          │ 1:N                                          │
│                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      agent_messages                             │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ id              UUID        PRIMARY KEY                         │    │
│  │ session_id      UUID        FK → agent_sessions                 │    │
│  │ role            VARCHAR     user|assistant|tool|system          │    │
│  │ content         TEXT        Message content                     │    │
│  │ tool_calls      JSONB       Tool call metadata                  │    │
│  │ tool_call_id    VARCHAR     ID of tool call (for tool results)  │    │
│  │ tool_name       VARCHAR     Name of tool invoked                │    │
│  │ input_tokens    INT                                             │    │
│  │ output_tokens   INT                                             │    │
│  │ created_at      TIMESTAMP                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       agent_tasks                               │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ id                UUID      PRIMARY KEY                         │    │
│  │ parent_session_id UUID      FK → agent_sessions (coordinator)   │    │
│  │ worker_session_id UUID      FK → agent_sessions (worker)        │    │
│  │ agent_type        VARCHAR   folding_worker|stability_worker|... │    │
│  │ goal              TEXT      Task description                    │    │
│  │ state             VARCHAR   pending|running|completed|failed    │    │
│  │ result            JSONB     Task output data                    │    │
│  │ error             TEXT      Error message (if failed)           │    │
│  │ created_at        TIMESTAMP                                     │    │
│  │ updated_at        TIMESTAMP                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     agent_artifacts (Phase 13)                  │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ id              UUID        PRIMARY KEY                         │    │
│  │ session_id      UUID NULL   FK → agent_sessions (null when     │    │
│  │                              scope IN ('project','global'))    │    │
│  │ scope           TEXT        session|project|global              │    │
│  │ org_id          VARCHAR NULL FK tenancy filter for project read │    │
│  │ project_id      VARCHAR NULL Project linkage for scope=project  │    │
│  │ created_by      VARCHAR NULL Audit field (upload / promote)     │    │
│  │ content_hash    TEXT NULL   SHA-256 idempotency key (bundled)   │    │
│  │ artifact_type   VARCHAR     pdb_structure|sequence_fasta|       │    │
│  │                              score_table|markdown_report        │    │
│  │ name            VARCHAR     Original filename                   │    │
│  │ content         TEXT NULL   Inline payload (≤ 100 KB)           │    │
│  │ file_path       VARCHAR NULL Path under SYNQLAB_ARTIFACT_DIR    │    │
│  │ size_bytes      INT                                             │    │
│  │ metadata_json   JSONB       Extra metadata (promoted_from, …)   │    │
│  │ created_at      TIMESTAMP                                       │    │
│  │                                                                 │    │
│  │ CHECK ck_agent_artifacts_scope_session:                         │    │
│  │   (scope='session' AND session_id IS NOT NULL)                  │    │
│  │   OR (scope IN ('project','global') AND session_id IS NULL)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  organizations  │       │      users      │       │    projects     │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         │                         │
         └────────────┬────────────┴───────────┬─────────────┘
                      │                        │
                      │                        │
                      ▼                        ▼
              ┌───────────────────────────────────────┐
              │            agent_sessions             │
              └───────────────────┬───────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
           ┌──────────────┐ ┌───────────┐ ┌───────────────┐
           │agent_messages│ │agent_tasks│ │agent_artifacts│
           └──────────────┘ └───────────┘ └───────────────┘
```

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agents/sessions` | Create new agent session |
| `GET` | `/api/agents/sessions` | List sessions for current user |
| `GET` | `/api/agents/sessions/{id}` | Get session with messages |
| `DELETE` | `/api/agents/sessions/{id}` | Cancel/delete session |
| `POST` | `/api/agents/sessions/{id}/message` | Send message to agent |
| `GET` | `/api/agents/sessions/{id}/artifacts` | List session + project + global artifacts (Phase 13) |
| `GET` | `/api/agents/sessions/{id}/artifacts/{artifact_id}` | Get artifact (visibility-checked) |
| `POST` | `/api/agents/sessions/{id}/artifacts` | Upload session-scoped artifact (allowlist .pdb/.fasta/.fa/.csv/.json, 10 MB cap) |
| `POST` | `/api/agents/artifacts/{artifact_id}/promote` | Promote session artifact to project Datasets (COPY, scope='project') |
| `GET` | `/api/agents/datasets?project_id={id}` | List project-scoped Datasets (Phase 13) |
| `GET` | `/api/agents/sessions/{id}/usage` | Get token usage stats |
| `GET` | `/api/agents/templates` | List agent templates |
| `GET` | `/api/agents/templates/{id}` | Get template details |
| `WS` | `/ws/agent/{session_id}` | Real-time event streaming |

---

## Quick Start

### Creating an Agent Session

```typescript
// 1. Create session
const session = await api.createAgentSession({
  agent_type: 'protein_designer',
  autonomy_mode: 'supervised',
  skill_id: 'protein-optimization',
});

// 2. Connect to WebSocket for real-time events
const ws = new WebSocket(`/ws/agent/${session.id}?token=${authToken}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'text_delta':
      // Streaming text chunk
      appendToDisplay(data.content);
      break;
    case 'tool_use_done':
      // Tool completed
      showToolResult(data.tool_name, data.result);
      break;
    case 'checkpoint':
      // [Supervised] User review point
      showCheckpointDialog();
      break;
  }
};

// 3. Send message
await api.sendAgentMessage(session.id, "Design a stable binder for IL-6");
```

---

## Frontend Components

The chat UI is owned by a small set of components under
`frontend/src/features/agent/`. They consume the documented WebSocket
event stream and REST endpoints; no extra event types are required.

| Component | File | Purpose |
|-----------|------|---------|
| `AgentChat` | `components/AgentChat.tsx` | Top-level chat surface — messages, tool cards, proposals, checkpoints, streaming text, right-side panel |
| `useAgentSession` | `hooks/useAgentSession.ts` | Session-side state hook: messages, `toolCalls` Map, artifacts, tasks, WebSocket lifecycle |
| `AgentToolCall` | `components/AgentToolCall.tsx` | Expandable card showing one tool invocation's status / inputs / outputs |
| `InlineArtifactChip` | `components/InlineArtifactChip.tsx` | In-chat download/preview affordance rendered beneath any tool card whose result includes `artifact_id` (e.g. `write_report`, `save_artifact`) |
| `ArtifactViewer` | `components/ArtifactViewer.tsx` | Right-panel list of all session artifacts (presentational — receives `artifacts` from the hook) |
| `AgentTaskTree` | `components/AgentTaskTree.tsx` | Right-panel coordinator/worker task tree |

### Rendering rules (consequences of the data model)

- **Tool-role messages are not rendered as text bubbles.** The
  `agent_messages` rows with `role='tool'` are reconstructed into the
  `toolCalls` Map on session load (assistant `tool_calls` JSON seeds the
  call entries; the matching tool row's `content` is `JSON.parse`d into
  `result`). They render as expandable `AgentToolCall` cards inline with
  the parent assistant turn, not as raw JSON `<pre>` blocks.
- **Artifact chips are inline, not panel-only.** Whenever a tool result
  carries `artifact_id`, the chat renders an `InlineArtifactChip` directly
  beneath that tool card. The same artifact also surfaces in the right
  panel's `ArtifactViewer` for session-wide browsing.
- **Live `tool_use_start` events attach to the most recent assistant
  message.** This keeps live and post-reload behaviour identical: cards
  always render under the assistant turn that emitted them. Tool calls
  emitted before any assistant text fall through to a small "orphan" block
  at the bottom of the chat.
- **Right panel visibility** depends on `tasks.length > 0 || artifacts.length > 0`,
  not just tasks — so a one-shot `write_report` session still gets the
  download panel.

### MarkdownContent strips invalid links

`components/blocks/MarkdownContent.tsx` renders `[Read more]()` and
`[view here](#)` patterns as plain text (not anchor tags) when the URL is
empty or non-http(s). This is why the **dead-artifact-claim guardrail**
exists on the backend: when the model hallucinates "view here / link
provided" without actually calling `write_report`, the user would see
nothing. The guardrail strips those sentences and substitutes a corrective
note pointing at the right tool.

---

## Further Reading

- **Implementation Plan**: `implementation_plan.md`
- **AI Spec**: `.planning/AI-SPEC.md`
- **Phase Documentation**: `.planning/phases/`
- **Backend Code**: `synqlab/agent/`
- **Frontend Components**: `frontend/src/features/agent/`
