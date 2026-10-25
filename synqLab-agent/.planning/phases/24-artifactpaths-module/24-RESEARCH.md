# Phase 24: ArtifactPaths Module — Research

**Date:** 2026-05-05
**Mode:** Implementation (codebase audit — no external libraries needed)

## Standard Stack

No new libraries required. This phase extends existing Python modules using only:
- `pathlib.Path` (already used everywhere)
- `os.environ` (already used for `SYNQLAB_ARTIFACT_DIR`)

## Architecture Patterns

### Current State: 5 Separate Write Patterns

**Pattern 1: `_persist.py` scope routing (agent tool artifacts)**
- Location: `synqlab/agent/tools/_persist.py` lines 96–116
- Writes to: `ARTIFACT_DIR / <session_id>/`, `ARTIFACT_DIR / project/<project_id>/`, `ARTIFACT_DIR / global/`
- Trigger: Any agent tool calling `persist_artifact()`

**Pattern 2: Folding service outputs (omegafold/esmfold)**
- Location: `synqlab/agent/tools/protein_folding.py` line 82
- Sends `output_tag` like `omegafold_{uuid8}` to the service
- Service writes: `ARTIFACT_DIR / omegafold_<hash>.{pdb,fasta}` (FLAT — no namespace)

**Pattern 3: Validate complex outputs (candidate folding)**
- Location: `synqlab/agent/tools/validate_complex.py` lines 89, 101
- Sends `output_tag` like `candidate_{seq_hash}_{uuid8}` or `complex_{seq_hash}_{uuid8}`
- Service writes: `ARTIFACT_DIR / candidate_<hash>_<tag>.{pdb,fasta}` (FLAT)

**Pattern 4: FoldX adapter scratch directory**
- Location: `synqlab/adapters/foldx.py` line 228
- Writes to: `artifact_dir / foldx_{run_id}/` (uses `artifact_dir` from request inputs, defaults to `"artifacts"`)
- Note: This uses the OLD `artifacts/` root, NOT `data/agent_artifacts/`

**Pattern 5: Pipeline run JSON persistence**
- Location: `app/routers/pipelines.py` lines 41–44
- Writes to: `ARTIFACT_DIR / pipeline_runs / <run_id>.json`
- Already namespaced — just rename `pipeline_runs` → `pipelines`

### Target State: Centralized ArtifactPaths Module

All 5 patterns will import from `synqlab/storage/artifact_paths.py`:

```python
# Namespace constants
SESSIONS = "sessions"
PIPELINES = "pipelines"
FOLDING = "folding"
CANDIDATES = "candidates"
FOLDX = "foldx"
SANDBOX = "sandbox"
BUNDLED = "bundled"

def build_agent_artifact_path(
    artifact_root: Path,
    namespace: str,
    *sub_parts: str,
) -> Path:
    """Build canonical path: <root>/<namespace>/<sub_parts...>"""
    return artifact_root / namespace / Path(*sub_parts) if sub_parts else artifact_root / namespace
```

## Don't Hand-Roll

- **Path joining** — Always use `pathlib.Path /` operator, never `os.path.join` or f-strings
- **Directory creation** — Always `path.mkdir(parents=True, exist_ok=True)`, never `os.makedirs`

## Common Pitfalls

### P1: Service-side vs client-side path construction
The folding services (omegafold-svc, esmfold-svc) receive `artifact_dir` and `output_tag` as inputs and construct the output path server-side. The agent tool sends these via HTTP POST. Changing the namespace means:
- Option A: Change `artifact_dir` sent by the tool to include the namespace (e.g., `ARTIFACT_DIR/folding/omegafold`)
- Option B: Change `output_tag` to include namespace prefix
**Recommendation: Option A** — less invasive, services don't change

### P2: FoldX uses different root
`FoldXAdapter.run()` line 221 defaults `artifact_dir` to `"artifacts"` (the old experiment root), NOT `data/agent_artifacts`. The `stability_analysis.py` agent tool overrides this when calling via HTTP. Need to trace both paths.

### P3: Pipeline runs dir is created at import time
`app/routers/pipelines.py` line 44: `_RUNS_DIR.mkdir()` happens at module import. If we change the namespace, the old `pipeline_runs/` dir will stop being created but old JSON files remain there.

### P4: Bundled and sandbox are already namespaced
`data/agent_artifacts/bundled/` and `data/agent_artifacts/sandbox/` already exist as subdirectories. SEG-05 and SEG-06 confirm no change needed — just add them as constants so the module is the single source of truth.

### P5: `output_tag` is the filename stem
In `protein_folding.py` and `validate_complex.py`, the `output_tag` parameter becomes the filename stem on the service side (e.g., `omegafold_abc12345.pdb`). The service writes `<artifact_dir>/<output_tag>.pdb`. To get engine-scoped directories, we need to send `artifact_dir` = `ARTIFACT_DIR/folding/omegafold` so the service writes `ARTIFACT_DIR/folding/omegafold/<output_tag>.pdb`.

## Code Examples

### Building paths with the new module
```python
from synqlab.storage.artifact_paths import (
    build_agent_artifact_path, FOLDING, SESSIONS, PIPELINES
)

# Session artifact
path = build_agent_artifact_path(artifact_root, SESSIONS, session_id, f"{uuid_hex}.pdb")
# → data/agent_artifacts/sessions/<session_id>/<uuid>.pdb

# Folding output (sent to service as artifact_dir)
fold_dir = build_agent_artifact_path(artifact_root, FOLDING, "omegafold")
# → data/agent_artifacts/folding/omegafold
# Service writes: data/agent_artifacts/folding/omegafold/omegafold_abc12345.pdb

# Pipeline run
path = build_agent_artifact_path(artifact_root, PIPELINES, f"{run_id}.json")
# → data/agent_artifacts/pipelines/<run_id>.json
```

## Writer Inventory (Phase 25 reference)

| Writer | File | Current path | New path | Change needed |
|--------|------|-------------|----------|---------------|
| `persist_artifact` | `_persist.py:96` | `<root>/<session_id>/` | `<root>/sessions/<session_id>/` | Import `SESSIONS` |
| `persist_artifact` | `_persist.py:104` | `<root>/project/<pid>/` | `<root>/project/<pid>/` | No change (already scoped) |
| `persist_artifact` | `_persist.py:108` | `<root>/global/` | `<root>/global/` | No change (already scoped) |
| `predict_structure` | `protein_folding.py:79` | `<root>/omegafold_*.pdb` | `<root>/folding/omegafold/*` | Change `artifact_dir` sent to service |
| `validate_complex` | `validate_complex.py:78` | `<root>/candidate_*.pdb` | `<root>/candidates/<run_id>/*` | Change `artifact_dir` sent to service |
| FoldX adapter | `foldx.py:228` | `artifacts/foldx_<id>/` | `<root>/foldx/<id>/` | Change default `artifact_dir` |
| Pipeline runs | `pipelines.py:43` | `<root>/pipeline_runs/` | `<root>/pipelines/` | Update `_RUNS_DIR` |
| Bundled ingest | `main.py` (startup) | `<root>/bundled/` | `<root>/bundled/` | No change |
| Sandbox | code sandbox | `<root>/sandbox/` | `<root>/sandbox/` | No change |

## Test Strategy

Unit tests for the new `build_agent_artifact_path()` helper:
- Test each namespace constant produces correct path segments
- Test with zero, one, and multiple `sub_parts`
- Test that existing `build_artifact_path()` is not broken
- Test edge cases: empty identifier, Windows paths vs POSIX
