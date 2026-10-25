# Phase 24: ArtifactPaths Module — Context

**Date:** 2026-05-05
**Phase:** 24 — ArtifactPaths Module
**Milestone:** v1.2 — Productionize Artifacts and Data Storages

## Domain

Create a central path-resolution module that defines the namespaced directory layout for `data/agent_artifacts/` and provides path-building helpers. All artifact writers will import from this module — no hardcoded paths elsewhere.

## Decisions

### Module Location
**Decision:** Extend existing `synqlab/storage/artifact_paths.py`
**Rationale:** Keep all path logic in one file. The existing `build_artifact_path()` for experiment-level paths stays alongside the new agent artifact namespace helpers.

### Namespace Granularity
**Decision:** Engine/run-scoped (deeper nesting)
**Layout:**
```
data/agent_artifacts/
├── sessions/<session_id>/          # Agent session artifacts (_persist.py)
├── pipelines/<run_id>/             # Pipeline run result JSONs
├── folding/
│   ├── omegafold/<hash>.{pdb,fasta}
│   └── esmfold/<hash>.{pdb,fasta}
├── candidates/<run_id>/<hash>.{pdb,fasta}
├── foldx/<hash>/                   # FoldX scratch outputs
├── sandbox/workspaces/             # Sandbox code execution (already namespaced)
├── bundled/                        # Bundled PDB samples (already namespaced)
├── project/<project_id>/           # Project-scoped artifacts (_persist.py)
└── global/                         # Global-scoped artifacts (_persist.py)
```

### Path Ownership
**Decision:** `_persist.py` keeps `ARTIFACT_DIR` and DB persistence logic. It imports namespace helpers from the extended `artifact_paths.py` module to replace inline path construction.
**Rationale:** Minimal refactor — swap inline path building for helper calls without restructuring the persist module.

## Code Context

### Reusable Assets
- `synqlab/storage/artifact_paths.py` — existing `build_artifact_path()` function (experiment-level); extend this file
- `synqlab/agent/tools/_persist.py` — owns `ARTIFACT_DIR`, scope routing (lines 96–116), DB persistence
- `synqlab/core/artifact_io.py` — save/load helpers for pLDDT, scores, meta (uses `out_dir: Path` parameter)

### Integration Points
- `_persist.py` line 26: `ARTIFACT_DIR = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))`
- `_persist.py` lines 96-116: inline scope bucketing (session/project/global) — to be replaced with helper calls
- `protein_folding.py` line 80: hardcoded `SYNQLAB_ARTIFACT_DIR` fallback
- `validate_complex.py` line 79: hardcoded `SYNQLAB_ARTIFACT_DIR` fallback
- Docker Compose line 41: `SYNQLAB_ARTIFACT_DIR: /app/data/agent_artifacts`

### Patterns to Follow
- `from __future__ import annotations` first
- Full type hints on all functions
- `SCREAMING_SNAKE_CASE` for namespace constants
- Module docstring describing purpose

## Canonical Refs

- `synqlab/storage/artifact_paths.py` — file to extend
- `synqlab/agent/tools/_persist.py` — primary consumer of new helpers
- `synqlab/core/artifact_io.py` — related artifact I/O helpers
- `.planning/REQUIREMENTS.md` — SEG-05, SEG-06, SEG-08 scoped to this phase

## Deferred Ideas

*(none)*
