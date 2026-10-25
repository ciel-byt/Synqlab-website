# SynqLab — System Component Specs

Each file in this folder is the design spec for one software component.
It defines the component's responsibility, public interface, key decisions, and how it connects to the rest of the system.

These are the contracts agents and engineers work from. Code must match the spec; if it diverges, update the spec first and explain why.

## Components

| File | Component | Phase |
|---|---|---|
| `orchestrator.md` | Orchestrator + V1 pipeline | V1 |
| `storage.md` | Storage service + artifact paths | V1 |
| `registry.md` | Registry loader + validator | V1 |
| `executor.md` | Execution engine + adapter resolver | V1 |
| `adapters.md` | Adapter base + all V1 adapters | V1 |
| `knowledge-store.md` | Knowledge Store (ingestion, retrieval, scoping) | V1–V2 |
| `query.md` | Query + tagging layer | V1 |
| `reranker.md` | Reranker model + training pipeline | V1 (optional) |

## Related docs

- Architecture overview: [`docs/architecture.md`](../architecture.md)
- Full knowledge store design: [`docs/design-docs/knowledge-store.md`](../design-docs/knowledge-store.md)
- V1 execution prompt: [`docs/exec-plans/active/v1-execution-prompt.md`](../exec-plans/active/v1-execution-prompt.md)
