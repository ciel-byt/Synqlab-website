# Component Spec — Storage

## Responsibility

Persist every run, candidate, score, artifact reference, and tag produced by the pipeline. Provide deterministic artifact paths so any component can reconstruct where a file lives from IDs alone — without scanning directories.

## Location

`synqlab/storage/`

## Database

PostgreSQL via SQLAlchemy + `psycopg2`. Connection URL from `SYNQLAB_DB_URL` env var, falling back to `configs/base.yaml`. A `docker-compose.yml` at the repo root provides the container (`postgres:16`, port 5432, db `synqlab`).

## Schema

### `experiments`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | str | human label |
| `config_json` | jsonb | full `ExperimentConfig` snapshot |
| `created_at` | timestamp | |
| `status` | str | running / completed / failed |

### `tool_runs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `experiment_id` | FK → experiments | |
| `round_id` | int | pipeline round number |
| `tool_id` | str | matches registry id |
| `input_json` | jsonb | full `ToolRequest` |
| `output_json` | jsonb | full `ToolOutput` or null if failed |
| `status` | str | running / completed / failed |
| `error` | str | null unless failed |
| `started_at` | timestamp | |
| `finished_at` | timestamp | |

### `artifacts`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `run_id` | FK → tool_runs | |
| `name` | str | logical name (e.g. `pdb_path`) |
| `path` | str | absolute filesystem path |
| `artifact_type` | str | pdb / json / csv / pkl / etc. |
| `created_at` | timestamp | |

### `tags`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `entity_type` | str | experiment / run / candidate |
| `entity_id` | UUID | |
| `key` | str | |
| `value` | str | |

## Public API (`storage/service.py`)

```python
create_experiment(config: ExperimentConfig) -> Experiment
create_tool_run(experiment_id, round_id, tool_id, input: ToolRequest) -> ToolRun
complete_tool_run(run_id, output: ToolOutput) -> None
fail_tool_run(run_id, error: str) -> None
record_artifact(run_id, name, path, artifact_type) -> Artifact
attach_tag(entity_type, entity_id, key, value) -> None
```

## Artifact path convention

```
artifacts/{experiment_id}/{round_id}/{tool_id}/{run_id}/{filename}
```

Built by `storage/artifact_paths.py`. All adapters receive this path via `ToolContext` — they never construct paths themselves.

## Connections

- Used by `synqlab/engine/executor.py` to wrap every tool call
- Used by `synqlab/query/api.py` to serve results
- Used by `synqlab/adapters/experiment_store.py` as a thin adapter wrapper
