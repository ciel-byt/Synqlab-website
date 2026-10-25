# Tool Registry

One file: `tools.yaml` — the single source of truth for all adapter/pipeline tools in SynqLab. There is no V1/V2 split.

Implemented agent-callable tools live in code under `synqLab-agent/synqlab/agent/tools/`; this file covers adapter-backed scientific/pipeline tools and the long-horizon catalogue.

## `tools.yaml`

Each tool declares a `status`:


| `status`  | Meaning                         | Loaded at runtime?          |
| --------- | ------------------------------- | --------------------------- |
| `active`  | Working adapter, callable today | Yes                         |
| `planned` | Scoped/designed                 | Yes, if it has an `adapter` |


The loader (`synqLab-agent/synqlab/registry/loader.py`) skips any entry without an `adapter`.

## Maintenance

1. Add agent-callable tools in `synqLab-agent/synqlab/agent/tools/`.
2. Add adapter/pipeline tools here with a `status` and (for runtime tools) a real `adapter` + `adapter_class`.



