# YC Application — SynqLab AI

**Company Name:** SynqLab AI
**Company URL:** [https://synqlab.ai/](https://synqlab.ai/)

---

## Company

### Describe what your company does in 50 characters or less.

An autonomous operating system for protein design.

### What is your company going to make? Please describe your product and what it does or will do.

SynqLab is an operating system for protein design that gets smarter every time it runs.

Every experiment a biology lab runs produces valuable information — sequences that worked, sequences that didn't, structural predictions, docking scores, stability measurements. Imagine if all of this lived in one place: every tool output, every outcome, every design decision, centralized and connected. An AI system that can learn from every detail — not just the wins, but the near-misses and the failures too — and use all of it to make better predictions next time.

That's what SynqLab does. A researcher describes what they want — "design peptide variants with higher fluorescence" — and the platform orchestrates everything: picking the right computational tools, running them in the right order, filtering candidates through increasingly rigorous checks, and scoring results using metrics trained on that lab's own experimental data. It can also pull in state-of-the-art research — relevant papers, published datasets, known results — and bring them into the project's scope, so the system works with the best available knowledge, not just what's in the lab's own files.

Beyond running existing tools, SynqLab can write code, build its own analysis scripts, and design new tools on the fly — the way a senior researcher would. It doesn't just follow a fixed pipeline; it reasons about what's needed, creates it, and executes it.

Researchers can also design their own pipelines, choose which tools to use, and guide the AI at every step — from fully hands-on to fully autonomous, depending on how much control they want. Everything is captured in one place — every sequence tried, every score computed, every candidate and why it passed or didn't. Each round of experiments feeds directly into the next, so the system improves continuously.

The platform is built and working today. A researcher interacts with it through natural conversation, and behind the scenes, AI agents coordinate specialized biology tools, manage compute budgets, and learn from every outcome across rounds.

We're starting with peptide engineering using a well-understood assay (split-GFP brightness) where we can prove the learning loop works. The long-term vision: connect the platform to physical lab equipment — liquid handlers, plate readers, robotic arms — so a researcher sets up a hypothesis in the evening and wakes up to validated results. Fully autonomous design-build-test-learn, running overnight.

### Where do you live now, and where would the company be based after YC?

[TODO: Sepehr — fill in current city. Note: you're PhD at McMaster (Hamilton, ON) and working in SF Bay Area. Pouriya is in Toronto area.]

We would be based in San Francisco after YC, with a continued R&D presence in Toronto (close to UofT labs and the Canadian biotech ecosystem).

### Explain your decision regarding location.

We're ready to move to San Francisco. It's where the AI and biotech ecosystems overlap, where the investors are, and being close to YC matters at this stage. We'd also maintain a connection to Toronto — both founders have deep roots there, Pouriya did his PhD at the University of Toronto, and the Canadian computational biology community is strong. As we move toward wet-lab validation, having access to that network will be valuable.

## Progress

### How far along are you?

We have a working platform. A researcher can open SynqLab today, describe a protein design goal in plain language, and the system orchestrates the full pipeline autonomously.

We've shipped three milestones across 22 development phases:

- **AI agent system**
  - A coordinator agent that breaks research goals into sub-tasks and spawns specialist worker agents
  - Supports three modes: fully autonomous, supervised (human approves each step), and copilot (human drives, AI assists)
  - 43 tools available to agents across science, coordination, and integration
- **GFP11 closed-loop pipeline** — our first scientific workflow end-to-end:
  - Generate peptide variants, predict structures, score brightness using a model trained on lab data, score stability, evaluate protein interactions, gate candidates, and repeat
  - The pipeline improves each round as the brightness model retrains on accumulated outcomes
- **Visual pipeline editor** — drag-and-drop workflow builder with pre-built templates (protein design, GFP11 optimization, sequence screening). Researchers can customize pipelines or build new ones.
- **Conversational interface** — ChatGPT-style console where researchers describe goals in natural language. The agent can also read and discuss pipeline results, pull in relevant literature, and write its own analysis code.
- **43 computational biology tools** in our registry across 7 categories, each running as its own containerized service behind a unified interface.
- **Extensible skill system** — researchers and teams can define new agent capabilities as simple markdown files without writing code.

On the science side, we published our MDMI framework ([Bayat et al. 2025](https://scholar.google.com/citations?view_op=view_citation&hl=en&user=Lx8-mlMAAAAJ&sortby=pubdate&citation_for_view=Lx8-mlMAAAAJ:M3ejUd6NZC8C)) and presented it as a spotlight talk at NeurIPS. We have 113 experimentally labeled GFP11 sequences that we're using to validate the closed-loop learning approach.

We've had initial conversations with two labs at McMaster University and the University of Toronto about using the platform for protein design projects.

### What tech stack are you using, or planning to use, to build this product?

**Backend:** Python, FastAPI, PostgreSQL

**Frontend:** React

**Agent framework:** LangGraph, OpenAI SDK, Anthropic SDK, DeepSeek, Gemini

**Observability:** Langfuse (usage tracking, tracing)

**ML:** PyTorch**How far along are you?How far along are you?**

**Computational biology tools:** 43 tools in our registry across 7 categories. Each runs as its own containerized service.

- Sequence representation (ESM-2, ProtT5)
- Structure predictors (AlphaFold, ESMFold, OmegaFold)
- Sequence generators (ProtGPT2, PepMLM, RFdiffusion)
- Docking engines (DiffDock-PP)
- Stability scorers (FoldX)
- Molecular dynamics (GROMACS, OpenMM)
- Inverse folding (ProteinMPNN)

**Infrastructure:** Docker Compose, Helm charts (prod), planned K8s deployment, GCP, Azure, AWS

**AI coding tools:** Cursor, Claude Code

### When will you have a version people can use?

The core platform is functional now. We're targeting a pilot-ready version for external labs within 8-12 weeks (by ~July 2026) — this requires production hardening (auth flows, deployment automation, documentation) and running our first validated closed-loop experiment to have quantitative results we can show prospective users.

### If you are applying with the same idea as a previous batch, did anything change?

First-time applicant.

---

## Idea

### Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

**Why this idea:** Pouriya (co-founder, PhD Pharmaceutical Sciences, UofT) spent years working in labs where the design-test-learn cycle for proteins is largely manual. The computational tools have gotten very good — structure predictors, sequence generators, docking engines — but the workflow around them hasn't kept up. Each tool runs separately, results live in different places, and the knowledge from one project rarely carries into the next. We saw an opportunity: this entire workflow can be automated and centralized, and if you do that, you can also make it learn from its own results over time.

**Domain expertise:** We're a complementary team.

- **Pouriya Bayat** — PhD in Pharmaceutical Sciences from the University of Toronto (Leslie Dan Faculty of Pharmacy). Worked across advanced labs internationally, published at NeurIPS AI4D3 workshop (spotlight talk on AI-driven drug discovery), holds two US patents in microfluidic systems. He understands what labs need day-to-day and how to validate computationally designed molecules in real experiments.
- **Sepehr Bayat** — PhD candidate in Computer Science at McMaster University. 10 years of experience in AI/ML and software engineering, including senior roles at Microsoft, Cerence (automotive AI), and a stealth AI startup in SF. Built and shipped the SynqLab platform. Presented SynqLab at NeurIPS 2025.

Pouriya started SynqLab as part of his PhD thesis at the University of Toronto and graduated in September 2025. Since then, he's been working on it full-time. Sepehr contributed part-time during Pouriya's studies and joined full-time in January 2026.

**How we know people need this:** We did market research across the computational biology space and talked directly to researchers at McMaster and UofT. What we found consistently: researchers spend significant time manually chaining computational tools together — running one tool, reformatting the output, feeding it into the next. When we showed them a system that could automate that pipeline and improve across rounds, the interest was immediate. The computational biology tool landscape has grown rapidly (43+ tools in our registry across 7 categories), but there's no layer that connects them, centralizes the data, and learns from accumulated results. That's the gap SynqLab fills.

### Who are your competitors? What do you understand about your business that they don't?

**Tamarind Bio** — 250+ models, no-code GUI + API, automated pipelines. The closest competitor. But Tamarind is a tool marketplace, not a learning system. Their pipelines are static: same tool, same thresholds, every time. They don't learn from failures. They don't train task-specific metrics from a lab's own data. They don't have agent autonomy — no coordinator that decomposes goals, spawns specialist workers, and adapts strategy based on results.

**Benchling / CDD Vault** — Data management and ELN platforms. They record what happened; they don't decide what to try next. Complementary, not competitive.

**Isomorphic Labs / Recursion** — Deep pockets, proprietary data, vertical integration. But they build for themselves. SynqLab is the horizontal platform for every other lab that can't afford a 500-person AI team.

**What we understand that they don't:** Negative results are the most undervalued asset in computational biology. Every candidate that fails a gate — bad fold, weak binding, low brightness — is a labeled negative that makes the scoring model better calibrated. Our MDMI work (Bayat et al. 2025) showed that ~100 labeled examples (including negatives) are enough to train a useful task-specific predictor. Most competitors either throw failures away or don't have the architecture to feed them back. SynqLab is built from the ground up to treat every outcome as first-class training data.

### How do or will you make money? How much could you make?

**Revenue model:** Platform SaaS with usage-based compute.

- **Free/Academic tier** — Limited compute, data contributes to global knowledge models (strategic: builds the data flywheel)
- **Team tier** ($500-2,000/month) — Private projects, team knowledge sharing, priority compute, custom model training
- **Enterprise/On-prem** ($50,000-200,000/year) — Private deployment for pharma (data sovereignty), robotic lab integration, dedicated support

**Market opportunity:** The global computational biology market is ~$9.5B in 2025, growing at 23% CAGR ([GII Research, 2026](https://www.giiresearch.com/report/tbrc1840188-computational-biology-global-market-report.html)). The protein engineering market is ~$5B in 2025, growing at 16.6% CAGR ([Precedence Research](https://www.precedenceresearch.com/protein-engineering-market)). AI-driven drug discovery platforms are the fastest-growing segment — $3.1B in 2025, projected to reach $20.8B by 2034 at 24.5% CAGR ([MarketIntelo](https://marketintelo.com/report/ai-driven-drug-discovery-platform-market)).

**Unit economics:** Each lab that uses SynqLab generates labeled data that improves global models. The free tier isn't charity — it's a data moat. As the knowledge base grows, the platform becomes more valuable for everyone, creating a network effect that doesn't exist in tool-marketplace competitors.

**Revenue potential:**


| Scale          | Labs  | Avg. Revenue/Year | ARR  |
| -------------- | ----- | ----------------- | ---- |
| Early traction | 500   | $20K              | $10M |
| At scale       | 2,000 | $20K              | $40M |


There are 10,000+ labs globally doing iterative molecular design. These figures are before enterprise on-prem contracts, which are significantly higher.

### Please describe the scientific basis for your product. How does it work?

SynqLab is built on three scientific foundations:

**1. Agentic orchestration of heterogeneous computational tools.** The platform wraps 12+ tools (protein language models, structure predictors, docking engines, stability scorers, molecular dynamics simulators) behind a standardized adapter interface. An LLM-based agent (coordinator) decomposes research goals into sub-tasks, selects appropriate tools, sets gate thresholds, and manages a budget-constrained design round. This is modeled as a sequential decision process where the agent observes state (candidate pool, scores, budget remaining) and selects actions (which tool to run, what threshold to apply, when to stop).

**2. Closed-loop learning with task-specific metrics.** Generic structural scores (pLDDT, ΔΔG) tell you if a protein folds — not whether it does what you need (fluoresce, bind, catalyze). SynqLab trains lightweight task-specific models (e.g., a brightness predictor for GFP11) from the lab's own experimental data. Critically, both positive and negative outcomes are used as training data. Our MDMI framework (Bayat et al. 2025, NeurIPS AI4D3 spotlight) demonstrates that functional plasticity in peptide-protein interactions can be predicted from as few as ~100 labeled examples, making this approach feasible even for labs with limited data.

**3. Cost-ordered gated evaluation.** Candidates flow through a 5-stage pipeline where cheap tools (ESMFold, milliseconds per sequence) filter before expensive ones (AlphaFold-Multimer, minutes per complex; GROMACS, hours per simulation). This reduces cost by 10-100x compared to running every tool on every candidate. The agent dynamically adjusts gate thresholds based on the candidate distribution and remaining budget.

**The GFP11 proof of concept:** We target the design of GFP11 peptide variants (16 amino acids) that maximize brightness in the split-GFP complementation assay. The assay is fast, cheap, and quantitative — ideal for validating that the closed-loop learning actually works before moving to harder targets (binder design, enzyme engineering, therapeutic peptides).

### Describe the next few stages in developing your product. For each stage, how much time and money will it take?

**Stage 1: Closed-loop validation (now — 6 weeks, ~$15-20K)**
Run the full GFP11 closed-loop experiment: multiple design rounds where the brightness model is retrained after each round. Costs include GPU compute for structure prediction and folding tools (AlphaFold, ESMFold, FoldX), LLM API calls for the agent, and cloud infrastructure. Publish results as a preprint showing measurable improvement in hit rate from round 1 to round N. This is the scientific proof that the platform works.

**Stage 2: Pilot deployment (weeks 6-12, ~$30-50K)**
Production hardening (auth, deployment automation, monitoring), cloud hosting for pilot users, and deploy to 2-3 pilot labs at McMaster and UofT. Gather real-world usage data, iterate on UX based on researcher feedback. Goal: 2-3 labs actively using SynqLab for their own design projects.

**Stage 3: Lab equipment integration prototype (months 3-6, ~$150-250K)**
Connect the platform to physical lab equipment (liquid handlers, plate readers) via their Python/C++ SDKs. This requires purchasing or leasing equipment, hiring a lab automation engineer, and designing a robotic transfer system between instruments. Demonstrate the first fully autonomous in-silico-to-wet-lab cycle.

**Stage 4: Scale (months 6-12, ~$500K+ / fundraise)**
Expand to 20+ labs. Build the knowledge marketplace (cross-lab learning). Add support for new assay types beyond GFP (enzyme activity, binding affinity). Hire 2-3 engineers and a field scientist for lab partnerships.

### If you were accepted into YC, what could you accomplish by Demo Day?

By Demo Day (roughly 3 months), we would deliver:

1. **Live demo with a real lab:** A researcher at McMaster or UofT uses SynqLab to run GFP11 design rounds. We show, live, that round 2 predictions are measurably better than round 1 because the brightness model learned from round 1 outcomes.
2. **Published validation:** A preprint or short paper with quantitative results: hit rate improvement across design rounds, comparison against static pipeline baselines, and cost analysis showing the gated evaluation saves 10-100x compute.
3. **2-3 pilot labs actively using the platform** for their own research projects, providing real usage data and testimonials.
4. **Lab equipment integration proof-of-concept:** A working prototype connecting SynqLab's agent to a liquid handler and plate reader for automated wet-lab validation of computationally designed candidates.

### What experimental data (if any) do you have showing that this would work?

- **113 labeled GFP11 sequences** with experimental brightness scores from the split-GFP complementation assay — our training dataset for the task-specific brightness model
- **MDMI framework (Bayat et al. 2025)** — Published work demonstrating that functional plasticity in peptide-protein interactions can be probed and predicted from minimal experimental data (~100 labels). This grounds our claim that task-specific metrics are learnable even with small datasets. Presented as a spotlight talk at the NeurIPS 2025 AI4D3 workshop (AI Virtual Cells and Instruments: A New Era in Drug Discovery).
- **Working platform (v1.0 + v1.1)** — Not just a prototype: 14,500 lines of Python, 26,500 lines of TypeScript, 103 passing tests, 12+ integrated computational biology tools, full agent system with coordinator/worker architecture, three autonomy modes, real-time streaming. This is a shipped product.
- **Tool selection evaluation suite** — 21 test cases validating that the agent selects the correct tools for various research goals, plus workflow evals, a faithfulness scorer, and 5 online guardrails (PII redaction, PDB validation, ΔΔG sanity checks, citation linking, schema validation).

