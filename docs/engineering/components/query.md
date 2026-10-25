# Component Spec — Query Layer

## Responsibility

Provide a clean API and CLI for inspecting stored experiments, runs, candidates, and artifacts — without requiring the caller to write SQL or open raw files.

## Location

`synqlab/query/`

## Public API (`query/api.py`)

```python
def get_experiment(experiment_id: str) -> Experiment
def list_runs(experiment_id: str) -> list[ToolRun]
def list_candidates(run_id: str) -> list[Candidate]
def filter_by_tag(key: str, value: str) -> list[dict]
def top_k(experiment_id: str, k: int) -> list[Candidate]
```

`top_k` ranks candidates by reranker score if available, otherwise by FoldX ΔΔG (ascending), otherwise by OmegaFold pLDDT (descending).

## CLI (`query/cli.py`)

```bash
python -m synqlab.query.cli get-experiment --id <uuid>
python -m synqlab.query.cli list-runs --experiment-id <uuid>
python -m synqlab.query.cli top-k --experiment-id <uuid> --k 10
python -m synqlab.query.cli filter-by-tag --key round --value 1
```

Output is a formatted table printed to stdout (no external dependencies — plain `str` formatting is fine for V1).

## Connections

- Reads from `synqlab/storage/service.py` and the PostgreSQL DB
- Called by `scripts/deploy.sh` smoke test after a mock run
