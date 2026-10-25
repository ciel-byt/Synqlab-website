# Phase 1 — General Protein SFT (V1)

Parent: [`../aria.md`](../aria.md) · Prev: [phase-0-foundation](phase-0-foundation.md) · Next: [phase-2-peptide-sft](phase-2-peptide-sft.md)

---

## Objective

Train a **general, feature-conditioned protein sequence generator** — the base capability ("generate a sequence that follows these property requests") that every later version specializes.

---

## Dataset

Reuse the Phase 0 output. No new data ingestion.

| Dataset | Use | Selection |
| ------- | --- | --------- |
| Phase 0 JSONL (Swiss-Prot + pLDDT + Pfam features) | SFT train | train clusters only |
| Held-out test clusters | eval | never seen in training |

---

## Features used

The full general-protein feature set from Phase 0 (length, charge, pI, GRAVY, instability, aromaticity, disorder, mean pLDDT, Pfam family). Prompt template: **General protein** ([`../aria.md`](../aria.md#prompt-formats)).

---

## Method

| Setting | Value |
| ------- | ----- |
| Base model | Llama-3.1-8B-Instruct |
| Technique | SFT + LoRA |
| Config | start from `Codes/SmileyLlama/sft/cf_lora.yml`, override dataset path |
| Train on | response only (`train_on_inputs: false`) |

Framework + full config: [`../../_shared/training-frameworks.md`](../../_shared/training-frameworks.md).

---

## Prior work & how we beat it

| Competitor | What they did | How Aria V1 does better |
| ---------- | ------------- | ----------------------- |
| [ProtGPT2](https://huggingface.co/nferruz/ProtGPT2) | Unconditional autoregressive protein LM — generates plausible proteins but you can't steer properties | Aria conditions on explicit property prompts (length, charge, disorder, domain) and follows them measurably |
| [ProGen2](https://github.com/salesforce/progen) | Conditional protein LM, but conditioning is coarse (family tags) | Aria conditions on fine-grained computed features + free-text, instruction-following |
| [ESM3](https://github.com/evolutionaryscale/esm) | Protein-native multimodal LM (seq+structure+function) | Aria is prompt-flexible and cheap to fine-tune/optimize; ESM3 is the strong baseline to match on validity |
| Base Llama-3.1 (zero-shot) | Can emit AA-like strings but ignores constraints | Aria's SFT is exactly the delta this measures |

---

## Benchmarks

Mapped to the shared [Tier 1/2/3 harness](../../_shared/evaluation-protocol.md).

**Tier 1 (always):**
| Metric | Threshold |
| ------ | --------- |
| Valid AA rate | > 95% |
| Length following | > 90% within ±10% |
| Novelty vs train | < 70% identity to nearest neighbour |
| Diversity (intra-batch) | broad/bimodal pairwise-identity histogram |

**Tier 2 (sample):**
| Metric | Threshold |
| ------ | --------- |
| Feature following (charge) | mean abs error < 0.5 |
| Feature following (hydrophobicity) | detectable distribution shift per bin |
| Predicted pLDDT (ESMFold, 500 samples) | distribution reported; measurably > base LLM |

**Comparison baselines to run:** base Llama-3.1 zero-shot, ProtGPT2, ESM3 (prompted).

---

## Publishing angle

**Claim:** "Instruction-tuned LLMs can follow fine-grained protein property prompts better than unconditional/coarse-conditional protein LMs."

**Proof:** held-out test clusters (no homology leakage) + side-by-side feature-following vs ProtGPT2/ProGen2/base-LLM. Honest non-claim: *not* claiming better structural novelty than structure-based methods (that's V2/V3 territory).

---

## Done when

- > 95% valid sequences on held-out prompts
- Feature following measurably better than base Llama-3.1 on the held-out test set
- Novelty < 70% identity to nearest training neighbour
- Diversity histogram broad (not collapsed)
