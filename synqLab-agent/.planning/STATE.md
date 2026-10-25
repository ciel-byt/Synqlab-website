---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Productionize Artifacts and Data Storages
status: executing
last_updated: "2026-05-07T08:41:02.890Z"
last_activity: 2026-05-07 -- Phase 27 execution started
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 8
  completed_plans: 4
  percent: 50
---

# SynqLab — Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 after v1.1 milestone close)

- **Core value:** Autonomous scientific research at scale — coordinator/sub-agent platform for protein engineering pipelines.
- **Current focus:** Phase 27 — frontend-storage-ui-surface-namespaced-artifacts-file-browse
- **Status:** Executing Phase 27

## Shipped Milestones

| Version | Name | Shipped | Phases |
|---------|------|---------|--------|
| v1.0 | Agentic AI Platform | 2026-04-30 | 8 of 9 (Phase 9 deferred to M2) |
| v1.1 | UI Polish & Stabilization | 2026-05-02 | 3 of 4 (Phase 11 deferred to M2) |

Full record: `.planning/MILESTONES.md`
Retrospective: `.planning/RETROSPECTIVE.md`

## Open Blockers

*(none)*

## Deferred Items (carried into next milestone scoping)

| Category | Item | Origin |
|----------|------|--------|
| Phase | Production Observability (was Phase 9) | Skipped 2026-04-30 |
| Eval gap | EVAL-REVIEW G1 — Arize Phoenix tracing | Phase 9 deferral |
| Eval gap | EVAL-REVIEW G2 — Org-level usage aggregation | Phase 9 deferral |
| Eval gap | EVAL-REVIEW G3 — `outcome` field on `agent_sessions` | Phase 9 deferral |
| Eval gap | EVAL-REVIEW G4 — Promptfoo CI/CD eval pipeline | Phase 9 deferral |
| Eval gap | EVAL-REVIEW G5 — `--live` eval validation | Eval audit |
| Eval gap | EVAL-REVIEW G6 — Domain-expert dataset review | Eval audit |
| Requirement | REQ-14 Skill Marketplace | Original M1 deferral |
| Requirement | REQ-15 Agent Memory | Original M1 deferral |
| Tech debt | 10 failing legacy `tests/unit/` (V1 orchestrator/registry) | Pre-existing |
| Live smoke | Phase 13 D-12 LLM smoke (predict_structure → analyze_stability chain) | Phase 13 plan 13-08 deferral (no FoldX / OPENAI_API_KEY in sandbox) |
| Live smoke | Phase 13 UI-DROP drag-drop browser smoke | Phase 13 plan 13-08 deferral (no interactive dev browser) |
| Live smoke | Phase 13 UI-PROMOTE chip Promote action browser smoke | Phase 13 plan 13-08 deferral (no interactive dev browser) |
| Phase | Phase 11 Console & Routing Polish | v1.1 deferral — Phase 12 covered dedicated routes/breadcrumbs; remaining polish merged to M2 |

## Accumulated Context

### Roadmap Evolution

- Phase 11 added: Console & Routing Polish — New Session dialog redesign, dedicated routes, breadcrumbs, back buttons
- Phase 12 added: New Session Page — Replace modal with dedicated page at `/lab/agents/console/new`, formal academic design
- Phase 13 added: Tool Orchestration & Data Flow — review tool orchestration, design artifact_id ↔ filesystem path bridging so tools can pass generated PDBs to each other; user upload / dataset / model selection
- Phase 22 added: Redesign Agent Console — Unified Chat View — merge console + new-session views into a single ChatGPT-style chat interface with starter prompts, bottom-aligned input, unified question handling
- Phase 23 added: Pipeline-First Architecture + GFP11 Unification — move protein_designer and gfp11_designer to pipeline page as templates, keep console for Q&A + research_director coordination, add brightness-svc, loop support in PipelineEngine, retire standalone loop.py. Based on MDMI paper (Bayat et al., ICLR 2025 GEM).
- Phase 27 added: Frontend Storage UI — Surface namespaced artifacts (from Phase 24-25 backend refactor) in the UI: artifact file browser, namespace-aware listing, download/preview endpoints, inline PDB viewer integration, Datasets page connected to real storage

## Last Activity

- **Date:** 2026-05-03
- **Action:** Phase 23 EXECUTED — all 6 plans shipped across 3 waves:
  - Wave 1: Pipeline engine loop + CandidateTracker, 5 science tools, brightness-svc:8007
  - Wave 2: Pipeline templates + card-based template selector UI, console ↔ pipeline integration tools
  - Wave 3: Legacy GFP11 module deprecation + platform-wide template key alignment
- **Tests:** 23/23 pass (test_pipeline.py + test_pipeline_loop.py)
- **Tools:** 21 total (8 original + 5 GFP11 science + 2 integration + 6 coordinator/skill)
- **Next:** Verify UI, run smoke tests, consider retiring loop.py/gfp11_tools.py fully
- **Resume file:** .planning/phases/27-frontend-storage-ui-surface-namespaced-artifacts-file-browse/27-UI-SPEC.md

### Branch Integration Context

- **Source branch:** `feature/gfp11-agent` (6 commits ahead of main)
- **Worktree:** `../synqLab-gfp11-review`
- **Key files to port:**
  - `synqlab/adapters/brightness_model.py` — GFP11 brightness predictor
  - `synqlab/adapters/complex_stability.py` — Complex stability analysis
  - `synqlab/adapters/pyrosetta.py` — PyRosetta interface
  - `synqlab/adapters/spserver.py` — SPServer interaction scoring
  - `synqlab/agent/loop.py` — ReAct agent loop
  - `synqlab/agent/provider.py` — LLM provider abstraction
  - `synqlab/agent/tools.py` — GFP11 tool schemas + dispatcher
  - `configs/gfp11.yaml` — Task-specific config
  - `scripts/train_brightness_model.py` — ML training script
  - `scripts/register_gfp11_target.py` — Knowledge Store registration

## Current Position

Phase: 27 (frontend-storage-ui-surface-namespaced-artifacts-file-browse) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 27
Last activity: 2026-05-07 -- Phase 27 execution started
