# Plan 25-02 Summary — Folding & Validation Tool Migration
**Status:** Complete | **Date:** 2026-05-06

## Changes
| File | Before | After |
|------|--------|-------|
| `protein_folding.py` | `SYNQLAB_ARTIFACT_DIR` env lookup | `build_agent_artifact_path(ARTIFACT_DIR, FOLDING, method)` |
| `validate_complex.py` | `SYNQLAB_ARTIFACT_DIR` env lookup | `build_agent_artifact_path(ARTIFACT_DIR, CANDIDATES)` |
| `stability_analysis.py` | Hardcoded `"/app/artifacts"` | `build_agent_artifact_path(ARTIFACT_DIR, FOLDX)` |

## Bug Fix
`stability_analysis.py` was sending artifacts to the wrong root (`/app/artifacts` — the experiment root) instead of the agent artifacts root. Now corrected.

## Verification
- All 3 tools import cleanly
- 268 unit tests pass
