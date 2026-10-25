# Component Spec — Knowledge Store

## Responsibility

Persist and retrieve structured knowledge artifacts (datasets, targets, prompts, findings) across runs, projects, and teams. Act as the memory layer that makes the system learn across rounds rather than starting fresh each time.

## Location

`synqlab/knowledge_store/`

## Full design doc

All detailed interface specs, payload schemas, scoping model, post-training path, and rollout plan live in:

[`docs/design-docs/knowledge-store.md`](../design-docs/knowledge-store.md)

This file is a summary focused on the V1 implementation scope.

## V1 scope

In V1 the Knowledge Store is file-backed (JSON files under `artifacts/knowledge_store/`). The same Python API is used — swapping to a database backend in V2 only changes `store.py`, not any caller.

## Public API (`knowledge_store/store.py`)

```python
def register(artifact: KnowledgeArtifact) -> str:           # returns artifact id
def retrieve(artifact_id: str) -> KnowledgeArtifact
def retrieve_by_kind(kind: str, project_id: str) -> list[KnowledgeArtifact]
def promote(artifact_id: str, new_scope: str) -> None       # e.g. project → team → global
```

## Artifact kinds used in V1

| Kind | Used by | Example |
|---|---|---|
| `dataset` | `FluorescenceLabelIngestAdapter` | 113-set brightness scores |
| `finding` | Orchestrator (end of round) | Round 1 top-k summary |

## Connections

- Written to by `synqlab/adapters/label_ingest.py`
- Written to by `synqlab/orchestrator/pipeline.py` (round findings)
- Read by `scripts/train_reranker.py` to get training data
- Read by `synqlab/adapters/reranker.py` to check for model artifacts
