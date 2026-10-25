# SynqLab — Roadmap

## Milestones

- ✅ **v1.0 — Agentic AI Platform** — Phases 1–8 (shipped 2026-04-30) ⊘ Phase 9 deferred to M2
- ✅ **v1.1 — UI Polish & Stabilization** — Phases 10, 12, 13 (shipped 2026-05-02) ⊘ Phase 11 deferred to M2
- ✅ **M2 — GFP11 Integration + Production Readiness** — Phases 14–23 (shipped 2026-05-05)
- 📋 **v1.2 — Productionize Artifacts and Data Storages** — Phases 24–26 (active)

## Phases

<details>
<summary>✅ v1.0 — Agentic AI Platform (Phases 1–8) — SHIPPED 2026-04-30</summary>

- [x] Phase 1: Agent Console Frontend (3/3 plans) — Complete
- [x] Phase 2: Autonomy Modes (2/2 plans) — Complete
- [x] Phase 3: Coordinator & Sub-Agents (4/4 plans) — Complete
- [x] Phase 4: Skill System (4/4 plans) — Complete
- [x] Phase 5: Research Director Workflow (4/4 plans) — Complete
- [x] Phase 6: Pipeline Builder & Batch (4/4 plans) — Complete
- [x] Phase 7: Cost Controls & Templates (3/3 plans) — Complete
- [x] Phase 8: Integration & E2E Test Hardening (4/4 plans) — Complete 2026-04-30
- ⊘ Phase 9: Production Observability — Skipped, deferred to M2

Full snapshot: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 — UI Polish & Stabilization (Phases 10, 12, 13) — SHIPPED 2026-05-02</summary>

- [x] Phase 10: Agent UI Redesign (3/3 plans) — Complete 2026-04-30
- ⊘ Phase 11: Console & Routing Polish — Deferred to M2
- [x] Phase 12: New Session Page (3/3 plans) — Complete 2026-04-30
- [x] Phase 13: Tool Orchestration & Data Flow (8/8 plans) — Complete 2026-05-02

Full snapshot: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ M2 — GFP11 Integration + Production Readiness (Phases 14–23) — SHIPPED 2026-05-05</summary>

- [x] Phase 14: Scientific Adapter Port (3/3 plans) — Complete
- [x] Phase 15: Mock Mode Enhancement (1/1 plan) — Complete
- [x] Phase 16: LLM Provider Abstraction (2/2 plans) — Complete
- [x] Phase 17: GFP11 Pipeline Mode (3/3 plans) — Complete
- [x] Phase 18: Registry & Config Update (1/1 plan) — Complete
- [x] Phase 19: Training Scripts (1/1 plan) — Complete
- [x] Phase 20: Test Coverage (5/5 plans) — Complete
- [x] Phase 22: Redesign Agent Console (5/5 plans) — Complete
- [x] Phase 23: Pipeline-First Architecture + GFP11 Unification (6/6 plans) — Complete

Full snapshot: `.planning/milestones/M2-ROADMAP.md`

</details>

### 📋 v1.2 — Productionize Artifacts and Data Storages (Active)

**Primary Goal:** Segment `data/agent_artifacts/` from a flat dump into properly namespaced subdirectories.

#### v1.2 Phases

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 24 | ArtifactPaths Module | 1/1 | Complete   | 2026-05-06 |
| 25 | Writer Migration | 3/3 | Complete   | 2026-05-06 |
| 26 | Backward Compatibility & Verification | Ensure existing artifacts remain accessible, tests pass, Docker mounts work | BWC-01, BWC-02 | 🔲 Not planned |
| 27 | Frontend Storage UI | 0/4 | Planned    |  |

---

### Phase 24: ArtifactPaths Module

**Goal:** Create a single authoritative module that defines the namespaced directory layout and provides path-building helpers. All writers will import from this module — no hardcoded paths elsewhere.

**Requirements:** SEG-05, SEG-06, SEG-08

**Success criteria:**
1. `synqlab/storage/artifact_paths.py` exports namespace constants (`SESSIONS`, `PIPELINES`, `FOLDING`, `CANDIDATES`, `FOLDX`, `SANDBOX`, `BUNDLED`)
2. `build_agent_artifact_path(namespace, identifier, filename)` returns the canonical path under `ARTIFACT_DIR`
3. Existing `build_artifact_path()` function preserved for experiment-level paths (separate concern)
4. Unit tests confirm path construction for every namespace

**Depends on:** Nothing

---

### Phase 25: Writer Migration

**Goal:** Update every module that writes files into `data/agent_artifacts/` to use the new `ArtifactPaths` helpers instead of hardcoded flat paths.

**Requirements:** SEG-01, SEG-02, SEG-03, SEG-04, SEG-07, MIG-01, MIG-02, MIG-03, MIG-04, MIG-05

**Success criteria:**
1. `_persist.py` scope buckets route through `ArtifactPaths` (sessions, project, global namespaces)
2. `protein_folding.py` writes `omegafold_*`/`esmfold_*` files to `folding/` namespace
3. `stability_analysis.py` and `validate_complex.py` resolve artifact paths correctly under new layout
4. Pipeline run JSON files write to `pipelines/<run_id>/` namespace
5. FoldX scratch outputs write to `foldx/<hash>/` under the agent artifacts root
6. Docker Compose `volumes:` section is unchanged (single `./data/agent_artifacts` mount)
7. Candidate PDB/FASTA files write to `candidates/<hash>.*` namespace

**Depends on:** Phase 24

---

### Phase 26: Backward Compatibility & Verification

**Goal:** Ensure existing artifacts (already written under the old flat layout) remain accessible via their DB `file_path` entries, and all tests pass under the new layout.

**Requirements:** BWC-01, BWC-02

**Success criteria:**
1. Artifact lookup by `artifact_id` returns correct file content regardless of old/new path layout
2. Bundled PDB sample ingest at app startup works unchanged
3. All existing tests pass without modification (or with minimal path fixture updates)
4. End-to-end smoke: `predict_structure` → `analyze_stability` chain produces artifacts in new namespaced dirs

**Depends on:** Phase 25

---

### Phase 27: Frontend Storage UI

**Goal:** Wire the frontend to the namespaced storage backend (Phase 24-25) so users can browse, preview, and download artifacts organized by namespace. Also fix the brightness-svc storage bug, consolidate the chat layout (remove right sidebar → inline), move PDB samples and skills into the Storage tab.

**Requirements:** FE-01 (Storage API surface), FE-02 (Artifact browser UI), FE-03 (Preview/download integration), FE-04 (Chat layout consolidation), FE-05 (Brightness storage fix)

**Success criteria:**
1. **Brightness storage bug fixed:** brightness-svc can read model weights via correct volume mount path alignment (see Bug Analysis below)
2. **Right sidebar removed:** `AgentChat.tsx` no longer renders the `showRightPanel` side panel — tool calls and artifacts render **inline** in the chat stream (persistent, not ephemeral)
3. **PDB sample files moved:** Bundled PDB samples (`scope=global`) removed from agent sidebar and surfaced in the Storage / Datasets tab instead
4. **Skills → Agent tab:** `SkillBrowser` component consolidated into the Agent tab (or Storage tab since skills are files), removing the standalone `/lab/skills` route
5. New backend endpoint `GET /api/storage/browse?namespace=&path=` returns namespace-aware directory listings from `data/agent_artifacts/`
6. Frontend API client (`api/client.ts`) has `browseStorage()`, `downloadArtifact()`, and `previewArtifact()` methods
7. `AgentDatasetsPage` connects to real `listDatasets` endpoint and displays artifacts with type badges, size, timestamps
8. Storage browser component shows namespace tree: `sessions/`, `pipelines/`, `folding/`, `candidates/`, `foldx/`, `sandbox/`
9. Artifact download works via `GET /api/storage/download?path=` with `Content-Disposition: attachment`

**Depends on:** Phase 26

### Bug Analysis: Brightness Storage Path Mismatch

| Component | Path Used | Problem |
|-----------|-----------|---------|
| `docker-compose.yml` env | `SYNQLAB_BRIGHTNESS_MODEL_PATH: /app/models/brightness/model.pkl` | ✅ Correct env var |
| `docker-compose.yml` volume | `brightness_cache:/app/models` | ⚠️ Named volume is empty on first run — no model.pkl exists |
| `brightness_model.py` default | `artifacts/brightness/model.pkl` | ❌ Fallback path doesn't match any volume mount |
| `training.py` deploy target | `models/brightness/model.pkl` (relative) | ❌ Runs inside `app` container, writes to app's filesystem, not brightness-svc's volume |
| `serve.py` | `os.environ.get("SYNQLAB_BRIGHTNESS_MODEL_PATH", "")` | ⚠️ Empty string fallback → adapter uses its own default → `artifacts/brightness/model.pkl` → file not found |

**Root cause:** The `brightness_cache` Docker volume is a named volume that starts empty. The training router in the `app` container writes to `models/brightness/` (its own filesystem), but that directory is NOT the same Docker volume mounted in `brightness-svc`. The two containers have separate mounts and no shared path for the model file.

**Fix:** Mount `./data/agent_artifacts` in brightness-svc (already done) and change `SYNQLAB_BRIGHTNESS_MODEL_PATH` to resolve into the shared `agent_artifacts` volume, OR mount a shared bind-mount for model weights between `app` and `brightness-svc`.

Plans:
- [ ] Plan 1: Fix brightness storage paths + shared model volume
- [ ] Plan 2: Remove right sidebar, make tool calls & artifacts inline in chat
- [ ] Plan 3: Backend storage browse/download endpoints + frontend Storage browser
- [ ] Plan 4: Move PDB samples & Skills into Storage/Agent tabs

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–8 | v1.0 | 28/28 | Complete | 2026-04-30 |
| 10,12,13 | v1.1 | 14/14 | Complete | 2026-05-02 |
| 14–23 | M2 | 27/27 | Complete | 2026-05-05 |
| 24. ArtifactPaths Module | v1.2 | 0/0 | Not planned | — |
| 25. Writer Migration | v1.2 | 0/0 | Not planned | — |
| 26. Backward Compat & Verification | v1.2 | 0/0 | Not planned | — |

---

## Backlog

### Phase 999.1: Consolidate artifacts/ into data/ — unified runtime storage root (BACKLOG)

**Goal:** Merge the legacy `artifacts/` directory (brightness models, reranker, knowledge store, user media, FoldX scratch) into `data/` to create a single runtime storage root. Eliminates the confusing split between `artifacts/` and `data/agent_artifacts/`.

**Scope:** ~40+ file references across Python adapters, scripts, configs, docker-compose, Helm charts, and tests. Includes updating default paths, env vars, volume mounts, and gitignore rules.

**Requirements:** TBD

**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
