# SynqLab Specialist Agent Pool

This document describes the specialist agent pool: what agents exist, their roles, and how the main SynqLab Agent composes them.

---

## Architecture Pattern

```
User
  ↓
SynqLab Agent  ←→  Knowledge Store + Audit Trail
  ↓
  ├─ Aria       biological sequence design
  ├─ Edison     literature search + evidence synthesis
  ├─ Falcon     deep structured reports
  ├─ Phoenix    computational chemistry / small molecules
  ├─ Finch      data analysis + statistics
  └─ [future]   lab, regulatory, imaging, omics
```

The SynqLab Agent:
1. Receives a user goal
2. Decomposes it into sub-tasks
3. Routes each sub-task to the right specialist agent or tool
4. Collects outputs, reasons about next steps
5. Presents results to the user with full traceability

---

## Agent Registry

| Agent | Domain | Input | Output | Status |
|---|---|---|---|---|
| **Aria** | Biological sequence design (proteins, peptides, antibodies, enzymes) | Design goal, target context, property constraints | Ranked candidate sequences + scores | In development |
| **Edison / Crow** | Scientific literature search and retrieval | Research question, topic, keywords | Papers, evidence summaries, citations | Via FutureHouse API |
| **Falcon** | Deep structured reports and synthesis | Topic + evidence sources | Long-form structured report with references | Via FutureHouse API |
| **Owl** | General scientific QA | Scientific question | Fact-checked answer with citations | Via FutureHouse API |
| **Phoenix** | Computational chemistry, small-molecule design | Design goal, target, property constraints | SMILES candidates + scores (powered by SmileyLlama) | In production |
| **Finch** | Data analysis, statistics, visualization | Tabular data + analysis goal | Analysis report, plots, statistics | Via FutureHouse API |
| **Kosmos** | Multimodal scientific analysis (images, structures) | Images, structures + question | Analysis output | Via FutureHouse API |
| **Lab Agent** | In-vitro execution: synthesis ordering, assay management, result ingestion | Candidate list from Knowledge Store + assay protocol | Assay results pushed back to Knowledge Store | Roadmap |

---

## Agent Interface Contract

Every specialist agent exposes a standard interface to the SynqLab Agent:

```python
class SpecialistAgent:
    name: str
    version: str
    capabilities: list[str]

    def run(
        task: AgentTask,
        context: ProjectContext,
        budget: ComputeBudget,
    ) -> AgentResult

class AgentTask:
    goal: str
    inputs: dict
    constraints: dict
    mode: Literal["exploratory", "validated"]

class AgentResult:
    outputs: dict
    artifacts: list[Artifact]   # sequences, files, reports
    scores: dict
    trace: AuditRecord          # full trace of what was done
    confidence: float
    next_suggested_steps: list[str]
```

---

## How to Add a New Agent

1. Create a parent doc at `agents/<agent_name>/<agent_name>.md` (use [`aria/aria.md`](aria/aria.md) as the template)
2. For trained agents, add a `agents/<agent_name>/training/` folder with one file per version/phase (see [`aria/training/`](aria/training/README.md))
3. Reuse the shared infra in [`_shared/`](_shared/) (frameworks, scoring tools, SFT→DPO method, eval protocol) — do not duplicate it
4. Define the agent interface (inputs, outputs, scoring, trace schema)
5. Register the agent in the SynqLab tool registry
6. Implement the adapter in `synqLab-agent/synqlab/agent/tools/`
7. Add evaluation criteria and benchmark targets

---

## Agent Composition Patterns

### Sequential pipeline

```
user goal
  → Edison (get literature context)
  → Aria (design sequences guided by context)
  → SynqLab scoring tools (fold, score)
  → Falcon (write a candidate report)
```

### Parallel hypothesis generation

```
user goal
  → Aria (bio sequence candidates)     ─┐
  → Phoenix (small molecule candidates) ─┤→ SynqLab Agent (rank, select, report)
  → Edison (literature precedents)     ─┘
```

### Iterative closed loop

```
SynqLab Agent
  → Aria (generate candidates)
  → tools (score candidates)
  → knowledge store (store results)
  → Aria (DPO/preference update)
  → [repeat until budget or convergence]
```

---

## FutureHouse / Edison Integration

Edison, Falcon, Owl, Finch, and Kosmos are external agents hosted by [FutureHouse](https://www.futurehouse.org/).

| Agent | API endpoint | Notes |
|---|---|---|
| Crow / Edison | FutureHouse API | Literature search, paper retrieval |
| Falcon | FutureHouse API | Deep structured reports |
| Owl | FutureHouse API | Scientific QA |
| Finch | FutureHouse API | Data analysis |
| Kosmos | FutureHouse API | Multimodal / image analysis |

Reference: [`../../robin/FUTUREHOUSE.md`](../../robin/FUTUREHOUSE.md) (Codes/robin repo)

SynqLab wraps these as tool calls with the same plan-approve-trace contract.

---

## Learning Loops

Each specialist agent has two learning layers:

### Agent-level learning (tight loop)

Aria improves its sequence generation via DPO from scored candidates.
Phoenix improves its molecule generation via SmileyLlama's iterative DPO.
These loops run within each agent, fast and domain-specific.

### Platform-level learning (broad loop)

The SynqLab Agent learns which agent/tool combinations work best for which goals,
across all projects and users (within tenant isolation constraints).
This loop is slower but broader. Eventually enables fine-tuning the main agent
on curated project histories.

---

## Related Docs

| Doc | Link |
|---|---|
| Platform architecture | [`../architecture.md`](../architecture.md) |
| Aria full spec | [`aria/aria.md`](aria/aria.md) |
| V1 tool registry | [`../../engineering/registry.md`](../../engineering/registry.md) |
