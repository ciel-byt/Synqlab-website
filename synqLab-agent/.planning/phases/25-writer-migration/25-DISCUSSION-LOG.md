# Phase 25: Writer Migration — Discussion Log

**Date:** 2026-05-05
**Duration:** ~2 minutes
**Areas discussed:** 3/3

## Area 1: _persist.py Session Scope Routing

**Options presented:**
- A) Pure path swap — replace inline path construction with helper call
- B) Add auto-mkdir to the builder function

**User selected:** A — pure path swap
**Notes:** Keeps `build_agent_artifact_path` side-effect-free; callers keep their existing `mkdir()` calls.

## Area 2: Folding Service artifact_dir Override

**Options presented:**
- A) Change `artifact_dir` sent by the tool in HTTP payload
- B) Change `output_tag` to include subdirectory prefix

**User selected:** A — change artifact_dir
**Notes:** Zero service-side changes. Tool sends `ARTIFACT_DIR/folding/omegafold` instead of `ARTIFACT_DIR`.

## Area 3: Pipeline Runs — Rename vs. Reparent

**Options presented:**
- A) Just change the constant; old `pipeline_runs/` stays on disk
- B) Add migration logic to move existing JSON files

**User selected:** A — leave old dir
**Notes:** Simpler. Existing runs in `pipeline_runs/` are historical; new runs write to `pipelines/`.

## Deferred Ideas

*(none)*
