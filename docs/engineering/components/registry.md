# Component Spec — Registry

## Responsibility

Load `registry/v1.yaml` at startup into an in-memory dict of `ToolDefinition` objects. Validate every entry. Provide the single source of truth for what tools exist and what adapter class handles each one.

## Location

`synqlab/registry/`

## Public interface

```python
def load_registry(path: str) -> dict[str, ToolDefinition]:
    ...

def validate_registry(tools: dict[str, ToolDefinition]) -> None:
    # raises RegistryError on missing required fields
    ...
```

## `ToolDefinition` fields (mirrors `registry/v1.yaml`)

| Field | Type | Required |
|---|---|---|
| `id` | str | yes |
| `name` | str | yes |
| `category` | str | yes |
| `status` | str | yes |
| `adapter` | str | yes — relative path to adapter module |
| `adapter_class` | str | yes — class name inside that module |
| `execution_mode` | str | yes — sync / async |
| `description` | str | yes |
| `capabilities` | list[str] | yes |
| `inputs` | list[InputSpec] | yes |
| `outputs` | list[OutputSpec] | yes |
| `resource_profile` | dict | yes |
| `tags` | list[str] | no |
| `notes` | str | no |

## Validation rules

- `id` must be unique across all entries
- `adapter_class` must be a non-empty string
- `status` must be one of: `active`, `planned`, `experimental`, `deprecated`
- `execution_mode` must be `sync` or `async`
- Tools with `status != active` are loaded but not invokable (raise `RegistryError` if called)

## Usage

```python
from synqlab.registry.loader import load_registry

tools = load_registry("registry/v1.yaml")
tool_def = tools["protgpt2"]
print(tool_def.adapter_class)  # ProtGPT2Adapter
```

## Connections

- Read by `synqlab/engine/adapter_resolver.py` to map tool_id → adapter instance
- Read by `synqlab/engine/executor.py` to look up tool definitions before each call
- Validated by `scripts/deploy.sh` as the first startup check
