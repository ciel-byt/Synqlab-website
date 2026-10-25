# Phase 3 — Closed-Loop DPO (V3)

Parent: [`../aria.md`](../aria.md) · Prev: [phase-2-peptide-sft](phase-2-peptide-sft.md) · Next: [phase-4-nanobody](phase-4-nanobody.md)

---

## Objective

The headline phase: an **iterative DPO loop** that optimizes peptide binders against real binding + developability scores — the SmileyLlama analogue for binders. This is what differentiates Aria from static generators.

---

## Dataset

| Source | Use |
| ------ | --- |
| V2 training targets | prompts to generate against |
| **Self-generated candidates** | the actual DPO training data (chosen/rejected pairs) |
| Held-out target families (from V2 split) | evaluation only |

No new external dataset — V3 generates and scores its own preference data.

---

## Loop (per iteration)

Method reference: [`../../_shared/method-sft-dpo.md`](../../_shared/method-sft-dpo.md).

1. For each training target, generate **N = 50–200** candidate peptides with the current model.
2. Score each candidate (tools below).
3. Compute composite score; pair **top quartile (chosen)** vs **bottom quartile (rejected)** per prompt.
4. Build DPO JSONL; run TRL/Axolotl DPO from the current checkpoint.
5. Evaluate vs previous version on held-out targets.
6. Repeat for **2–3 iterations**.

---

## Scoring tools used

See [`../../_shared/scoring-tools.md`](../../_shared/scoring-tools.md).

| Metric | Tool | Meaning |
| ------ | ---- | ------- |
| ipTM | Chai-1 / Boltz-1 / AF-Multimer | interface confidence (complex-level) — the main signal |
| Interface pAE | same | predicted alignment error at interface (penalty) |
| Peptide pLDDT | ESMFold | structural confidence of the peptide alone |
| Contact count | structure parser / PLIP | number of interface contacts |
| Solubility / charge | Biopython `ProtParam` | developability proxy |
| Novelty | MMseqs2 | max identity to training binders |

### Composite score

```python
score = (
    w_iptm     * iptm
  - w_pae      * interface_pae
  + w_contacts * contact_count
  + w_plddt    * peptide_plddt
  + w_solub    * solubility_score
  + w_novelty  * novelty_score
) * hard_filters_pass   # binary 0/1
```

**Hard filters (must pass):** canonical AAs only · length 5–30 · no stop/unknown tokens · GRAVY within range (no extreme hydrophobicity) · no known aggregation motif (heuristic).

---

## Prior work & how we beat it

| Competitor | What they did | How Aria V3 does better |
| ---------- | ------------- | ----------------------- |
| Aria V2 (SFT only) | Generates, no optimization | direct measurement of DPO improvement |
| [PepMLM](https://github.com/programmablebio/pepmlm) | Best sequence-based binder model, single-shot | has no preference loop — V3 iteratively improves on its own objective |
| [RFdiffusion](https://github.com/RosettaCommons/RFdiffusion) + ProteinMPNN | SOTA structure-based pipeline | stronger on pure structural novelty (honest non-claim), but not iterative on a binding objective the way V3 is |
| Random search | lower bound | V3 should dominate by a wide margin |

**The differentiator:** PepMLM, ProtGPT2, and RFdiffusion are not iterative preference-optimized on a binding score. V3's closed loop is the novel contribution.

---

## Benchmarks

Tier 3 metric table (run on subset at each iteration):

| Metric | Tool | Threshold |
| ------ | ---- | --------- |
| ipTM on held-out targets | Chai-1 / Boltz-1, 100 samples/target | mean ipTM > 0.6 |
| Interface pAE | same | mean pAE < 15 |
| DPO improvement | V3 vs V2 mean ipTM, held-out | **> 5% improvement** |
| Novelty | MMseqs2 | < 80% identity to training binders |
| Validity / developability | hard filters | maintained vs V2 |

---

## Publishing angle

**Claim (headline):** "Closed-loop DPO over structure-predicted binding scores improves an LLM peptide-binder generator beyond its SFT baseline, without new labeled data."

**Proof:** > 5% mean-ipTM gain V3-over-V2 on held-out target families, with maintained validity/novelty. Benchmark against PepMLM and random; report RFdiffusion+ProteinMPNN as the structure-based reference. Held-out evaluation datasets: **SKEMPI 2.0** (affinity-change targets), **PepBDB held-out complexes**, **DB5 docking benchmark**.

---

## Done when

- V3 improves mean ipTM by > 5% over V2 on held-out targets
- Validity / developability constraints maintained
- Generates novel candidates (< 80% identity to training binders)
