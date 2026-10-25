# Phase 24: ArtifactPaths Module — Discussion Log

**Date:** 2026-05-05
**Duration:** ~3 minutes
**Areas discussed:** 3/3

## Area 1: Module Location

**Options presented:**
- A) Extend existing `synqlab/storage/artifact_paths.py`
- B) New file `synqlab/agent/artifact_paths.py`

**User selected:** A — extend existing file
**Notes:** Keeps all path logic in one place despite mixing experiment-level and agent-level concerns.

## Area 2: Namespace Granularity

**Options presented:**
- A) Flat namespace — `folding/<hash>.pdb`
- B) Engine/run-scoped — `folding/omegafold/<hash>.pdb`, `candidates/<run_id>/<hash>.pdb`

**User selected:** B — engine/run-scoped
**Notes:** Deeper nesting for easier browsing/debugging by engine type and pipeline run.

## Area 3: Path Ownership

**Options presented:**
- A) `_persist.py` keeps `ARTIFACT_DIR`, imports namespace helpers
- B) New module fully owns path resolution, `_persist.py` becomes pure DB persistence

**User selected:** A — minimal swap
**Notes:** Avoids restructuring _persist.py; just replace inline path construction with helper calls.

## Deferred Ideas

*(none)*
