# M2 — GFP11 Integration + Production Readiness — Requirements

## Overview

**Primary Goal:** Integrate `feature/gfp11-agent` branch into the main orchestration platform.

**Source:** 6 commits on `feature/gfp11-agent` branch (worktree at `../synqLab-gfp11-review`)

## Functional Requirements

### REQ-M2-01: Scientific Adapter Port
Port 4 new scientific adapters from the GFP11 branch that implement the protein engineering fitness function:

| Adapter | Purpose | Dependencies |
|---------|---------|--------------|
| `brightness_model.py` | GFP11 brightness predictor (p_hit + regression) | scikit-learn, ESM-2 (optional for embedding mode) |
| `complex_stability.py` | Fold GFP11 + GFP1-10 complex, return pLDDT | ESMFold or OmegaFold backend |
| `pyrosetta.py` | Interface ΔG scoring | PyRosetta (optional; mock_mode for dev) |
| `spserver.py` | Protein-protein interaction scoring via IRB Barcelona API | HTTP client |

**Acceptance:**
- [ ] All 4 adapters pass unit tests in isolation
- [ ] Adapters integrate with existing `BaseAdapter` contract
- [ ] Mock mode works for laptop development (no GPU/external services)

### REQ-M2-02: Mock Mode Enhancement
Add `mock_mode` parameter to ESMFold and OmegaFold adapters for laptop-friendly development.

**Acceptance:**
- [ ] `ESMFoldAdapter(mock_mode=True)` returns deterministic stub PDB + pLDDT
- [ ] `OmegaFoldAdapter(mock_mode=True)` returns deterministic stub PDB + pLDDT
- [ ] Existing tests remain green

### REQ-M2-03: LLM Provider Abstraction
Port/merge the `provider.py` pattern (Anthropic, OpenAI, Mock providers) into the platform.

**Acceptance:**
- [ ] `AnthropicProvider` supports tool calling with content-block format
- [ ] `OpenAIProvider` supports tool calling with function format
- [ ] `MockLLMProvider` supports scripted test scenarios
- [ ] Provider abstraction integrates with existing `synqlab.chat` infrastructure or supersedes it cleanly

### REQ-M2-04: GFP11 Pipeline Mode
Integrate the ReAct loop (`loop.py`) as a "simple pipeline mode" within the orchestrator — bounded rounds, token/fitness gates, Knowledge Store integration.

**Acceptance:**
- [ ] `run_agent(config)` can be invoked from the orchestrator
- [ ] Bounds enforced: max_loops, max_tool_calls_per_loop, token_budget, fitness_threshold
- [ ] Round-level findings written to Knowledge Store
- [ ] Final summary artifact registered
- [ ] CLI: `python -m synqlab.agent.loop --config configs/gfp11.yaml --mock-llm` runs end-to-end

### REQ-M2-05: Registry & Config Update
Add GFP11 tools to the tool registry and integrate `gfp11.yaml` config.

**Acceptance:**
- [ ] `registry/v2.yaml` includes: `brightness_model`, `complex_stability`, `pyrosetta`, `spserver`
- [ ] `configs/gfp11.yaml` loads via `synqlab.core.config` with deep-merge
- [ ] Helm ConfigMaps updated with new registry entries

### REQ-M2-06: Training Scripts
Port model training and Knowledge Store registration scripts.

**Acceptance:**
- [ ] `scripts/train_brightness_model.py` trains brightness model from labeled CSV
- [ ] `scripts/register_gfp11_target.py` registers GFP1-10 target in Knowledge Store
- [ ] Both scripts have `--help` documentation

### REQ-M2-07: Test Coverage
Port and adapt unit tests from the feature branch.

**Acceptance:**
- [ ] `tests/unit/test_brightness_adapter.py` — 232 lines
- [ ] `tests/unit/test_complex_stability_adapter.py` — 233 lines
- [ ] `tests/unit/test_pyrosetta_adapter.py` — 145 lines
- [ ] `tests/unit/test_spserver_adapter.py` — 191 lines
- [ ] `tests/unit/test_agent_loop.py` — 597 lines
- [ ] `tests/unit/test_train_brightness_model.py` — 299 lines
- [ ] All tests pass in CI

## Non-Functional Requirements

### REQ-M2-08: Production Observability (deferred from v1.0)
- Arize Phoenix tracing integration
- Org-level usage aggregation
- Session outcome field
- Promptfoo CI/CD eval pipeline

### REQ-M2-09: Deferred Items (carried from v1.1)
- D-12 LLM smoke test (predict_structure → analyze_stability chain)
- UI-DROP/UI-PROMOTE live smoke tests
- Security hardening for artifact endpoints (BL-01..BL-07)

## Phase Mapping

| Phase | Requirements |
|-------|--------------|
| 14 — Scientific Adapter Port | REQ-M2-01 |
| 15 — Mock Mode Enhancement | REQ-M2-02 |
| 16 — LLM Provider Abstraction | REQ-M2-03 |
| 17 — GFP11 Pipeline Mode | REQ-M2-04 |
| 18 — Registry & Config Update | REQ-M2-05 |
| 19 — Training Scripts | REQ-M2-06 |
| 20 — Test Coverage | REQ-M2-07 |
| 21 — Production Observability | REQ-M2-08, REQ-M2-09 |
