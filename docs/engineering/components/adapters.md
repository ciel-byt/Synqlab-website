# Component Spec — Adapters

## Responsibility

Each adapter wraps one external tool and translates between SynqLab's canonical `ToolRequest` / `ToolOutput` schema and the tool's native interface (Python API, CLI binary, HTTP endpoint, etc.).

Adapters are the only layer that knows how a specific tool works. Everything above them (executor, orchestrator) is tool-agnostic.

## Location

`synqlab/adapters/`

## Base contract (`adapters/base.py`)

```python
class BaseAdapter(ABC):
    mock_mode: bool = True

    @abstractmethod
    def run(self, request: ToolRequest, context: ToolContext) -> ToolOutput:
        ...
```

Every adapter must:
- Accept a `ToolRequest` and return a `ToolOutput` — no raw dicts
- Respect `mock_mode`: when `True`, return synthetic but schema-valid output without calling any real model or binary
- Write all file outputs to `context.artifact_dir` only — never to a hardcoded or relative path
- Not catch exceptions silently — let them propagate to `execute_tool` for consistent logging

## V1 adapters

### `ProtGPT2Adapter`
- Real mode: loads `nferruz/ProtGPT2` via HuggingFace `transformers`, samples `n_sequences` sequences
- Mock mode: returns `n_sequences` short dummy amino acid strings from `tests/fixtures/sample_sequences.txt`
- Output: `{sequences: list[str], generation_metadata: artifact_json}`

### `OmegaFoldAdapter`
- Real mode: runs OmegaFold inference; writes PDB to `context.artifact_dir`
- Mock mode: copies `tests/fixtures/sample.pdb` to artifact dir; returns pLDDT = 75.0
- Output: `{pdb_path: str, confidence: float, per_residue_plddt: list[float]}`

### `FoldXAdapter`
- Real mode: calls FoldX binary via subprocess; parses `Average` energy from output
- Mock mode: returns `ddg = 1.2`, writes a stub text file as raw output artifact
- Output: `{ddg: float, raw_output_path: str}`
- Note: FoldX binary path must be set in config (`foldx.binary_path`)

### `RerankerAdapter`
- Real mode: loads `artifacts/reranker/model.pkl` (sklearn); predicts P(hit) from `{plddt, ddg}` features
- Skip mode (no model artifact): returns `{score: null, model_version: "none", skipped: true}` — not an error
- Mock mode: returns `score = 0.65`
- Output: `{score: float | null, model_version: str, skipped: bool}`

### `ExperimentStoreAdapter`
- Thin wrapper over `storage/service.py`
- Exists so the storage layer can be invoked as a tool through `execute_tool` if needed
- Output: `{status: "ok"}`

### `FluorescenceLabelIngestAdapter`
- Real mode: reads CSV/XLSX via pandas; registers each row as a `KnowledgeArtifact` in the Knowledge Store
- Mock mode: reads `tests/fixtures/brightness_mini.csv`; registers 10 rows
- Output: `{artifact_id: str, n_registered: int}`

## Mock adapter (`adapters/mock.py`)

`MockAdapter` is a catch-all used in tests for any tool not yet implemented. It returns a synthetic `ToolOutput` with all required fields set to zero/empty values. It never raises.

## Connections

- Instantiated by `synqlab/engine/adapter_resolver.py`
- Called by `synqlab/engine/executor.py`
- Inputs/outputs must exactly match the `inputs:` / `outputs:` fields in `registry/v1.yaml`
