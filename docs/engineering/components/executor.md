# Component Spec — Execution Engine

## Responsibility

Provide one standard function — `execute_tool` — that any caller can use to run any registered tool. It resolves the adapter, wraps execution with timing and error handling, persists the run record before and after, and returns a canonical `ToolOutput`.

No caller ever instantiates an adapter directly. Everything goes through `execute_tool`.

## Location

`synqlab/engine/`

## Public interface

```python
def execute_tool(
    tool_id: str,
    request: ToolRequest,
    context: ToolContext,
) -> ToolOutput:
    ...
```

## `ToolContext` fields

| Field | Type | Notes |
|---|---|---|
| `experiment_id` | UUID | |
| `round_id` | int | |
| `artifact_dir` | Path | pre-built by `artifact_paths.py` |
| `mock_mode` | bool | passed to adapter |
| `config` | dict | full experiment config snapshot |

## Execution sequence

```
1. Look up ToolDefinition from registry
2. Check status == active  (raise RegistryError otherwise)
3. create_tool_run(...)  →  run_id
4. resolve_adapter(tool_def)  →  adapter instance
5. adapter.run(request, context)
6. complete_tool_run(run_id, output)  OR  fail_tool_run(run_id, error)
7. return ToolOutput
```

Steps 3 and 6 always execute — even if step 5 raises. A failed tool call is never silently dropped.

## Key files

| File | Role |
|---|---|
| `executor.py` | `execute_tool()` |
| `adapter_resolver.py` | `resolve_adapter(tool_def) -> BaseAdapter` — dynamically imports adapter module and instantiates adapter class |

## Adapter resolution

`adapter_resolver.py` reads `tool_def.adapter` (module path) and `tool_def.adapter_class` (class name), imports the module dynamically, and returns an instance. This means new adapters are discovered automatically — no hardcoded registry of class names.

## Connections

- Called by `synqlab/orchestrator/pipeline.py` for every pipeline stage
- Reads registry via `synqlab/registry/loader.py`
- Writes to DB via `synqlab/storage/service.py`
- Delegates execution to `synqlab/adapters/`
