# Aria — Training Phases

The Aria training program, one file per version. Parent: [`../aria.md`](../aria.md).

---

## Training loop (the shape every phase follows)

```
Database ingestion
   ↓
Feature extraction
   ↓
Prompt generation (randomized feature subsets)
   ↓
SFT (Axolotl / LoRA)   ←── base LLM (Llama-3.1-8B-Instruct)
   ↓
Aria V1 (general generator)
   ↓
Generate N candidates per prompt
   ↓
Score candidates (shared scoring tools)
   ↓
Pair high vs low → DPO (TRL / Axolotl)
   ↓
Aria V2/V3 (property-optimized specialist)
   ↓ [repeat]
```

Method detail: [`../../_shared/method-sft-dpo.md`](../../_shared/method-sft-dpo.md).

> Each phase lists its **exact** dataset selection and per-phase competitors. Full references live in [`../datasets/`](../datasets/README.md) (dataset specs) and [`../related-work/`](../related-work/README.md) (similar works).

---

## Phase index

| Phase | Version | Goal | Builds on |
| ----- | ------- | ---- | --------- |
| [phase-0-foundation](phase-0-foundation.md) | V0 | Data + scoring pipeline, no training | — |
| [phase-1-general-sft](phase-1-general-sft.md) | V1 | General feature-conditioned protein generator | V0 data |
| [phase-2-peptide-sft](phase-2-peptide-sft.md) | V2 | Target-conditioned peptide binder generator | V1 weights |
| [phase-3-dpo](phase-3-dpo.md) | V3 | Closed-loop peptide binder optimizer (DPO) | V2 model |
| [phase-4-nanobody](phase-4-nanobody.md) | V4 | Nanobody / VHH generator + optimizer | V1 or V3 |
| [phase-5-enzyme](phase-5-enzyme.md) | V5 | Enzyme / functional protein generator | V1 |

---

## Phase doc template

Every phase file uses the same sections so they stay comparable and implementation-ready:

1. **Objective** — what this version delivers, one line
2. **Dataset** — exact datasets, sizes, URLs, and the precise filter/query to apply
3. **Features used** — the exact features conditioned in the prompt, with the tool that computes each
4. **Method** — base/parent checkpoint, technique, config pointer
5. **Prior work & how we beat it** — competitors, what each did (one line), Aria's concrete edge for this stage
6. **Benchmarks** — exact metrics + pass thresholds (mapped to the shared Tier 1/2/3 harness)
7. **Publishing angle** — the claim this phase supports and the held-out dataset that proves it
8. **Done when** — explicit exit criteria
