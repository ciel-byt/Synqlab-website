# Component Spec — Orchestrator

## Responsibility

The orchestrator owns the V1 pipeline loop. It reads an `ExperimentConfig`, invokes tools in the correct order via `execute_tool`, applies gating policy between stages, tracks budget, and writes a summary artifact at the end.

It does not know how any tool works internally — that is the adapter's job. It only knows what tool to call next and whether the output passes the gate threshold.

## Location

`synqlab/orchestrator/`

## Public interface

```python
def run_experiment(config: ExperimentConfig) -> ExperimentSummary:
    ...
```

## V1 pipeline (fixed order)

```
Stage 1  ProtGPT2          → N candidate sequences
Stage 2  OmegaFold         → structure + pLDDT per candidate
         Gate 1: pLDDT ≥ config.plddt_threshold
Stage 3  FoldX             → ΔΔG per surviving candidate
         Gate 2: ΔΔG ≤ config.ddg_threshold
Stage 4  Reranker          → P(hit) per survivor  [skipped if no model artifact]
Stage 5  top-k selection   → final candidate list
         persist ExperimentSummary artifact
```

## Key files

| File | Role |
|---|---|
| `pipeline.py` | `run_experiment()` — main loop |
| `policy.py` | `V1Policy` — gate thresholds, top-k logic |
| `budget_tracker.py` | `BudgetTracker` — counts and elapsed time |

## Config fields consumed

| Field | Type | Default | Effect |
|---|---|---|---|
| `n_sequences` | int | 50 | How many sequences ProtGPT2 generates |
| `plddt_threshold` | float | 70.0 | Gate 1 cutoff |
| `ddg_threshold` | float | 2.0 | Gate 2 cutoff (kcal/mol) |
| `top_k` | int | 10 | Final selection size |
| `use_reranker` | bool | false | Whether to run Reranker in Stage 4 |
| `mock_mode` | bool | true | If true, all adapters run in mock mode |

## Decision logging

Every gate decision is logged as a structured event:

```json
{"event": "gate_1", "candidate_id": "...", "plddt": 72.4, "passed": true}
```

These events are stored in the `ToolRun` row for the orchestrator itself.

## Connections

- Calls `execute_tool()` from `synqlab/engine/executor.py`
- Reads config via `synqlab/core/config.py`
- Writes summary via `synqlab/storage/service.py`
