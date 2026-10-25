# Phase 25: Writer Migration — Context

**Date:** 2026-05-05
**Phase:** 25 — Writer Migration
**Milestone:** v1.2 — Productionize Artifacts and Data Storages

## Domain

Migrate all 5 artifact writers to use `build_agent_artifact_path()` and namespace constants from Phase 24's `synqlab/storage/artifact_paths.py`. No new features — pure refactor of path construction.

## Decisions

### _persist.py Session Scope Routing
**Decision:** Pure path swap — replace inline `ARTIFACT_DIR / ctx.session_id` with `build_agent_artifact_path(ARTIFACT_DIR, SESSIONS, ctx.session_id)`. No auto-mkdir in the builder; callers keep their existing `mkdir()` calls.

### Folding Service artifact_dir Override
**Decision:** Change `artifact_dir` sent by the tool in the HTTP payload. `protein_folding.py` sends `ARTIFACT_DIR/folding/omegafold` (or `esmfold`) as `artifact_dir`. Zero service-side changes. `validate_complex.py` does the same.

### Pipeline Runs — Rename vs. Reparent
**Decision:** Just change the constant from `pipeline_runs` to `pipelines`. Old `pipeline_runs/` directory stays on disk but no new files go there. No migration logic.

## Writers to Update

| # | File | Current pattern | New pattern |
|---|------|----------------|-------------|
| 1 | `synqlab/agent/tools/_persist.py` | `ARTIFACT_DIR / ctx.session_id` | `build_agent_artifact_path(ARTIFACT_DIR, SESSIONS, ctx.session_id)` |
| 2 | `synqlab/agent/tools/protein_folding.py` | Sends `ARTIFACT_DIR` as `artifact_dir` | Sends `build_agent_artifact_path(ARTIFACT_DIR, FOLDING, method)` |
| 3 | `synqlab/agent/tools/validate_complex.py` | Sends `ARTIFACT_DIR` as `artifact_dir` | Sends `build_agent_artifact_path(ARTIFACT_DIR, CANDIDATES)` |
| 4 | `synqlab/adapters/foldx.py` | `Path(artifact_dir) / f"foldx_{run_id}"` | `build_agent_artifact_path(Path(artifact_dir), FOLDX, run_id)` |
| 5 | `app/routers/pipelines.py` | `ARTIFACT_DIR / "pipeline_runs"` | `build_agent_artifact_path(ARTIFACT_DIR, PIPELINES)` |

## Canonical Refs

- `synqlab/storage/artifact_paths.py` — source of truth (Phase 24 output)
- `synqlab/agent/tools/_persist.py` — primary consumer (lines 96–116)
- `synqlab/agent/tools/protein_folding.py` — folding tool (line 79)
- `synqlab/agent/tools/validate_complex.py` — validate complex tool (lines 78–101)
- `synqlab/adapters/foldx.py` — FoldX adapter (line 228)
- `app/routers/pipelines.py` — pipeline run store (lines 41–44)
- `.planning/phases/24-artifactpaths-module/24-RESEARCH.md` — full writer inventory

## Deferred Ideas

*(none)*
