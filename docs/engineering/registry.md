# Tool Registry

SynqLab has **one** tool registry. There is no V1/V2 split — the product is treated as a single system, and a tool's maturity is expressed per-tool via `status`.

## The two layers

| Concern | Source of truth |
| --- | --- |
| What the conversational agent can call | `synqLab-agent/synqlab/agent/tools/` (code) |
| What adapter/pipeline tools exist + their contracts | `registry/tools.yaml` (single YAML) |

`registry/tools.yaml` is read by `synqLab-agent/synqlab/registry/loader.py` and is also surfaced by the tools API (`/api/tools`, `/api/tools/all`) and the Helm registry ConfigMap.

## `registry/tools.yaml`

A single catalogue of every tool. Top-level `registry_version`/`phase` fields are gone. Each tool declares a `status`:

| `status` | Meaning |
| --- | --- |
| `active` | Has a working adapter; callable in the live pipeline today |
| `planned` | Scoped and designed; adapter present or in progress |

Tools in the **Catalogue** section are long-horizon references with no `adapter`. The loader **skips any entry without an `adapter`**, so catalogue tools stay documented in one place without being loaded at runtime.

### Tool fields

`id`, `name`, `category`, `status`, `adapter`, `adapter_class`, `execution_mode`,
`description`, `abstract`, `meta`, `capabilities`, `inputs`, `outputs`, `examples`,
`resource_profile`, `links`, `tags`, `notes`. Unknown keys are preserved as `extra`.

Validation (`synqlab/registry/validator.py`) requires `id`, `name`, `category`, `status`, `adapter`, `adapter_class` for every **loaded** tool.

## Where it is consumed

- `synqlab/registry/loader.py` — loads `tools.yaml`, builds `ToolDefinition`s
- `synqlab/orchestrator/pipeline.py` — resolves adapters for the live pipeline
- `synqlab/core/config.py`, `synqlab/core/schemas.py` — default `registry_path`
- `app/main.py` — `/api/tools`, `/api/tools/all`, `/api/categories*`
- `configs/base.yaml`, `configs/gfp11.yaml` — `registry.path`
- `deploy/helm/synqlab/files/tools.yaml` + `templates/shared/registry-configmap.yaml`

## Maintenance rules

1. **New agent-callable tool** → register in `synqLab-agent/synqlab/agent/tools/`.
2. **New adapter/pipeline tool** → add to `registry/tools.yaml` with `status: active` (and a real `adapter`).
3. **Designed-but-unbuilt tool** → add with `status: planned`; include an `adapter`/`adapter_class` if the class exists, otherwise leave it in the Catalogue section (no adapter) until built.
4. Keep `deploy/helm/synqlab/files/tools.yaml` in sync with `registry/tools.yaml` when deploying.

## Related files

- `registry/tools.yaml`
- `registry/README.md`
- `synqLab-agent/synqlab/registry/loader.py`
- `synqLab-agent/synqlab/registry/validator.py`
- `docs/engineering/design-docs/tools-registry.json` (full design registry with model IDs)
- `docs/engineering/design-docs/knowledge-store.md`
