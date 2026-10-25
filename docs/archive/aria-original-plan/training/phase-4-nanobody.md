# Phase 4 — Nanobody / VHH (V4)

Parent: [`../aria.md`](../aria.md) · Prev: [phase-3-dpo](phase-3-dpo.md) · Next: [phase-5-enzyme](phase-5-enzyme.md)

Status: Future (reuses V1–V3 machinery for a new modality)

---

## Objective

Extend Aria to **single-domain antibody (nanobody / VHH) design** — generate developable VHH sequences with realistic CDR loops, optionally optimized via DPO.

---

## Dataset

| Dataset | Use | Exact selection | URL | Format |
| ------- | --- | --------------- | --- | ------ |
| OAS (Observed Antibody Space) | Large-scale VHH/heavy-chain SFT pretraining | filter to VHH / heavy-chain-only units | [oas](https://opig.stats.ox.ac.uk/webapps/oas/) | CSV per unit |
| SAbDab | Antibody–antigen structures + CDR data | all structures | [sabdab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/SAbDab/) | PDB + TSV |
| SAbDab-nano (VHH subset) | Nanobody-specific structures | filter `vh_call` starts with `VH` | same URL | PDB + TSV |
| Thera-SAbDab | Therapeutic relevance filtering | therapeutic VHH entries | [therasabdab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/TheraSAbDab) | CSV |

**Split:** cluster by antigen + germline to avoid leaking families.

---

## Features used

Peptide-binder features **plus** antibody-specific conditioning:

| Feature | Tool | Notes |
| ------- | ---- | ----- |
| Germline (V/J) | ANARCI | conditioning |
| CDR1/2/3 lengths | ANARCI | exact loop-length control |
| Antigen type / target | SAbDab annotation | what it binds |
| Humanness score | AbLang2 | clinical relevance constraint |
| Developability (charge, aggregation) | Biopython, aggrescan3D | filter |

Antibody tools: [`../../_shared/scoring-tools.md`](../../_shared/scoring-tools.md#antibody-specific-tools-aria-v4-and-future-antibody-agents).

---

## Method

| Setting | Value |
| ------- | ----- |
| Base / init | Aria V1 (general) or V3 (binder-optimized) |
| Technique | SFT then DPO with CDR-focused scoring |
| Structure scoring | IgFold / NanoBodyBuilder2 (VHH-aware, not ESMFold) |

---

## Prior work & how we beat it

| Competitor | What they did | How Aria V4 does better |
| ---------- | ------------- | ----------------------- |
| [AbLang2](https://github.com/oxpig/AbLang2) | Antibody LM for infilling/likelihood | Aria generates full VHH conditioned on germline + CDR-length + target, with a DPO loop |
| [IgFold](https://github.com/Graylab/IgFold) | Structure prediction (not generation) | used by Aria as a scorer, not a competitor |
| [AntiFold](https://github.com/oxpig/AntiFold) | Inverse folding (sequence from antibody backbone) | Aria needs no backbone input |

---

## Benchmarks

| Tier | Metric | Threshold |
| ---- | ------ | --------- |
| 1 | valid AA, CDR-length following | CDR lengths match request > 90% |
| 1 | humanness (AbLang2) | within human distribution |
| 2 | VHH pLDDT (IgFold/NanoBodyBuilder2) | structured CDR loops |
| 3 | held-out antibody quality | vs SAbDab held-out set |

**Eval dataset:** SAbDab held-out antibodies.

---

## Publishing angle

**Claim:** "The same prompt-conditioned + DPO recipe transfers from peptides to single-domain antibodies, producing developable VHH candidates."

**Proof:** CDR-realism + humanness + developability on held-out SAbDab, vs AbLang2-sampled baseline.

---

## Done when

- CDR-realistic outputs (lengths + composition within natural ranges)
- Developability constraints met (humanness, low aggregation)
- Held-out VHH quality competitive with antibody-LM baselines
