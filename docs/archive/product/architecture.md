# SynqLab Platform Architecture

Version: 2026-05-24  
Status: Living document — updated as architecture evolves.

---

## What SynqLab Is

SynqLab is a **drug-discovery copilot** that helps scientists plan, execute, and trace end-to-end research workflows. It spans computational design today and will extend to wet-lab integration and regulatory submission in future stages.

```
User goal / data import
        ↓
┌──────────────────────────────────────────────────────┐
│                  SYNQLAB AGENT                       │
│   plans · codes · trains · submits jobs · decides    │
└──────┬────────────────┬───────────────────┬──────────┘
       │                │                   │
       ▼                ▼                   ▼
 Specialist          Direct tools       Compute layer
 Agents              (registered,       (job scheduler,
                      single-step)      GPU clusters)
 ├── Aria            ├── ESMFold
 ├── Edison          ├── Chai-1 / Boltz
 ├── Phoenix         ├── MMseqs2 / BLAST
 ├── Finch           ├── Biopython
 ├── Falcon          ├── RDKit / Vina
 └── Lab Agent       ├── PDB / UniProt
                     └── Python sandbox
       │                │                   │
       └────────────────┴───────────────────┘
                        │
              ┌─────────┴──────────┐
              │   Knowledge Store  │
              │   + Audit Trail    │
              └─────────┬──────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
    In-silico outputs           In-vitro outputs
    (Aria, Phoenix,             (Lab Agent:
     scoring tools)              synthesis, assays,
                                 sample results)
```

The key distinction from other AI tools: **every action is traceable, versioned, and composable** across all of planning, execution, and learning.

---



## The Four Layers (today's V1 baseline)

These are defined in detail in `[../architecture.md](../architecture.md)`. Summary:


| Layer         | Role                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Agent**     | LLM orchestrator that plans tool calls, tracks budget, decides what to run                |
| **Pipeline**  | Staged computational tools: generation → evaluation → simulation                          |
| **Learning**  | Data store and model-update mechanism that improves from every outcome                    |
| **Knowledge** | Structured store of prior knowledge, datasets, target definitions, cross-project findings |


---



## Platform Capability Map

What SynqLab can do — current and roadmapped:

```
┌──────────────────────────────────────────────────────────────────┐
│                        SYNQLAB AGENT                             │
│   plan  │  code  │  train  │  submit jobs  │  call agents        │
└────┬─────────┬────────┬────────────┬───────────────┬─────────────┘
     │         │        │            │               │
     ▼         ▼        ▼            ▼               ▼
Hypothesis  Scaffold  Fine-tune  Direct tools   Specialist agents
generation  code      models     (registered,   ├── Aria
& critique  & scripts on cluster  single-step)  ├── Edison
                                 ├── ESMFold    ├── Phoenix
                                 ├── Chai-1     ├── Finch
                                 ├── MMseqs2    ├── Falcon
                                 ├── BLAST      └── Lab Agent
                                 ├── Biopython
                                 ├── RDKit
                                 └── Python sandbox
     │         │        │            │               │
     └─────────┴────────┴────────────┴───────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    Knowledge Store    │
                    │    + Audit Trail      │
                    └───────────┬───────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
          In-silico outputs               In-vitro outputs
          (Aria, Phoenix,                 (Lab Agent:
           scoring tools)                 synthesis, assays,
                                          sample results)
```

---



## Agent Capabilities



### What the SynqLab Agent can do


| Capability             | Description                                                        | Status    |
| ---------------------- | ------------------------------------------------------------------ | --------- |
| Plan                   | Break a user goal into steps, propose tools and agents             | V1        |
| Code                   | Write and run Python/bash scripts for data processing, analysis    | V1        |
| Train models           | Trigger fine-tuning jobs on connected compute                      | Roadmap   |
| Submit jobs            | Schedule compute jobs (HPC, cloud GPU, cloud CPU)                  | Roadmap   |
| Call specialist agents | Delegate biology / chemistry tasks to Aria, Edison, etc.           | In design |
| Call tools             | Invoke registered tools (folding, docking, scoring, search)        | V1        |
| Import data            | Accept user-uploaded datasets, structures, sequences, spreadsheets | V1        |
| Generate hypotheses    | Propose biological hypotheses from user context + knowledge        | V1        |
| Store memory           | Record decisions, results, findings, failures per-project          | V1        |
| Version everything     | Pin dataset, model, tool, prompt versions at time of use           | V1        |
| Request approval       | Pause before expensive/risky actions for human sign-off            | V1        |
| Report                 | Produce structured summaries, reports, regulatory drafts           | Roadmap   |




### Modes of operation


| Mode                  | Behavior                                                   |
| --------------------- | ---------------------------------------------------------- |
| **Conversational**    | User asks questions; agent explains, suggests, discusses   |
| **Planned execution** | Agent proposes a plan; user approves; agent executes       |
| **Autonomous**        | Agent runs a full loop; surfaces results at the end        |
| **Exploratory**       | No regulatory constraints; for brainstorming and early R&D |
| **Validated**         | GxP-grade logging, signed approvals, versioned artifacts   |


The agent must always know which mode it is in. Validated mode triggers stricter controls.

---



## Tool Layer

The SynqLab Agent has direct access to a registered set of **tools** — deterministic, single-purpose functions it can invoke without delegation. Tools differ from specialist agents: they take an input, run a computation, and return a result. They do not reason, plan, or have their own learning loop.

### Tool vs Agent — when to use which


| Use a **tool** when...                            | Use a **specialist agent** when...                         |
| ------------------------------------------------- | ---------------------------------------------------------- |
| Single-step, deterministic operation              | Multi-step reasoning required                              |
| No domain knowledge needed beyond the function    | Deep domain expertise needed                               |
| Fast (seconds to minutes)                         | May take minutes to hours                                  |
| No learning loop                                  | Has its own closed learning loop                           |
| Examples: fold this sequence, score this molecule | Examples: design a binder, search literature, analyze data |




### Registered tool categories

```
SynqLab Agent
│
├── STRUCTURE PREDICTION
│   ├── ESMFold          fast single-chain folding → pLDDT
│   ├── Boltz-1          complex structure prediction → ipTM, interface pAE
│   ├── Chai-1           complex structure prediction (open-source AF3 alternative)
│   ├── OmegaFold        alternative single-chain folding
│   └── RoseTTAFold2     alternative complex prediction
│
├── SCORING + EVALUATION
│   ├── FoldX            stability and ΔΔG calculation
│   ├── PLIP             protein-ligand/peptide interaction profiler
│   ├── AutoDock Vina    small-molecule docking (Phoenix track)
│   ├── RDKit            molecular property calculation (Phoenix track)
│   └── FreeSASA         solvent-accessible surface area
│
├── SEQUENCE ANALYSIS
│   ├── MMseqs2          fast clustering, novelty check, train/test split
│   ├── BLAST            sequence similarity search vs public databases
│   ├── Biopython        sequence property calculator (charge, pI, GRAVY, etc.)
│   ├── DeepTMHMM        transmembrane helix prediction
│   ├── SignalP 6.0      signal peptide prediction
│   └── IUPred3          disorder prediction
│
├── DATABASE SEARCH
│   ├── UniProt search   sequence + annotation lookup
│   ├── PDB search       structure search by sequence or keyword
│   ├── ChEMBL search    drug-target bioactivity lookup
│   ├── PubChem search   compound property lookup
│   └── AlphaFold DB     pLDDT fetch by UniProt ID
│
├── CODE EXECUTION
│   └── Python sandbox   execute user or agent-written Python scripts
│
└── FILE / FORMAT TOOLS
    ├── FASTA parser      read/write FASTA
    ├── PDB parser        read/write PDB / mmCIF
    ├── CSV / Excel       read/write tabular data
    └── Structure viewer  generate 3D structure visualization assets
```



### Tool registry design

Every tool is registered with:

- name, version, description
- input schema and output schema
- estimated runtime and cost
- trace flag (always on)
- approval requirement (e.g., expensive tools above a time threshold)

The agent selects tools from this registry at plan time. New tools are added by registering them — no agent code changes needed.

---



## Specialist Agent Pool

SynqLab maintains a pool of specialist agents. The main orchestrator delegates to them when the task requires domain expertise, multi-step reasoning, or a closed learning loop.

```
SynqLab Agent
│
├── Aria          biological sequence design (proteins, peptides, antibodies, enzymes)
├── Edison/Crow   literature search, paper retrieval, evidence synthesis
├── Falcon        deep structured reports and synthesis across sources
├── Phoenix       computational chemistry, small molecules, SMILES (SmileyLlama-backed)
├── Finch         data analysis, statistics, visualization
├── Lab Agent     in-vitro execution: synthesis ordering, assay management, result ingestion
└── [future]      regulatory, imaging, omics, clinical agents
```

Each specialist agent:

- Has its own versioned model(s) and tools
- Receives structured task inputs from the main agent
- Returns structured outputs + trace records
- Can trigger its own closed learning loop
- Reads from and writes to the Knowledge Store

See `[agents/README.md](agents/README.md)` for the full agent pool spec.

---



## Traceability and Audit Trail

Traceability is not a feature. It is a **core constraint** that every component must satisfy from day one.

### Why

1. Drug discovery requires reproducing results months or years later
2. FDA/EMA/Health Canada require complete documentation for submissions
3. IP and inventorship disputes need timestamped evidence
4. Multi-project learning requires clean data provenance
5. Debugging failed experiments requires knowing exactly what ran and when



### What gets recorded

Every action produces an **audit record**:

```json
{
  "event_id": "<uuid>",
  "timestamp": "<ISO8601>",
  "actor": {
    "user_id": "<id>",
    "agent": "synqlab-agent | aria | ...",
    "version": "<agent_version>"
  },
  "action": "<action_type>",
  "inputs": { ... },
  "outputs": { ... },
  "tool": "<tool_name>",
  "tool_version": "<version>",
  "project_id": "<id>",
  "approval": {
    "required": true,
    "approved_by": "<user_id>",
    "approved_at": "<ISO8601>",
    "reason": "<text>"
  },
  "hash": "<sha256 of record content>"
}
```



### Audit log properties

- **Append-only**: records are never modified or deleted
- **Hashed**: each record hashes its own content; chain is detectable if tampered
- **Signed**: human approvals include user identity and electronic signature
- **Queryable**: full search by project, user, date, action type, entity
- **Exportable**: generates audit reports for regulatory submissions



### Data lineage

Every artifact (dataset, model, candidate, result) carries lineage:

```
candidate_001
  ├── generated by: aria v0.2.1
  ├── from prompt: <prompt_id>
  ├── scored by: esmfold v1.0, chai-1 v1.1
  ├── scores: {plddt: 87.2, iptm: 0.74, ...}
  ├── project: <project_id>
  └── created: 2026-05-24T15:00:00Z
```

This connects every candidate back to the model, prompt, and data that produced it.

---



## IP Handling



### Multi-tenant isolation

- Each organization's data, models, and outputs are fully isolated
- No cross-tenant data access, gradient sharing, or inference leakage
- Shared only: public knowledge (literature, public databases, base model weights)
- Every tenant signs MSA confirming isolation guarantees



### Within-organization conflict detection

When a scientist registers a hypothesis or candidate:

1. System hashes and timestamps it with a signed record
2. Similarity search runs against all other hypotheses in the same org
3. If similar work exists, agent surfaces it: "Team X is exploring a similar target"
4. Scientist can mark their work as stealth (no internal visibility) or shared
5. First-to-register timestamp is recorded as IP tie-breaker



### Public-domain monitoring (real-time)

For every active project, SynqLab continuously watches:


| Source                      | What we watch                                                            |
| --------------------------- | ------------------------------------------------------------------------ |
| USPTO / EPO / WIPO          | New patent applications containing similar sequences, scaffolds, targets |
| PubMed / bioRxiv / chemRxiv | New preprints and papers disclosing similar work                         |
| ClinicalTrials.gov          | Similar candidate compounds entering trials                              |


Alert format: "A patent filed by [org] on [date] covers a sequence with 87% identity to your candidate."

### Novelty check before candidate submission

Before surfacing a candidate as "novel":

1. BLAST against patented sequences (USPTO protein sequence database)
2. MMseqs2 against public databases (UniProt, PDB, OAS)
3. Tanimoto/shape similarity for small molecules (Phoenix track)
4. Literature search via Edison for prior disclosure

Output: `novelty_score`, `closest_prior_art`, `freedom_to_operate_flag`, `recommended_action`

### AI inventorship documentation

SynqLab generates an **inventor contribution report** for each candidate:

- Human prompts, decisions, and approvals (from audit log)
- AI-generated steps and suggestions
- Which human directed which outcome

This protects patent validity under current US/EU/UK law (AI cannot be named as inventor; human direction must be documented).

### Cross-tenant privacy-preserving conflict detection (opt-in)

Two organizations can both opt in to an anonymous conflict-detection service:

1. Each org's hypotheses are hashed with a one-way function
2. Hashes are compared by a neutral server — no raw data is exchanged
3. If similarity above threshold: both orgs receive "another party may be working in this space"
4. Neither learns who the other is
5. Both can then file provisional patents faster

---



## Hypothesis Generation



### Single-pass generation (baseline)

Agent generates hypotheses from:

- User context (goal, target, prior data)
- Knowledge store (project memory, past results)
- Domain knowledge (literature via Edison, ontologies, pathways)



### Multi-persona diversity

Same problem is sent to multiple "perspectives" in parallel:

- Biologist persona: mechanism-first
- Chemist/sequence persona: structure-first
- Clinical persona: safety/manufacturability-first
- Computational persona: prediction-first

Results are merged and deduplicated.

### Critic-refiner loop

```
Generator  →  proposes hypothesis
    ↓
Critic     →  attacks: prior art? contradicting evidence? weak mechanism? infeasible assay?
    ↓
Refiner    →  addresses critique, produces improved hypothesis
    ↓
[repeat until critic passes or confidence threshold met]
```



### Evidence grounding

Every hypothesis must cite:

- At least one literature source (via Edison)
- One mechanistic basis
- One experimental precedent or computational analog
- Explicit risk factors

Hypotheses that cannot cite are flagged, not discarded.

### Negative-result memory

Every failed experiment is recorded and indexed. Before generating a new hypothesis, the agent checks: "has a similar hypothesis been tried and failed?" If yes, it surfaces the result and asks the user to confirm they want to try again, or suggests modifications.

### Bayesian active-learning loop

For iterative design tasks (like Aria):

- Maintain a posterior over "what properties predict success for this target"
- Each evaluation updates the posterior
- Next hypothesis maximizes expected information gain, not just predicted reward

This is the formal generalization of SmileyLlama's iterative DPO loop to the hypothesis level.

---



## Compute Layer



### Job submission abstraction

The agent treats compute like a tool:

```python
compute.submit_job(
    type="finetune | fold | dock | score | custom",
    config={...},
    priority="low | standard | urgent",
    budget_gpu_hours=10,
    notify_on_complete=True
)
```

Supported backends (roadmap):


| Backend               | Use case                                   |
| --------------------- | ------------------------------------------ |
| Local GPU             | Development, small runs                    |
| Slurm / HPC           | Academic cluster integration               |
| AWS / GCP / Azure     | Cloud burst                                |
| Vast.ai / Lambda Labs | Cost-optimized GPU rental                  |
| Specialized providers | Folding APIs (ESMFold, Chai), docking APIs |




### Budget tracking

Every project has a compute budget. The agent:

- Estimates cost before submitting any job
- Requires approval for jobs above a user-set threshold
- Tracks running total: GPU-hours, API calls, estimated dollars
- Warns when approaching limits
- Records all compute usage in the audit log

---



## Lab Agent (In-Vitro Integration — Roadmap)

Today SynqLab is in-silico only. In-vitro integration is implemented as a **specialist agent** — the Lab Agent — not just a tool category. This is a key design decision: lab execution involves complex state management, vendor negotiation, async result polling, sample tracking, and protocol versioning. That complexity belongs in an agent, not a simple function call.

### Why the Lab Agent is an agent, not a tool


| Tool                           | Agent                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Synchronous — returns a result | Asynchronous — may take days to return                       |
| Stateless                      | Stateful — tracks samples, batches, vendor queues            |
| Single operation               | Multi-step: order → track → receive → QC → ingest            |
| No learning                    | Can learn which protocols, vendors, and conditions work best |




### The Knowledge Store as the bridge

The Knowledge Store is what connects in-silico and in-vitro. It is the shared workspace both Aria and the Lab Agent read from and write to:

```
┌─────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE STORE                          │
│  candidates  │  scores  │  assay results  │  protocols     │
└──────┬───────┴────┬──────┴────────┬────────┴───────────────┘
       │            │               │
       ▼            │               ▼
   Aria writes      │         Lab Agent writes
   candidates +     │         assay results +
   in-silico        │         sample metadata
   scores           │
                    │
              SynqLab Agent
              reads both sides,
              decides what to
              advance and when
```

The full closed loop:

```
Aria
  generates N candidates
  scores in-silico (pLDDT, ipTM, developability)
  writes top-K to Knowledge Store (status: in_silico_complete)
        ↓
SynqLab Agent
  reads Knowledge Store
  selects candidates to advance to wet-lab
  triggers Lab Agent with candidate list + assay protocol
  writes approval record to audit log
        ↓
Lab Agent
  orders synthesis (Twist / GenScript / Synthego)
  tracks vendor status (polling)
  receives samples → assigns sample IDs → logs chain of custody
  runs assay (Emerald Cloud Lab / Strateos / in-house)
  reads results (plate reader, SPR, HPLC, cell viability)
  writes assay results to Knowledge Store (status: assay_complete)
        ↓
SynqLab Agent
  reads results
  flags active vs inactive candidates
  triggers Aria DPO cycle:
    chosen  = candidates with strong assay results
    rejected = candidates with weak assay results
        ↓
Aria
  DPO training on wet-lab preferences
  generates improved candidates
  [loop repeats]
```



### Lab Agent responsibilities

```
Lab Agent
├── Synthesis ordering      (Twist, GenScript, Synthego APIs)
├── Vendor status tracking  (async polling, status updates to Knowledge Store)
├── Sample management       (ID assignment, location, chain of custody)
├── Protocol management     (versioned assay protocols as code)
├── Assay submission        (Emerald Cloud Lab, Strateos, or local LIMS)
├── Result ingestion        (plate reader, SPR, HPLC, cell assay outputs)
├── QC flagging             (flag failed runs, contamination, low confidence)
└── Knowledge Store push    (structured result records with full lineage)
```



### Lab Agent tool interface

```python
lab_agent.order_synthesis(
    candidates=["sha256:abc123", "sha256:def456"],   # Knowledge Store IDs
    format="peptide | gene | oligonucleotide",
    vendor="twist | genscript | synthego",
    project_id="proj_abc",
    budget={"max_usd": 2000}
)

lab_agent.submit_assay(
    sample_ids=["sample_001", "sample_002"],
    protocol="binding_assay_v3",       # versioned protocol
    target="EGFR_kinase_domain",
    provider="emerald | strateos | local"
)

lab_agent.ingest_results(
    run_id="run_007",
    result_file="plate_reader_export.csv",
    result_type="binding_affinity | viability | HPLC"
)
```

All Lab Agent calls go through the same plan-approve-trace flow as any other agent call. Lab actions above a cost threshold require explicit human approval before execution.

### Sample tracking schema

Every physical sample has a record in the Knowledge Store:

```json
{
  "sample_id": "spl_001",
  "candidate_id": "sha256:abc123",
  "sequence": "MKVL...",
  "synthesis_vendor": "twist",
  "synthesis_order_id": "twist_order_99",
  "synthesis_status": "delivered",
  "location": "freezer_B2_box4_pos12",
  "chain_of_custody": [
    {"event": "ordered", "by": "lab_agent_v0.1", "at": "2026-06-01T10:00Z"},
    {"event": "received", "by": "lab_agent_v0.1", "at": "2026-06-05T14:00Z"},
    {"event": "assay_run", "by": "emerald_cloud_lab", "at": "2026-06-06T09:00Z"}
  ],
  "assay_results": [
    {"assay": "SPR_binding", "target": "EGFR", "kd_nM": 45.2, "run_id": "run_007"}
  ]
}
```



### Protocols as code

Lab protocols are versioned YAML files — parameterized and linked to results:

```yaml
protocol_id: binding_assay_v3
version: 0.3.1
description: SPR binding assay for peptide-protein interaction
instrument: Biacore 8K
steps:
  - step: immobilize_target
    target_concentration_ug_ml: 50
    flow_cell: FC2
  - step: inject_analyte
    concentrations_nM: [1, 5, 10, 50, 100, 500]
    flow_rate_ul_min: 30
    contact_time_s: 120
    dissociation_time_s: 300
  - step: regeneration
    reagent: glycine_pH2
    cycles: 3
analysis:
  model: 1_to_1_langmuir
  report: [kd, ka, kd_nM, rmax, chi2]
```



### Planned lab vendors


| Vendor                                                | Type                            | URL                                                                  |
| ----------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| [Emerald Cloud Lab](https://www.emeraldcloudlab.com/) | Full remote lab automation      | [https://www.emeraldcloudlab.com/](https://www.emeraldcloudlab.com/) |
| [Strateos](https://strateos.com/)                     | Robotic cloud lab               | [https://strateos.com/](https://strateos.com/)                       |
| [Twist Bioscience](https://www.twistbioscience.com/)  | DNA/peptide synthesis           | [https://www.twistbioscience.com/](https://www.twistbioscience.com/) |
| [GenScript](https://www.genscript.com/)               | Peptide, gene, protein services | [https://www.genscript.com/](https://www.genscript.com/)             |
| [Synthego](https://www.synthego.com/)                 | Gene / oligo synthesis          | [https://www.synthego.com/](https://www.synthego.com/)               |
| [Benchling](https://www.benchling.com/)               | LIMS for local lab tracking     | [https://www.benchling.com/](https://www.benchling.com/)             |


---



## FDA / Regulatory Trajectory


| Phase             | SynqLab Role                                                      |
| ----------------- | ----------------------------------------------------------------- |
| Discovery (today) | Candidate generation, scoring, triage, experiment memory          |
| Lead optimization | Iterative closed-loop design with property tracking               |
| Preclinical       | Full audit trail of in-silico + in-vitro evidence                 |
| IND filing        | Auto-draft study summaries from audit log                         |
| Clinical          | Data package assembly, protocol tracking                          |
| BLA/NDA           | Full lineage of every candidate back to original design decisions |




### 21 CFR Part 11 compliance (roadmap)

US FDA requires electronic records to be:

- Attributable (who did it)
- Legible and permanent
- Contemporaneous (recorded when it happens)
- Original or a certified copy
- Accurate

SynqLab's audit log is designed to satisfy these by construction.

---



## Cross-Project Learning

SynqLab can learn across projects while preserving tenant isolation:


| Layer          | What is learned                                     | Privacy                 |
| -------------- | --------------------------------------------------- | ----------------------- |
| Within-project | What worked, what failed, model artifacts           | Private to project      |
| Within-org     | Patterns across projects, shared model fine-tunes   | Private to org          |
| Cross-org      | Abstract patterns (no raw data), base model updates | Opt-in only, aggregated |


Cross-org learning uses differential-privacy-style aggregation:
raw data never leaves the tenant; only gradient signals or abstract summaries contribute.

---



## Multi-Modal Input

Scientists provide data in many formats. SynqLab accepts:


| Input type   | Examples                                          |
| ------------ | ------------------------------------------------- |
| Text         | Goals, descriptions, notes, hypothesis statements |
| Sequences    | FASTA, plain text (protein, DNA, RNA)             |
| Structures   | PDB, mmCIF, SDF                                   |
| Spreadsheets | CSV, Excel (assay results, compound lists)        |
| Documents    | PDFs (papers, protocols, reports)                 |
| Images       | Gel images, microscopy, plate reader images       |
| Notebooks    | Jupyter notebooks as starting context             |


---



## Versioning Policy


| Artifact   | What is versioned                      | How                                     |
| ---------- | -------------------------------------- | --------------------------------------- |
| Datasets   | schema + content hash                  | content-addressed storage               |
| Models     | weights + training config + base model | model registry with semantic versioning |
| Prompts    | full prompt text + template version    | prompt registry                         |
| Tools      | tool binary/API + config               | tool registry with version pin          |
| Protocols  | full YAML/JSON                         | git-style version history               |
| Candidates | generation params + scores + lineage   | artifact registry                       |


---



## Database Architecture

SynqLab uses purpose-fit databases per data type. No single database handles everything.

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│                                                                 │
│  PostgreSQL + pgvector   ← primary relational store             │
│  (candidates, projects,    + vector similarity search           │
│   users, audit log,        + full-text search                   │
│   assay results)                                                │
│                                                                 │
│  Object storage (S3/GCS) ← large artifacts                      │
│  (model weights, PDB       content-addressed by hash            │
│   files, datasets,                                              │
│   structure files)                                              │
│                                                                 │
│  Neo4j / Kuzu            ← knowledge graph                      │
│  (protein interactions,    GraphRAG queries                     │
│   disease associations,                                         │
│   literature entities)                                          │
│                                                                 │
│  Redis                   ← ephemeral cache                      │
│  (session state,           job queue                            │
│   agent working memory,                                         │
│   rate-limit counters)                                          │
└─────────────────────────────────────────────────────────────────┘
```



### Per-store responsibilities


| Store                     | Technology                                      | What lives here                                                                                                   |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Primary relational**    | PostgreSQL                                      | Projects, users, candidates, scores, assay results, audit log, prompt registry, tool versions                     |
| **Vector similarity**     | pgvector (built into PostgreSQL)                | Sequence embeddings, hypothesis embeddings, literature chunk embeddings                                           |
| **Large artifacts**       | S3 / GCS / MinIO (self-hosted)                  | Model weights, PDB/mmCIF structures, raw datasets, generated files                                                |
| **Knowledge graph**       | Neo4j (managed) or Kuzu (embedded, open-source) | Protein–protein interactions, drug–target associations, disease–gene links, paper citations, entity relationships |
| **Cache / queue**         | Redis                                           | Agent session memory, job queue, rate limiting, real-time notifications                                           |
| **Time-series** (roadmap) | TimescaleDB or InfluxDB                         | Compute usage metrics, training curves, assay time-series data                                                    |




### Why pgvector instead of a separate vector DB

- Reduces operational complexity: one database handles relational + vector queries
- Joins between candidates and their embeddings are local — no cross-service round trips
- Works well up to tens of millions of vectors; migrate to dedicated store (Qdrant, Weaviate) at scale
- pgvector supports HNSW indexing since PostgreSQL 16



### Model and data versioning (DVC / MLflow)


| Tool                                        | Use                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| [DVC](https://dvc.org/)                     | Data version control — large dataset files tracked by hash, stored in object storage |
| [MLflow](https://mlflow.org/)               | Experiment tracking — training runs, metrics, parameters, model artifacts            |
| [Hugging Face Hub](https://huggingface.co/) | Model registry for fine-tuned Aria / Phoenix weights                                 |


Every training run records in MLflow: base model, LoRA config, dataset hash, eval metrics. Artifact is pushed to HuggingFace Hub or internal registry, pinned by SHA.

---



## Data Tracing — Implementation Detail

Data tracing goes beyond the audit log. It tracks the full lineage of every artifact from raw database record to final candidate.

### Content-addressed artifact storage

Every artifact is identified by the SHA-256 hash of its content:

```
sha256("MKVL...") → hash_id
stored at: s3://synqlab-artifacts/{tenant}/{hash_id}
```

This means: if two projects generate the same sequence from different paths, they share the same artifact storage but have independent lineage records.

### Lineage DAG

Every artifact carries a `parents` list pointing to the artifacts it was derived from:

```json
{
  "artifact_id": "sha256:abc123",
  "type": "candidate_sequence",
  "value": "MKVLLL...",
  "parents": [
    {"artifact_id": "sha256:prompt_xyz", "role": "prompt"},
    {"artifact_id": "sha256:model_v2", "role": "model"}
  ],
  "created_by": "aria v0.2.1",
  "created_at": "2026-05-24T20:00:00Z",
  "project_id": "proj_abc",
  "scores": {
    "plddt": 84.2,
    "iptm": 0.71,
    "novelty": 0.89
  }
}
```

Following parents recursively gives the full provenance tree from any artifact back to the raw database records.

### Sequence-level tracing in Aria

For every Aria candidate:

```
UniProt record (swiss_prot_id: P00533)
  ↓  feature extraction (tool: biopython 1.81, script: extract_features.py@sha256:...)
  ↓  prompt generation (template: v1.2@sha256:...)
  ↓  SFT training (model: llama-3.1-8b, dataset: swissprotv2025@sha256:..., run: mlflow:run_001)
  ↓  inference (aria v0.2.1, temp=0.8, seed=42)
  → candidate: MKVL... (hash: sha256:abc123)
  ↓  ESMFold scoring (version: 1.0.3, plddt=84.2)
  ↓  Chai-1 scoring (version: 1.2, iptm=0.71)
  → scored candidate (hash: sha256:def456)
  ↓  DPO pair construction (paired with sha256:ghi789 as rejected)
  → DPO training round 2 (model: aria v0.3.0)
```

Every arrow is a recorded event in the audit log. The whole graph is queryable.

### Immutable audit chain

Each audit record references the hash of the previous record in the same project:

```json
{
  "event_id": "evt_002",
  "prev_hash": "sha256:evt_001_hash",
  "content_hash": "sha256:this_record_content",
  ...
}
```

Tampering with any record breaks the chain — detectable by hash verification.

---



## FutureHouse / Edison Integration



### What FutureHouse provides

[FutureHouse](https://www.futurehouse.org/) offers a suite of AI scientific agents accessible via API:


| Agent             | Capability                                                                | Best for                                                 |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Crow / Edison** | Literature search and retrieval across PubMed, bioRxiv, ChemRxiv, patents | Finding evidence, prior art, related papers              |
| **Falcon**        | Deep multi-step report generation from scientific sources                 | Synthesis reports, review sections, regulatory summaries |
| **Owl**           | Scientific Q&A with citations                                             | Answering factual scientific questions                   |
| **Finch**         | Data analysis and interpretation                                          | Interpreting assay results, statistics                   |
| **Kosmos**        | Multimodal scientific analysis (images, structures, plots)                | Gel analysis, structural interpretation                  |


Reference: [FutureHouse paper](https://www.futurehouse.org/research) and `Codes/robin/FUTUREHOUSE.md`

### Integration pattern

SynqLab wraps FutureHouse agents as registered tools with the standard plan-approve-trace contract:

```python
# SynqLab calls Edison like any other tool
result = tools.call(
    tool="futurehouse.crow",
    inputs={
        "query": "peptide binders for EGFR CDR1 domain",
        "sources": ["pubmed", "biorxiv", "patents"],
        "max_papers": 20,
        "date_range": "2020-2026"
    },
    trace=True,   # always traced
    project_id="proj_abc"
)
```

Output is wrapped in a SynqLab `AuditRecord` before being stored or used downstream.

### When the SynqLab agent routes to FutureHouse


| User goal                                   | Routed to            |
| ------------------------------------------- | -------------------- |
| "What is known about EGFR peptide binders?" | Crow / Edison        |
| "Write a background section on this target" | Falcon               |
| "Is there prior art for this sequence?"     | Crow (patent search) |
| "Interpret these assay results"             | Finch                |
| "What does this gel image show?"            | Kosmos               |
| "Generate candidate peptides for EGFR"      | Aria                 |




### Fallback and reliability

- If FutureHouse API is unavailable, SynqLab falls back to PubMed E-utilities + arXiv API directly
- All FutureHouse results are cached in the knowledge store with expiry timestamps
- Cached results are reused for the same query within a project (configurable TTL)
- Cost tracking: every FutureHouse API call logs tokens used and estimated cost



### Evidence injection into Aria

FutureHouse results can feed directly into Aria's context:

```
Edison retrieves: "5 papers on EGFR peptide binder CDR1 contacts"
        ↓
SynqLab Knowledge Store extracts: known binder sequences + interface residues from papers
        ↓
Aria prompt is enriched with: "Known binders from literature: [...]"
        ↓
Aria generates: candidates grounded in literature context
```

This grounds Aria's generation in experimental evidence rather than model prior alone.

---



## GraphRAG Knowledge Store



### What GraphRAG is

Standard RAG (Retrieval-Augmented Generation) retrieves flat text chunks by vector similarity.
GraphRAG extends this by first building a **knowledge graph** of entities and relationships,
then traversing the graph for multi-hop reasoning before generating answers.

For drug discovery, this is critical: the answer to "what proteins interact with target X that are also implicated in disease Y?" requires traversing multiple relationship types — not just matching text chunks.

Reference: [Microsoft GraphRAG](https://github.com/microsoft/graphrag)

### SynqLab knowledge graph schema

Nodes:


| Node type    | Properties                                     | Source              |
| ------------ | ---------------------------------------------- | ------------------- |
| `Protein`    | uniprot_id, name, sequence, organism, function | UniProt, PDB        |
| `Drug`       | chembl_id, name, SMILES, mechanism             | ChEMBL, DrugBank    |
| `Target`     | name, family, disease associations             | ChEMBL, OpenTargets |
| `Disease`    | mondo_id, name, description                    | MONDO, OMIM         |
| `Paper`      | doi, title, authors, date, abstract            | PubMed, bioRxiv     |
| `Assay`      | assay_id, type, result, conditions             | project data        |
| `Candidate`  | aria_id, sequence, scores, version             | Aria outputs        |
| `Hypothesis` | hyp_id, statement, evidence, status            | SynqLab agent       |


Edges:


| Edge              | From → To                      | Properties           | Source            |
| ----------------- | ------------------------------ | -------------------- | ----------------- |
| `INTERACTS_WITH`  | Protein → Protein              | confidence, source   | STRING, BioGRID   |
| `BINDS_TO`        | Drug/Candidate → Target        | affinity, assay type | ChEMBL, BindingDB |
| `ASSOCIATED_WITH` | Target/Gene → Disease          | evidence score       | OpenTargets, OMIM |
| `EXPRESSED_IN`    | Protein → Tissue               | expression level     | GTEx, HPA         |
| `CITES`           | Paper → Paper                  | —                    | PubMed            |
| `REPORTS`         | Paper → Assay/Result           | —                    | NLP extraction    |
| `GENERATED`       | Aria → Candidate               | version, prompt      | SynqLab trace     |
| `VALIDATES`       | Assay → Candidate              | result               | project data      |
| `PART_OF_PROJECT` | Candidate/Hypothesis → Project | —                    | SynqLab           |




### Query examples enabled by graph traversal

```cypher
// Find all proteins that interact with EGFR and are implicated in NSCLC
MATCH (egfr:Protein {name: "EGFR"})-[:INTERACTS_WITH]-(partner:Protein)
      -[:ASSOCIATED_WITH]->(disease:Disease {name: "NSCLC"})
RETURN partner.name, partner.uniprot_id

// Find candidates generated by Aria that have validated assay results
MATCH (c:Candidate)<-[:GENERATED]-(aria:Agent)
      (c)<-[:VALIDATES]-(assay:Assay {result: "active"})
RETURN c.sequence, c.scores, assay.affinity

// Find papers that discuss both EGFR and peptide binders, published after 2022
MATCH (p:Paper)-[:REPORTS]->(a:Assay)-[:BINDS_TO]->(t:Target {name: "EGFR"})
WHERE p.date > "2022-01-01"
RETURN p.title, p.doi, p.date
```



### GraphRAG query flow

```
User query: "What binder strategies worked for kinase domains similar to EGFR?"
        ↓
Entity extraction: [EGFR, kinase domain, binder]
        ↓
Graph traversal: EGFR → related kinases (by family) → known binders → assay results → papers
        ↓
Subgraph extraction: relevant nodes + edges + text summaries
        ↓
Context assembly: graph context + retrieved paper chunks
        ↓
LLM generation: grounded answer with citations and candidate suggestions
```



### GraphRAG tools and libraries


| Tool                             | Use                                                        | URL                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Microsoft GraphRAG**           | Graph construction + community summarization + query       | [https://github.com/microsoft/graphrag](https://github.com/microsoft/graphrag)                                                                               |
| **LlamaIndex** (property graph)  | Lighter-weight graph index + RAG pipeline                  | [https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/](https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/) |
| **Neo4j**                        | Production graph database (managed cloud available)        | [https://neo4j.com/](https://neo4j.com/)                                                                                                                     |
| **Kuzu**                         | Embedded graph DB — simpler ops, good for single-node      | [https://kuzudb.com/](https://kuzudb.com/)                                                                                                                   |
| **LangChain GraphCypherQAChain** | NL → Cypher → Neo4j                                        | [https://python.langchain.com/docs/integrations/graphs/neo4j_cypher/](https://python.langchain.com/docs/integrations/graphs/neo4j_cypher/)                   |
| **NetworkX**                     | In-memory graph for small subgraphs during agent reasoning | [https://networkx.org/](https://networkx.org/)                                                                                                               |
| **Biomedical KG sources**        | Pre-built graphs to import                                 | [SPOKE](https://spoke.ucsf.edu/), [PrimeKG](https://github.com/mims-harvard/PrimeKG), [OpenBioLink](https://github.com/OpenBioLink/OpenBioLink)              |




### Pre-built biomedical knowledge graphs to import

Rather than building from scratch, import existing graphs:


| Graph           | Contents                                                                    | URL                                                                                      |
| --------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **PrimeKG**     | 10 biomedical databases unified: diseases, drugs, genes, proteins, pathways | [https://github.com/mims-harvard/PrimeKG](https://github.com/mims-harvard/PrimeKG)       |
| **SPOKE**       | UCSF knowledge graph: proteins, drugs, diseases, genes, side effects        | [https://spoke.ucsf.edu/](https://spoke.ucsf.edu/)                                       |
| **OpenBioLink** | Protein interactions, drug-target, disease associations                     | [https://github.com/OpenBioLink/OpenBioLink](https://github.com/OpenBioLink/OpenBioLink) |
| **DrugBank**    | Drug-target interactions, mechanisms, pathways                              | [https://www.drugbank.com/](https://www.drugbank.com/)                                   |
| **OpenTargets** | Target-disease associations with evidence scores                            | [https://www.opentargets.org/downloads](https://www.opentargets.org/downloads)           |
| **STRING**      | Protein-protein interaction network (functional associations)               | [https://string-db.org/cgi/download](https://string-db.org/cgi/download)                 |
| **ChEMBL**      | Bioactivity database: compounds, targets, assays                            | [https://www.ebi.ac.uk/chembl/db/index/](https://www.ebi.ac.uk/chembl/db/index/)         |




### Integration with Aria

GraphRAG enhances Aria in two ways:

**1. Hypothesis grounding at generation time**

Before Aria generates candidates for a target, the agent queries the graph:

- What is known about this target family?
- What binding motifs have worked for related targets?
- What assay failures have been recorded?

This context is injected into Aria's prompt.

**2. Candidate enrichment after generation**

After Aria generates candidates, the graph is queried:

- Does this sequence match any known binder?
- Is this target known to have off-target interactions?
- Are there patents covering similar sequences?

This enriches the candidate record before it is scored and ranked.

---



## Extended Tool Registry (Recommended Additions)

Beyond the current tool set, the following capabilities are needed for a production-grade drug discovery platform:

### Bash / Shell Execution

The Python sandbox alone is insufficient. Most bioinformatics tools are CLI-native and many compute operations require shell access.

```
├── CODE EXECUTION (extended)
│   ├── Python sandbox   execute agent-written Python scripts (existing)
│   ├── Bash sandbox     execute shell commands (sandboxed, allowlisted)
│   └── Container run    execute commands inside a Docker container
```

**Why bash is needed:**


| Use Case                   | Why Bash Required                                        |
| -------------------------- | -------------------------------------------------------- |
| Bioinformatics CLI tools   | BLAST, HMMER, samtools, bedtools, fastp — all CLI-native |
| HPC job submission         | `sbatch`, `qsub` for Slurm/PBS clusters                  |
| Docker/container execution | Reproducible tool environments                           |
| Pipeline orchestration     | Snakemake, Nextflow — invoked from shell                 |
| Environment management     | conda/pip for dependency installation per project        |
| File system operations     | Large-scale data movement, directory scaffolding         |
| Git operations             | Versioning experiment code/configs directly              |
| Tool installation          | Installing new tools on-the-fly                          |


**Security model — sandboxed, allowlisted:**

```python
tools.call(
    tool="bash",
    inputs={
        "command": "blastp -query candidate.fasta -db nr -outfmt 6",
        "working_dir": "/project/proj_abc/workspace/",
        "timeout_s": 300,
        "allowed_binaries": ["blast*", "hmmer*", "samtools", "conda", "git"]
    },
    approval_required=False,   # pre-approved commands
    trace=True
)
```

**Bash sandbox constraints:**

- No arbitrary network access (allowlisted endpoints only)
- Allowlisted binaries only (no destructive commands)
- Working directory confined to project workspace
- All stdout/stderr captured and traced in audit log
- Timeout enforced (configurable per command)
- Resource limits (memory, CPU, disk)
- Elevated commands (install, network) require human approval

---



### Container Execution

For reproducible, isolated tool environments:

```python
tools.call(
    tool="container_run",
    inputs={
        "image": "biocontainers/blast:2.15.0",
        "command": "blastp -query /data/input.fasta -db /db/nr -outfmt 6",
        "mounts": {
            "/data": "/project/proj_abc/workspace/",
            "/db": "/shared/blast_db/"
        },
        "timeout_s": 600,
        "gpu": False
    },
    trace=True
)
```

Benefits:

- Tool version pinning at OS/dependency level
- No host system contamination
- Reproducible across environments
- Pre-built biocontainers available for most tools

---



### External API / HTTP Client

For programmatic access beyond registered database tools:

```
├── EXTERNAL API
│   ├── HTTP client      GET/POST to allowlisted APIs (UniProt, PDB, ChEMBL REST)
│   ├── PubMed E-utils   direct NCBI access (fallback when Edison unavailable)
│   └── arXiv API        direct arXiv search and fetch
```

```python
tools.call(
    tool="http_client",
    inputs={
        "method": "GET",
        "url": "https://rest.uniprot.org/uniprotkb/P00533.json",
        "allowlist": ["rest.uniprot.org", "data.rcsb.org", "www.ebi.ac.uk"]
    },
    trace=True
)
```

---



### Workflow / Pipeline Engine

Multi-step experiments expressed as pipelines rather than sequential agent steps:

```
├── WORKFLOW
│   ├── Nextflow runner    submit and monitor Nextflow pipelines
│   ├── Snakemake runner   submit and monitor Snakemake pipelines
│   └── DAG executor       run a dependency graph of tool calls in parallel
```

```python
tools.call(
    tool="workflow.dag_executor",
    inputs={
        "steps": [
            {"id": "fold", "tool": "esmfold", "inputs": {"sequences": "..."}},
            {"id": "score", "tool": "foldx", "depends_on": ["fold"]},
            {"id": "cluster", "tool": "mmseqs2", "depends_on": ["score"]}
        ],
        "parallelism": 4
    },
    trace=True
)
```

Enables: "fold 100 sequences, score them all, cluster, pick top 10" as a single traced operation.

---



### Notification / Communication

For async workflows and human-in-the-loop operations:

```
├── COMMUNICATION
│   ├── Notify user       email / Slack / webhook on job completion or issue
│   ├── Request review    surface results for human scientific review
│   └── Handoff           transfer project context to another user or agent
```

Critical for:

- Lab Agent workflows (days between ordering and receiving results)
- Long compute jobs (hours)
- Multi-user projects where one person starts work and another reviews

---



### Visualization Generation

Extend beyond structure viewer to general scientific visualization:

```
├── VISUALIZATION (extended)
│   ├── Structure viewer  3D molecular visualization (existing)
│   ├── Plot generator    matplotlib/plotly charts from tabular data
│   ├── Alignment viewer  multiple sequence alignment visualization
│   ├── Report builder    PDF/HTML report from templates + data + figures
│   └── Dashboard         interactive project progress dashboard
```

---



### Environment / Dependency Management

For reproducibility across projects and over time:

```
├── ENVIRONMENT
│   ├── Conda env         create/activate project-specific environments
│   ├── Container build   build and register Docker images for project tools
│   └── Dependency pin    lock all tool + library versions for a project snapshot
```

Every project should have a pinned environment spec so results from 2026 can be reproduced in 2028.

---



### Priority Matrix


| Category                | Tools                            | Priority | Blocks                              |
| ----------------------- | -------------------------------- | -------- | ----------------------------------- |
| **Bash sandbox**        | Shell + allowlist + tracing      | High     | CLI bioinformatics, HPC             |
| **Container execution** | Docker run with isolation        | High     | Reproducibility, complex tools      |
| **HTTP/API client**     | Allowlisted external APIs        | Medium   | Direct database programmatic access |
| **Workflow engine**     | DAG executor, Nextflow/Snakemake | Medium   | Batch operations at scale           |
| **Notifications**       | Email/Slack/webhook alerts       | Medium   | Async workflows (Lab Agent)         |
| **Visualization**       | Plotting, reports, dashboards    | Low      | Nice-to-have for UX                 |
| **Environment**         | Conda/Docker env management      | Low      | Needed at production scale          |


---



## Related Docs


| Doc                      | Link                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| V1 pipeline architecture | `[../engineering/architecture.md](../engineering/architecture.md)`                               |
| Orchestrator component   | `[../engineering/components/orchestrator.md](../engineering/components/orchestrator.md)`         |
| Knowledge store spec     | `[../engineering/design-docs/knowledge-store.md](../engineering/design-docs/knowledge-store.md)` |
| Tool registry            | `[../engineering/registry.md](../engineering/registry.md)`                                       |
| Aria agent spec          | `[agents/aria/aria.md](agents/aria/aria.md)`                                                     |
| Agent pool overview      | `[agents/README.md](agents/README.md)`                                                           |


