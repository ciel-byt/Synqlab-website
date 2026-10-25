# M2 — GFP11 Integration + Production Readiness — Roadmap

**Created:** 2026-05-02  
**Status:** Planning  
**Source Branch:** `feature/gfp11-agent` (6 commits, worktree at `../synqLab-gfp11-review`)

## Phase Overview

| # | Phase | Description | Plans | Status |
|---|-------|-------------|-------|--------|
| 14 | Scientific Adapter Port | Port brightness_model, complex_stability, pyrosetta, spserver | ~3 | 📋 Planned |
| 15 | Mock Mode Enhancement | Add mock_mode to ESMFold/OmegaFold | ~1 | 📋 Planned |
| 16 | LLM Provider Abstraction | Port/merge provider.py | ~2 | 📋 Planned |
| 17 | GFP11 Pipeline Mode | Integrate ReAct loop into orchestrator | ~3 | 📋 Planned |
| 18 | Registry & Config Update | Add tools to registry, merge config | ~1 | 📋 Planned |
| 19 | Training Scripts | Port train_brightness_model.py, register_gfp11_target.py | ~1 | 📋 Planned |
| 20 | Test Coverage | Port unit tests from feature branch | ~2 | 📋 Planned |
| 21 | Production Observability | Arize Phoenix, metrics, Promptfoo CI/CD | TBD | 📋 Planned |

## Phase Details

### Phase 14: Scientific Adapter Port

**Goal:** Port 4 new scientific adapters from `feature/gfp11-agent`.

**Source files:**
- `synqlab/adapters/brightness_model.py` (263 lines) — ML brightness predictor
- `synqlab/adapters/complex_stability.py` (230 lines) — Complex folding proxy
- `synqlab/adapters/pyrosetta.py` (237 lines) — Interface ΔG scoring
- `synqlab/adapters/spserver.py` (213 lines) — Interaction scoring API

**Key considerations:**
- Adapters must implement `BaseAdapter.run(ToolRequest) -> ToolOutput`
- All adapters need `mock_mode` for laptop development
- BrightnessModelAdapter needs optional `embedder` injection for testing

### Phase 15: Mock Mode Enhancement

**Goal:** Add `mock_mode` to existing ESMFold and OmegaFold adapters.

**Source files:**
- `synqlab/adapters/esmfold.py` — Add `mock_mode` parameter
- `synqlab/adapters/omegafold.py` — Add `mock_mode` parameter

**Behavior:**
- `mock_mode=True` → return deterministic stub PDB + pLDDT
- No GPU/HTTP required in mock mode

### Phase 16: LLM Provider Abstraction

**Goal:** Port the provider pattern for multi-LLM support.

**Source file:** `synqlab/agent/provider.py` (402 lines)

**Classes to port:**
- `LLMProvider` (ABC)
- `AnthropicProvider` — Claude with tool calling
- `OpenAIProvider` — GPT with function calling
- `MockLLMProvider` — Scripted test provider
- `ToolCall`, `ProviderResponse` dataclasses

**Integration decision:** Merge with or replace `synqlab.chat.llm`?

### Phase 17: GFP11 Pipeline Mode

**Goal:** Integrate the ReAct loop as a simple pipeline mode.

**Source files:**
- `synqlab/agent/loop.py` (752 lines) — Main loop driver
- `synqlab/agent/tools.py` (503 lines) — Tool schemas + dispatcher

**Key features:**
- Bounded rounds (`max_loops`, `max_tool_calls_per_loop`)
- Token budget enforcement
- Fitness threshold early-stop
- Knowledge Store integration (per-round findings, summary artifact)
- PDB-dependency validation

### Phase 18: Registry & Config Update

**Goal:** Add GFP11 tools to registry and integrate config.

**Files:**
- `registry/v2.yaml` — Add tool entries
- `configs/gfp11.yaml` — Task config overlay
- `deploy/helm/synqlab/files/v2.yaml` — Helm ConfigMap sync

**New registry entries:**
```yaml
brightness_model:
  category: fitness
  description: GFP11 brightness predictor
  adapter: synqlab.adapters.brightness_model.BrightnessModelAdapter

complex_stability:
  category: structure
  description: Complex folding proxy (ESMFold/OmegaFold backend)
  adapter: synqlab.adapters.complex_stability.ComplexStabilityAdapter

pyrosetta:
  category: stability
  description: Interface ΔG scoring via PyRosetta
  adapter: synqlab.adapters.pyrosetta.PyRosettaAdapter

spserver:
  category: interaction
  description: Protein-protein interaction scoring (IRB Barcelona)
  adapter: synqlab.adapters.spserver.SPServerAdapter
```

### Phase 19: Training Scripts

**Goal:** Port model training and data registration scripts.

**Source files:**
- `scripts/train_brightness_model.py` (622 lines)
- `scripts/register_gfp11_target.py` (228 lines)

**Features:**
- `--feature-mode embedding|one_hot|hybrid`
- `--k-folds` cross-validation
- Knowledge Store registration

### Phase 20: Test Coverage

**Goal:** Port unit tests from feature branch.

**Source files:**
- `tests/unit/test_brightness_adapter.py` (232 lines)
- `tests/unit/test_complex_stability_adapter.py` (233 lines)
- `tests/unit/test_pyrosetta_adapter.py` (145 lines)
- `tests/unit/test_spserver_adapter.py` (191 lines)
- `tests/unit/test_agent_loop.py` (597 lines)
- `tests/unit/test_train_brightness_model.py` (299 lines)

### Phase 21: Production Observability

**Goal:** Address deferred observability items from v1.0.

**Scope:**
- Arize Phoenix tracing integration
- Org-level usage aggregation
- Session outcome tracking
- Promptfoo CI/CD eval pipeline

## Dependencies

```
Phase 14 (Adapters) ─┬─► Phase 17 (Pipeline Mode)
                     │
Phase 15 (Mock Mode) ┘
                     
Phase 16 (Providers) ─► Phase 17 (Pipeline Mode)

Phase 17 ─► Phase 18 (Registry) ─► Phase 20 (Tests)

Phase 14 ─► Phase 19 (Training Scripts)

Phase 20 (Tests) ─► Phase 21 (Observability)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| PyRosetta not available in CI | `mock_mode=True` by default in tests |
| SPServer API changes | Mock responses in tests; retry logic in adapter |
| ESM-2 weights too large for CI | Stub embedder injection in tests |
| Merge conflicts with existing chat.llm | Decide early: merge vs. replace |
