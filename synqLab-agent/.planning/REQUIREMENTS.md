# SynqLab v1.2 — Requirements

## Milestone v1.2: Productionize Artifacts and Data Storages

### Artifact Segmentation

- [ ] **SEG-01**: Agent session artifacts are written to `data/agent_artifacts/sessions/<session_id>/` instead of `data/agent_artifacts/<session_id>/`
- [ ] **SEG-02**: Pipeline run results are written to `data/agent_artifacts/pipelines/<run_id>/` instead of `data/agent_artifacts/pipeline_runs/`
- [ ] **SEG-03**: Folding outputs (omegafold/esmfold) are written to `data/agent_artifacts/folding/<hash>.{pdb,fasta}` instead of flat `data/agent_artifacts/omegafold_<hash>.*`
- [ ] **SEG-04**: Pipeline candidate outputs are written to `data/agent_artifacts/candidates/<hash>.{pdb,fasta}` instead of flat `data/agent_artifacts/candidate_*.*`
- [ ] **SEG-05**: Sandbox workspaces remain at `data/agent_artifacts/sandbox/` (already namespaced — no change)
- [ ] **SEG-06**: Bundled PDB samples remain at `data/agent_artifacts/bundled/` (already namespaced — no change)
- [ ] **SEG-07**: FoldX scratch outputs are written to `data/agent_artifacts/foldx/<hash>/` instead of `artifacts/foldx_<hash>/`
- [ ] **SEG-08**: A single `ArtifactPaths` module centralizes all subdirectory layout constants so no writer hardcodes paths

### Writer Migration

- [ ] **MIG-01**: `_persist.py` session/project/global scope paths are updated to use `ArtifactPaths`
- [ ] **MIG-02**: `protein_folding.py` writes folding outputs via `ArtifactPaths` instead of flat root
- [ ] **MIG-03**: `stability_analysis.py` / `validate_complex.py` resolve artifact_id paths correctly under new layout
- [ ] **MIG-04**: `PipelineEngine` writes run results via `ArtifactPaths`
- [ ] **MIG-05**: Docker Compose volume mounts remain compatible (single `data/agent_artifacts` root unchanged)

### Backward Compatibility

- [ ] **BWC-01**: Existing flat files are still readable by artifact_id lookup (DB rows have absolute `file_path`)
- [ ] **BWC-02**: The `bundled/` startup ingest continues to work unchanged

## Future Requirements (deferred)

- Object storage backend (S3/MinIO) abstraction
- Artifact TTL / cleanup policy
- Cross-session artifact sharing UI

## Out of Scope

- Database schema changes (artifact rows already store `file_path` — only the path values change)
- Knowledge Store refactoring (separate module, separate concern)
- `artifacts/` root directory (experiment-level, separate from agent artifacts)

## Traceability

| Requirement | Phase | Plan |
|-------------|-------|------|
| SEG-05, SEG-06, SEG-08 | Phase 24 | — |
| SEG-01, SEG-02, SEG-03, SEG-04, SEG-07 | Phase 25 | — |
| MIG-01, MIG-02, MIG-03, MIG-04, MIG-05 | Phase 25 | — |
| BWC-01, BWC-02 | Phase 26 | — |
