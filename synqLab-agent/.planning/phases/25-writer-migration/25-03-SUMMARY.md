# Plan 25-03 Summary — FoldX Adapter & Pipeline Router Migration
**Status:** Complete | **Date:** 2026-05-06

## Changes
| File | Before | After |
|------|--------|-------|
| `foldx.py` | `Path(artifact_dir) / f"foldx_{run_id}"` | `build_agent_artifact_path(Path(artifact_dir), FOLDX, run_id)` |
| `pipelines.py` | `_pathlib.Path(...) / "pipeline_runs"` | `build_agent_artifact_path(_Path(...), PIPELINES)` |

## Notes
- Old `pipeline_runs/` directory stays on disk (per decision). New runs write to `pipelines/`.
- Docker Compose `volumes:` unchanged — single `./data/agent_artifacts` mount.

## Verification
- Both modules import cleanly
- 268 unit tests pass
