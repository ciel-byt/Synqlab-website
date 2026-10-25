# SynqLab Architecture

This document is the authoritative reference for how SynqLab is structured. It is written to be read by both humans and LLM agents working on the codebase.

---

## Overview

SynqLab is a closed-loop, agent-orchestrated platform for computational molecular design. It has four layers:

1. **Agent layer** — an LLM-based orchestrator that plans tool calls, tracks budget, and decides what to run next
2. **Pipeline layer** — a staged set of computational tools (generation → evaluation → simulation) that the agent composes and executes
3. **Learning layer** — a data store and model update mechanism that improves the system from every outcome, including failures
4. **Knowledge layer** — a structured store of prior knowledge (labeled datasets, target definitions, domain prompts, cross-project findings) that teams inject and the system accumulates over time

These layers operate in a repeating loop. Each iteration is called a **design round**.

> Full Knowledge Layer spec: [`docs/engineering/design-docs/knowledge-store.md`](design-docs/knowledge-store.md)

---

## The Design Round (5 Stages)

### Stage 1 — Generate

The agent selects a generative model and sampling configuration based on the design objective and results from prior rounds.

**Early rounds** (sparse labels): use diverse, unconditional generators to maximize coverage of sequence space.
**Later rounds** (accumulated labels): shift toward target-conditioned generators biased toward high-scoring regions.


| Tool        | Role                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| ProtGPT2    | Unconditional autoregressive sequence generator                               |
| EvoDiff     | Diffusion-based sequence generator; supports inpainting and motif scaffolding |
| PepMLM      | Peptide binder generator conditioned on target sequence (GFP1-10)             |
| RFdiffusion | Structure-space diffusion; generates backbone geometries                      |
| ProteinMPNN | Inverse folding; recovers sequences from RFdiffusion backbones                |


**Output:** `N` candidate sequences (N is a budget-controlled parameter)

---

### Stage 2 — Evaluate (Staged / Gated)

Candidates are filtered through a cost-ordered pipeline. Cheap tools run first; only passing candidates advance to more expensive steps. The agent controls gate thresholds and which tools are invoked.

**Gate 1 — Fast structure screen**


| Tool    | Score used                   | Purpose                                    |
| ------- | ---------------------------- | ------------------------------------------ |
| ESMFold | pLDDT per-residue confidence | Discard sequences that don't fold reliably |


**Gate 2 — Complex-level interface quality**


| Tool               | Score used              | Purpose                               |
| ------------------ | ----------------------- | ------------------------------------- |
| AlphaFold-Multimer | iPTM, pTM               | Predict GFP11/GFP1-10 complex quality |
| DiffDock-PP        | Binding pose confidence | Protein-protein docking score         |


**Gate 3 — Stability scoring**


| Tool      | Score used           | Purpose                                     |
| --------- | -------------------- | ------------------------------------------- |
| FoldX     | ΔΔG                  | Thermodynamic stability estimate            |
| PyRosetta | Rosetta energy units | Programmable stability and affinity scoring |


**Gate 4 — Brightness model (task-specific)**


| Model            | Score used          | Purpose                                                    |
| ---------------- | ------------------- | ---------------------------------------------------------- |
| Brightness model | P(fluorescence ≥ τ) | Learned predictor trained from experimental GFP11 readouts |


The brightness model is a lightweight ensemble trained on accumulated labeled data (including failures). It replaces or supplements generic structural scores as the primary ranking signal once sufficient labels are available. This is the key task-specific component of SynqLab and its primary differentiator from static pipelines.

**Output:** Filtered and ranked candidate set

---

### Stage 3 — Simulate (top-k only)

Molecular dynamics simulation is applied selectively to the top-k candidates from Stage 2. This is the most expensive step and is treated as a final computational filter.


| Tool    | Purpose                                             |
| ------- | --------------------------------------------------- |
| GROMACS | High-performance GPU-accelerated MD simulation      |
| OpenMM  | Python-native MD; used for programmatic integration |


Simulation length and ensemble size are fixed within an experiment to ensure cost comparability across rounds.

**Output:** Stability and dynamics profile for top-k candidates

---

### Stage 4 — Label All Candidates

Every candidate evaluated in any stage — whether it passed all gates or was rejected early — is recorded with:

- The sequence
- All intermediate scores (pLDDT, iPTM, ΔΔG, brightness model output)
- The stage at which it was eliminated (or that it survived)
- Experimental fluorescence readout if available (from the split-GFP assay)

This produces a growing labeled dataset: `D = {(s_i, y_i)}` where `y_i` is a composite score or experimental measurement, and the binary label is `y_i ≥ τ` (τ fixed a priori from a pilot baseline).

**Negative examples are first-class data.** Sequences that fail early gates are labeled as negatives and included in all downstream model training. This is intentional and is one of SynqLab's core research claims (H2).

---

### Stage 5 — Update Models

At the end of each round, two updates are performed:

**Default update (every round):**

- Retrain the **brightness model** (reranker/calibration model) on all accumulated `D`, including negatives
- The brightness model predicts `P(y_i ≥ τ)` from tool-score features
- It is used in Stage 2, Gate 4 of the next round

**Optional update (when data and budget allow):**

- Fine-tune a **LoRA adapter** on a sequence generator (e.g., ProtGPT2 or PepMLM) using positively-labeled sequences
- This biases generation toward higher-scoring sequence regions in subsequent rounds
- Method: LoRA (frozen base weights + low-rank update ΔW = αBA/r); QLoRA variant for memory-constrained settings

The agent then starts the next round with updated models.

---

## Agent Responsibilities

The LLM agent is responsible for:


| Decision                    | Description                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Generator selection         | Which generative model to use and with what parameters                                        |
| Gate threshold setting      | What score cutoffs to use at each evaluation gate                                             |
| Tool invocation             | Which evaluation tools to run (can skip gates to save cost)                                   |
| Top-k selection             | How many candidates to send to MD simulation                                                  |
| Budget tracking             | Monitoring token usage, GPU time, and RAM against the round budget                            |
| Exploration vs exploitation | Whether to generate diverse candidates (explore) or focus around known high-scorers (exploit) |


The agent's orchestration policy is one of the primary experimental variables. Three policies are compared: fixed pipeline (no agent), orchestration-only (agent, no learning), and full SynqLab (agent + closed-loop updates).

---

## Agent Formalization

To make SynqLab's orchestration policy explicit and experimentally defensible, the agent should be modeled as a budget-constrained sequential decision system rather than an informal controller.

### Decision State

At each step of a design round, the agent observes a state `s_t` that may include:

- the current experiment and round identifiers
- the design objective
- available budget remaining (tokens, CPU, GPU, RAM, wall-clock)
- the candidate pool and its summary statistics
- outputs from previously invoked tools
- current gate thresholds
- memory of prior rounds (retrieved summaries or structured state)
- current model versions (brightness model, optional generator adapter)

This state does not need to be represented as a single dense vector in the first implementation; a structured state object is acceptable as long as it is logged and reproducible.

### Action Space

The agent selects an action `a_t` from a constrained orchestration space. Actions may include:

- selecting a generator
- choosing generator parameters or sampling depth
- deciding which evaluation gate to invoke next
- setting or adjusting gate thresholds
- deciding whether to skip an expensive tool
- choosing top-k candidates for downstream simulation
- deciding whether to trigger an optional model update

The action space should remain explicit and enumerable in the architecture so that ablations can isolate which parts of orchestration create value.

### Transition Structure

After action `a_t` is executed, the system transitions to a new state `s_(t+1)` based on:

- tool outputs
- candidate filtering outcomes
- artifact generation
- budget consumption
- optional experimental readouts

Because external tools may be stochastic or fail, the transition dynamics are partially uncertain. This makes SynqLab better characterized as a practical sequential decision process under uncertainty than as a purely deterministic pipeline.

### Reward Signal

The agent's objective is not just to maximize raw hit rate, but to optimize quality under constrained resources. A practical reward function should therefore combine effectiveness and efficiency, for example:

`R = quality_gain - lambda_cost * normalized_cost`

where `quality_gain` may depend on:

- hit rate above threshold `τ`
- enrichment among selected candidates
- improvement in predicted fluorescence
- diversity retained among top candidates

and `normalized_cost` may depend on:

- token usage
- CPU time
- GPU time
- RAM usage
- wall-clock latency

This reward framing aligns the architecture with the thesis claim that SynqLab is a cost-aware, closed-loop optimization system rather than a static workflow runner.

### Policy Class

The initial SynqLab implementation does not require end-to-end reinforcement learning. The policy can be instantiated using simpler and more interpretable mechanisms such as:

- fixed heuristic policies
- rule-based budget-aware policies
- epsilon-greedy exploration over generators or tool depth
- Thompson-sampling-style selection among candidate strategies
- score-threshold policies with explicit fallback rules

This is sufficient for thesis evaluation because the main scientific question is whether explicit orchestration improves outcomes relative to static baselines, not whether the policy is globally optimal.

### Experimental Role

Formalizing the agent in this way clarifies the main orchestration ablations:

- **Static pipeline**: no learned or adaptive policy; fixed tool sequence and thresholds
- **Orchestration-only**: adaptive policy with fixed models
- **Full closed-loop SynqLab**: adaptive policy with outcome-driven model updates

This framing makes it possible to evaluate SynqLab as a decision-making system and to separate gains due to orchestration from gains due to model refinement.

### Design Principle

The agent should be treated as a policy over a constrained scientific workflow, not as an unrestricted autonomous reasoner. Its freedom must be bounded by:

- validated tool interfaces
- explicit action schemas
- budget constraints
- retry limits
- fallback behavior
- full logging of state, action, and outcome

This constraint is important both for reliability in practice and for rigorous experimental evaluation.

## Data Flow Summary

```
Design Objective
      │
      ▼
 SynqLab Agent ──────────────────────────────────────────────────────┐
      │                                                              │
      ▼                                                              │
[Stage 1] Generate (N candidates)                                   │
      │                                                              │
      ▼                                                              │
[Stage 2] Evaluate — ESMFold → AF-Multimer → FoldX → Brightness     │
      │                           (gated, cost-ordered)             │
      ▼                                                              │
[Stage 3] Simulate top-k (GROMACS / OpenMM)                         │
      │                                                              │
      ├──── optional ──→ Wet-lab split-GFP assay                    │
      │                       │                                      │
      ▼                       ▼                                      │
[Stage 4] Label all candidates → D = {(s_i, y_i)}                   │
      │                                                              │
      ▼                                                              │
[Stage 5] Update: retrain brightness model + optional LoRA ─────────┘
                  (closed-loop feedback to agent)
```

---

## Key Design Decisions


| Decision                                  | Choice                                                     | Reason                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Gated evaluation                          | Cost-ordered gates, not uniform evaluation                 | Cheap tools eliminate most candidates before expensive ones run                                 |
| Label failures                            | All rejected candidates are stored                         | Negatives improve reranker calibration and are a core research claim                            |
| Brightness model as first-class component | Task-specific learned metric, not a generic score          | Motivated by MDMI (Bayat et al. 2025): ~100 GFP11 labels sufficient to train a useful predictor |
| LoRA as second-tier update                | Only when data and budget allow                            | Robust reranker training is safer under small data; LoRA risks overfitting early                |
| Fixed τ a priori                          | Threshold set from pilot baseline before experiments begin | Prevents post-hoc threshold tuning that would inflate hit rate                                  |


---

## Current Task: GFP11 Variant Prediction

- **Target:** 16-residue GFP11 peptide (11th β-strand of sfGFP)
- **Partner:** GFP1-10 fragment
- **Readout:** Fluorescence intensity (split-GFP complementation assay)
- **Goal:** Maximize brightness while maintaining or improving sequence diversity
- **Why this task:** Fast, cheap, quantitative assay with a continuous functional signal; validated by MDMI as feasible under minimal data

---

## Tool Platform Architecture

SynqLab treats every computational biology tool as a managed platform component rather than a one-off script. The architecture standardizes how tools are registered, invoked, deployed, and observed, even when the underlying tools have incompatible APIs.

### Canonical Internal Interface

Every tool exposed to the agent must implement the same internal contract:

- `name`
- `version`
- `input_schema`
- `output_schema`
- `run(request, context) -> ToolResult`
- `healthcheck()`
- `capabilities()`

This contract is the only interface the orchestrator is allowed to depend on. Native tool APIs, command-line arguments, or file conventions are hidden behind adapters.

### Adapter Layer

Each scientific tool is wrapped in an adapter that translates between SynqLab's canonical request/response model and the tool's native execution format.

Examples:

- REST service → canonical JSON request/response
- CLI binary → canonical request mapped to command arguments and output files
- Python package → canonical request mapped to a local function call

This allows heterogeneous tools such as AlphaFold-Multimer, FoldX, DiffDock-PP, GROMACS, and OpenMM to appear uniform to the agent and orchestration runtime.

### Tool Registry

Tools are declared in a machine-readable registry (for example `tools.yaml` or `tools-registry.json`) containing:

- tool name and version
- adapter type
- container image or executable path
- healthcheck endpoint or command
- resource requirements (CPU, GPU, RAM)
- input/output schema references
- timeout and retry policy


The registry is the source of truth for tool discovery. The orchestrator should not hardcode tool-specific startup or invocation logic.

### Multi-Resolution Exposure Model

SynqLab is designed so that the same core platform can later be exposed at multiple levels of granularity rather than through a single interface style.

These exposure levels are:

1. **Granular tool level** — individual capabilities such as sequence generation, structure prediction, scoring, result persistence, or label ingestion can be exposed directly as callable tools
2. **Package or platform level** — higher-level SynqLab operations such as running a design round, evaluating a candidate set, comparing experiments, or summarizing a workflow can be exposed as packaged capabilities
3. **Conversational or chat level** — a user-facing SynqLab chat interface can sit on top of the same registry, orchestration, and storage layers so that users can ask questions, retrieve results, trigger actions, and tag objects interactively

This means SynqLab should be implemented as **one internal platform with multiple exposure surfaces**, not as separate systems for raw tools, packaged workflows, and chat interactions.

A key architectural consequence is that tools and services should remain callable as standalone units, while higher-level workflow operations should be composed from them rather than duplicating underlying logic.

### Deployment Model

Each tool should be deployable as an independent service or worker with isolated dependencies. The default deployment unit is a container.

Each deployment definition should specify:

- image name
- startup command
- required environment variables
- mounted volumes
- GPU requirement if applicable
- healthcheck
- artifact output directory

A single top-level deployment script (for example `deploy.sh`) should bootstrap the system across environments by:

- loading the environment-specific config
- starting the tool services
- validating healthchecks
- initializing storage paths
- running an optional smoke test

### Execution Modes

SynqLab supports two execution modes:

- **Synchronous**: used for lightweight tools with short latency
- **Asynchronous job-based**: used for long-running tools such as docking and molecular dynamics

Heavy tools should return a job identifier and write progress, logs, and artifacts to the shared storage layer.

### Operational Principle

The platform standardizes the boundary around tools, not the tools themselves. This preserves flexibility while keeping orchestration, deployment, logging, and evaluation consistent.

## Storage and Result Persistence

SynqLab uses a hybrid persistence model: structured metadata lives in the database, while large scientific artifacts live in filesystem or object storage. The storage layer must therefore be explicit in both architecture and configuration.

### Storage Responsibilities

SynqLab separates data into three categories:

1. **Relational metadata** — experiment records, tool runs, status, timing, cost, and normalized metrics
2. **Flexible structured payloads** — tool-specific request/response bodies stored as JSONB
3. **Large artifacts** — structures, trajectories, docking outputs, logs, checkpoints, and plots stored outside the database

### Database Layer

The database of record should be PostgreSQL.

Common, query-heavy fields should be stored as typed columns, including:

- `experiment_id`
- `tool_run_id`
- `candidate_id`
- `tool_name`
- `tool_version`
- `status`
- `started_at`, `finished_at`
- `latency_ms`
- `cpu_seconds`, `gpu_seconds`, `token_count`
- `error_code`
- `input_hash`

Tool-specific request/response payloads should be stored in JSONB columns such as:

- `request_jsonb`
- `response_jsonb`
- `config_jsonb`

Large artifacts should never be embedded directly in these rows.

### Artifact Storage Layer

Large files should be written to a dedicated artifact store, which can be:

- a local filesystem path during development
- a mounted shared volume in cluster deployments
- object storage (for example S3 or MinIO) in cloud deployments

Typical artifact types include:

- PDB or mmCIF structures
- MD trajectories
- docking poses
- tool logs
- model checkpoints
- generated reports and plots

The database should store only the artifact metadata:

- URI or filesystem path
- artifact type
- format
- size in bytes
- checksum
- producing tool run

### Required Configuration

Storage must be configurable rather than hardcoded. The architecture expects a config file and/or environment variables to define where artifacts are written.

A minimal configuration should expose values such as:

```yaml
storage:
  backend: filesystem
  root_dir: /data/synqlab
  artifacts_dir: /data/synqlab/artifacts
  logs_dir: /data/synqlab/logs
  temp_dir: /data/synqlab/tmp
  use_date_partitioning: true

database:
  url: postgresql://user:pass@host:5432/synqlab
```

For object storage, the configuration may instead look like:

```yaml
storage:
  backend: s3
  bucket: synqlab-artifacts
  prefix: prod/
  region: us-east-1
  endpoint_url: http://minio:9000
```

### Recommended Directory Layout

For filesystem-backed storage, the layout should be predictable and partitioned by experiment and run:

```text
/data/synqlab/
  artifacts/
    experiments/
      exp_0001/
        round_0001/
          run_esmfold_001/
            result.json
            structure.pdb
          run_foldx_001/
            scores.json
        round_0002/
          ...
  logs/
    agent/
    tools/
  tmp/
  exports/
```

This makes artifacts easy to inspect, debug, and archive without needing to reverse-engineer tool-specific file conventions.

### Provenance Requirement

Every stored result must be traceable back to:

- the experiment
- the round
- the candidate sequence
- the tool and tool version
- the exact input/configuration used
- the artifact location

This provenance requirement is essential for reproducibility, ablation studies, and future closed-loop learning.


## External Exposure and MCP Readiness

SynqLab's internal tool contract should remain protocol-agnostic so that the platform can later be exposed through multiple external interaction modes, including MCP-compatible interfaces.

### Design Principle

The internal registry, orchestration layer, and persistence model should be treated as the source of truth. External protocols such as MCP should be added as exposure adapters on top of the existing platform rather than becoming the internal architecture itself.

This allows SynqLab to support three future-facing access patterns without redesigning core services:

- **Tool-level exposure** — an external client such as Claude can call a single SynqLab capability directly
- **Package-level exposure** — an external client can invoke SynqLab as a higher-level platform operation rather than calling raw tools one by one
- **Chat-level exposure** — SynqLab can provide a conversational interface where users ask questions, inspect experiments, compare runs, trigger actions, and manage tags

### Exposure Metadata

To support this, registry entries should eventually include exposure metadata that distinguishes what is internally callable, what is externally exposed, and what should appear in chat-facing workflows.

A representative structure is:

```yaml
exposure:
  internal: true
  mcp_tool: true
  package_operation: false
  chat_visible: true
  requires_orchestrator: false
```

For higher-level workflow operations, the metadata may instead look like:

```yaml
exposure:
  internal: true
  mcp_tool: false
  package_operation: true
  chat_visible: true
  requires_orchestrator: true
```

### Chat and Tagging Layer

The conversational layer should be backed by the same experiment memory and provenance model as the rest of the platform. This enables chat-level interactions such as:

- retrieving experiments or candidates by tag
- asking why a candidate was rejected
- comparing two design rounds
- requesting reruns with modified tool choices
- marking runs or candidates as promising, failed, baseline, or ready for wet-lab follow-up

Tagging should therefore be supported as a first-class metadata capability across experiments, runs, candidates, and artifacts.

### Architectural Outcome

The result is a multi-resolution interaction model:

- **fine resolution** — direct callable tools
- **mid resolution** — packaged SynqLab operations
- **high resolution** — conversational question-answering and action over the full platform

All three levels should be backed by the same registry, orchestration policies, storage rules, and provenance guarantees.

## Configuration Conventions

SynqLab configuration should be explicit, environment-aware, and reproducible. No storage path, bucket name, database URL, or tool runtime setting should be hardcoded in application logic.

### Configuration Sources

Configuration should be resolved in the following order of precedence:

1. environment variables
2. environment-specific config file
3. shared base config file
4. application defaults

A recommended structure is:

```text
config/
  base.yaml
  local.yaml
  dev.yaml
  prod.yaml
```

The selected environment should be set by a top-level variable such as:

- `SYNQLAB_ENV=local`
- `SYNQLAB_ENV=dev`
- `SYNQLAB_ENV=prod`

### Required Configuration Domains

At minimum, SynqLab configuration should define:

- database connection
- storage backend and artifact paths
- tool registry path
- logging level and log directory
- temporary working directory
- execution limits (timeouts, retries, queue settings)
- compute settings (CPU/GPU allocation)
- environment name

### Example Configuration

A representative configuration file may look like:

```yaml
app:
  env: local
  project_name: synqlab

registry:
  tools_config_path: ./registry/tools.yaml

storage:
  backend: filesystem
  root_dir: /data/synqlab
  artifacts_dir: /data/synqlab/artifacts
  logs_dir: /data/synqlab/logs
  temp_dir: /data/synqlab/tmp
  exports_dir: /data/synqlab/exports
  use_date_partitioning: true

logging:
  level: INFO
  tool_logs_subdir: tools
  agent_logs_subdir: agent

execution:
  default_timeout_sec: 1800
  max_retries: 2
  async_backend: redis
  queue_name: synqlab-jobs

compute:
  default_device: cpu
  gpu_enabled: true


database:
  url: postgresql://user:pass@host:5432/synqlab
```

### Environment Variables

Sensitive values and deployment-specific overrides should be passed through environment variables, for example:

- `SYNQLAB_ENV`
- `SYNQLAB_DATABASE_URL`
- `SYNQLAB_STORAGE_BACKEND`
- `SYNQLAB_STORAGE_ROOT`
- `SYNQLAB_S3_BUCKET`
- `SYNQLAB_LOG_LEVEL`
- `SYNQLAB_TOOLS_CONFIG`

### Path Strategy

All storage paths should be derived from configuration rather than assembled ad hoc inside tools. Tool adapters should receive resolved paths from the orchestration or execution layer.

For filesystem storage, the platform should construct artifact paths using stable identifiers such as:

- experiment ID
- round ID
- tool run ID
- candidate ID

This ensures that all outputs are predictable, relocatable, and easy to audit.

### Deployment Integration

The top-level deployment script (for example `deploy.sh`) should:

- load the selected environment configuration
- export environment variables
- create required directories if missing
- validate database and storage connectivity
- pass the resolved configuration into services and workers

This keeps deployment logic centralized and prevents environment drift.

## Architecture Diagram

The following diagram summarizes the interaction between the agent, tool platform, execution layer, database, and artifact storage.

```mermaid
flowchart TB

    A[Agent / Orchestrator] --> B[Tool Registry]

    B --> C1[Adapter: ESMFold]
    B --> C2[Adapter: DiffDock]
    B --> C3[Adapter: FoldX]

    C1 --> D1[Tool Runtime]
    C2 --> D2[Tool Runtime]
    C3 --> D3[Tool Runtime]

    D1 --> E[Execution Layer]
    D2 --> E
    D3 --> E

    E --> F1[Postgres Database]
    E --> F2[JSONB Request/Response Fields]
    E --> F3[Artifact Storage]

    F1 --> G[Analytics / Evaluation / Closed-Loop Update]
    F2 --> G
    F3 --> G
```



The closed-loop behavior can also be summarized conceptually as:

```text
Generation -> Evaluation -> Labeling -> Persistence -> Model Update -> Next Round
```

## Related Files


| File                                           | Purpose                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `docs/engineering/design-docs/tools-registry.json`   | Full tool registry: 43 tools, 7 categories, fetch URLs, model sizes |
| `docs/product/diagrams/synqlab-architecture.drawio`  | Editable architecture diagram (open in diagrams.net or VS Code)     |
| `research/publications/proposal/phd_proposal_template.tex` | Full proposal with methodology, hypotheses, and evaluation plan     
| `docs/product/overview.md`                           | Non-technical pitch (scientists and investors)                      |


