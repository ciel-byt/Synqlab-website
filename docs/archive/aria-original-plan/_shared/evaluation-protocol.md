# Shared — Evaluation Protocol Template

A reusable three-tier evaluation harness run **after every model version** of any generative agent. Each agent/phase doc states which tier metrics apply and the exact pass thresholds; the *structure* lives here.

> Tiering exists so cheap checks gate expensive ones: never spend GPU on Tier 3 for a model that fails Tier 1.

---

## Tier 1 — Always run (fast, CPU-only)

Run on the full eval set. If any threshold fails, stop and fix before spending compute.

| Metric | How | Typical threshold |
| ------ | --- | ----------------- |
| Valid-token rate | Check output against the agent's valid vocabulary (e.g. 20 canonical AAs, or RDKit-parseable SMILES) | > 99% |
| Constraint following — length | Output length vs requested range | > 90% within ±10% |
| No forbidden tokens | String check (stop/unknown/`X`) | 100% |
| Novelty (nearest neighbour) | MMseqs2 / Tanimoto vs train set | per-phase (e.g. < 80% identity for > 80% of samples) |
| Diversity (intra-batch) | Pairwise identity / similarity histogram | per-phase (e.g. mean identity < 60%) |

---

## Tier 2 — Run on a sample (moderate compute, 1 GPU)

| Metric | How | Typical threshold |
| ------ | --- | ----------------- |
| Structural confidence | ESMFold pLDDT on ~500 samples | per-phase (e.g. mean > 70) |
| Feature following | Recompute each conditioned feature, compare to prompt | per-feature MAE / KL threshold |

---

## Tier 3 — Run at milestones (expensive, batched GPU)

| Metric | How | Typical threshold |
| ------ | --- | ----------------- |
| Objective metric on held-out targets | Boltz-1 / Chai-1 / docking on ~100 samples per target | per-phase |
| Version-over-version improvement | New vs previous version on the same held-out set | per-phase (e.g. > 5% gain) |

---

## Rules

1. **Eval set is held out by cluster** (MMseqs2 split) — never overlaps training data. See [`scoring-tools.md`](scoring-tools.md).
2. **Same eval set across versions** so version-over-version deltas are meaningful.
3. **Report all tiers** in the lineage record, even metrics with "report-only, no threshold."
4. A version that fails Tier 1 is **not registered**, regardless of later scores.
