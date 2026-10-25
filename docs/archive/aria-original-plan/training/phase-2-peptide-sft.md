# Phase 2 — Peptide Binder SFT (V2)

Parent: [`../aria.md`](../aria.md) · Prev: [phase-1-general-sft](phase-1-general-sft.md) · Next: [phase-3-dpo](phase-3-dpo.md)

---

## Objective

Extend Aria from general proteins to **peptides conditioned on a target receptor** — "design a peptide that binds *this* protein." Initialized from V1 weights.

---

## Dataset

| Dataset | Use | Exact selection | URL | Format |
| ------- | --- | --------------- | --- | ------ |
| PepBDB | Primary binder training data | all ~13.3k peptide–protein complexes | [pepbdb](http://huanglab.phys.hust.edu.cn/pepbdb/) | PDB + annotations |
| BioLiP2 (peptide subset) | Additional binding-site/peptide data | filter to peptide ligands | [BioLiP](https://zhanggroup.org/BioLiP/) | TSV + PDB |
| PDB complexes | Extra peptide–protein interfaces | resolution ≤ 3.0 Å, peptide chain 5–30 aa | [rcsb downloads](https://www.rcsb.org/downloads) | PDB / mmCIF |

**Split:** cluster by **target family** (MMseqs2 on receptor sequences) so held-out targets are genuinely unseen — prevents the model from memorizing binder families.

---

## Features used

General-protein features from V1 **plus** target + interface conditioning. Prompt template: **Peptide binder** ([`../aria.md`](../aria.md#prompt-formats)).

| Feature | Tool | Notes |
| ------- | ---- | ----- |
| Target sequence / family | PepBDB / PDB annotation | critical input |
| Peptide length | sequence | 5–30 aa |
| Net charge | Biopython `ProtParam` | conditioned |
| Binding-site / domain | PepBDB annotation | where on the target |
| Interface contact count | PLIP / BioPython | label from the complex |
| H-bond count at interface | PLIP | label from the complex |
| Peptide secondary structure | DSSP / PSIPRED | helical / extended |

---

## Method

| Setting | Value |
| ------- | ----- |
| Base / init | **Aria V1 weights** (not base Llama) |
| Technique | SFT + LoRA on binder data |
| Config | V1 config; add target fields to prompt |

Framework: [`../../_shared/training-frameworks.md`](../../_shared/training-frameworks.md).

---

## Prior work & how we beat it

| Competitor | What they did | How Aria V2 does better |
| ---------- | ------------- | ----------------------- |
| [PepMLM](https://github.com/programmablebio/pepmlm) | Masked-LM that infills a peptide given a target (e.g. GFP-11 tag task) | Aria is prompt-flexible (length, charge, conformation constraints) and sits in a closed loop (V3); PepMLM is single-shot |
| [RFdiffusion](https://github.com/RosettaCommons/RFdiffusion) + [ProteinMPNN](https://github.com/dauparas/ProteinMPNN) | Diffuse a backbone, then design sequence for it | Aria needs **no input backbone** and runs in sequence space (faster, fewer dependencies); structure-based remains stronger for pure de-novo novelty (honest non-claim) |
| [ESM3](https://github.com/evolutionaryscale/esm) (prompted for binding) | Protein-native LM, not binder-specialized | Aria is target-conditioned and SynqLab-integrated |

---

## Benchmarks

| Tier | Metric | Threshold |
| ---- | ------ | --------- |
| 1 | valid AA, length following | as V1 |
| 1 | target-conditioned vs non-conditioned output | measurably different distributions |
| 2 | peptide pLDDT (ESMFold single-chain) | structured-looking; lower than random control |
| 3 | plausible candidates on held-out target families | ≥ 1 held-out family produces plausible binders |

**Baselines to run:** PepMLM (target-conditioned), random peptide sampling (lower bound), PepBDB family-coverage hit rate, ESM3 prompted.

---

## Publishing angle

**Claim:** "A general protein LLM can be specialized to target-conditioned peptide generation with modest binder data, retaining prompt flexibility."

**Proof:** held-out-target-family eval + comparison to PepMLM and random baseline. This phase sets up V3, which provides the headline (closed-loop improvement) result.

---

## Done when

- Model generates peptides with structured pLDDT above the random control
- Target-conditioned output differs measurably from non-conditioned
- At least one held-out target family yields plausible candidates
