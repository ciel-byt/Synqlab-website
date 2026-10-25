# AWS Activate / Cloud Credits Application

## What are you building?

> Provide a detailed description of your business, product, and technologies you might use. This will help us evaluate your application.

### 250-character version (for forms with a hard limit)

> SynqLab: AI agents that run biotech's design-test-learn loop end-to-end—generating protein/peptide candidates, scoring them via GPU pipelines (folding, docking, MD), and retraining models from every experimental result.

(219 characters, including punctuation — fits under a 250-char limit.)

**SynqLab is a closed-loop, agent-orchestrated operating system for AI-assisted molecular design.** We're building the AI research team that runs a biology lab's design–test–learn loop end-to-end — proposing candidates, running the computational pipeline, sending winners to the wet lab, and learning from every outcome (including failures) — so that a lab's institutional knowledge compounds instead of evaporating into disconnected spreadsheets and lab notebooks.

### The problem

Drug and protein discovery today involves world-class point tools (generative models, structure predictors, docking engines, MD simulators) that nobody orchestrates as a system. Every experiment generates data that could improve the next one, but almost none of it feeds back. Task-specific expertise lives in individual scientists' heads, not in reusable models. The result: labs re-derive the same knowledge over and over, and negative results — which are often more informative than positive ones — are thrown away.

### The product

SynqLab runs a repeating **design round** with five stages, orchestrated by an LLM agent that plans, selects tools, and tracks budget:

1. **Generate** — a generative model (ProtGPT2, EvoDiff, PepMLM, RFdiffusion+ProteinMPNN) proposes candidate sequences, shifting from diverse/unconditional generation early on to target-conditioned generation as labeled data accumulates.
2. **Evaluate (gated)** — candidates pass through a cost-ordered filter: fast structure screening (ESMFold pLDDT) → complex-level interface quality (AlphaFold-Multimer / DiffDock-PP) → stability scoring (FoldX / PyRosetta) → a **task-specific learned metric** (e.g., a brightness predictor for our GFP proof of concept) trained directly on the lab's own experimental readouts, rather than relying on generic structural scores alone.
3. **Simulate** — molecular dynamics (GROMACS/OpenMM) is applied selectively to the top-k survivors as a final, expensive filter.
4. **Label** — every candidate evaluated at every stage, including ones eliminated early, is recorded as a labeled data point. Negative results are first-class training data, not discarded noise.
5. **Update** — the task-specific model is retrained every round on all accumulated data; a generator LoRA adapter is optionally fine-tuned when data and budget allow, biasing future generation toward higher-performing regions of sequence space.

This is coordinated by a **core orchestrator agent** plus a growing pool of **specialist agents** — Aria (biological sequence design, our first specialist), with literature-search, cheminformatics, data-analysis, and eventually lab-automation specialists to follow. Every action is logged in an append-only, hash-chained audit trail with full data lineage (which model, which prompt, which dataset version produced which candidate) — a requirement for reproducibility and eventual FDA/regulatory submission trails, not an afterthought.

**Current proof of concept:** designing GFP11 peptide variants that maximize brightness in the split-GFP complementation assay — a fast, cheap, quantitative readout that lets us validate the full closed loop (generate → evaluate → simulate → label → retrain) before moving to harder, higher-value targets like enzyme engineering or small-molecule drug discovery.

### The business

We sell this as infrastructure to biotech/pharma R&D teams running iterative design–test cycles. The differentiator is that the platform's value compounds with usage — each project's task-specific predictive models and the labeled dataset behind them become a durable, defensible asset that improves the next design round, rather than resetting with every new project or hire. Near-term beachhead: computational protein/peptide design. Long-term: any lab running iterative design cycles (drug discovery, enzyme engineering, materials science), and eventually driving physical lab execution (synthesis ordering, assay scheduling, sample tracking) directly.

### Technologies

- **Compute:** GPU-heavy workloads for structure prediction (ESMFold, AlphaFold-Multimer, Chai-1, Boltz-1), docking (DiffDock-PP, AutoDock Vina), MD simulation (GROMACS, OpenMM), and model fine-tuning (LoRA/QLoRA on top of open sequence-generation and structure models). This is our primary driver of cloud compute need — spiky, GPU-bound batch jobs (fold N sequences → score → simulate top-k) rather than steady-state serving.
- **Orchestration/agent layer:** LLM-based orchestrator (built on top of frontier models via API) that plans tool calls, sets gate thresholds, and manages a per-project compute budget; job submission abstracted so work can burst to cloud GPU on demand.
- **Data layer:** PostgreSQL (+ pgvector) as the primary relational and vector-similarity store for candidates, scores, and audit records; object storage (S3) for large artifacts (structures, trajectories, model weights, docking poses) addressed by content hash; Redis for job queuing and agent working-memory cache; a knowledge graph (Neo4j/Kuzu) for literature- and interaction-grounded retrieval (GraphRAG) feeding hypothesis generation.
- **MLOps:** experiment tracking and model/dataset versioning (MLflow, DVC), model registry (Hugging Face Hub / internal registry) pinned by commit hash, so every candidate is traceable back to the exact model, prompt, and data version that produced it.
- **Tooling architecture:** every scientific tool (open-source models, CLI bioinformatics binaries, docking/MD engines) is wrapped behind a uniform adapter contract and declared in a single tool registry, deployed as independent containerized services — so new tools/specialist agents can be added without touching the orchestrator.

On AWS specifically, we'd expect to use EC2/GPU instances (or SageMaker) for batch inference and fine-tuning, S3 for artifact and dataset storage, RDS for Postgres, ElastiCache for Redis, and Batch/Step Functions for job orchestration of the multi-stage evaluation pipeline.