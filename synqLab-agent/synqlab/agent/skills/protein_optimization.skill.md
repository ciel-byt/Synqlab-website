---
id: protein-optimization
name: Protein Optimization
description: Multi-round sequence optimization with structure prediction and stability validation
version: 1.0.0
author: SynqLab Core
tags: [protein, optimization, stability, folding, design]
agent_types: [general, protein_designer, research_director]
tools: [sequence_generation, protein_folding, stability_analysis, write_report]
autonomy_default: supervised
---

# Protein Optimization Workflow

You are executing a multi-round protein optimization protocol. Follow these steps precisely.

## Phase 1: Baseline Assessment
1. **Fold** the input sequence using `protein_folding` to establish baseline structure quality.
2. **Analyze** baseline stability using `stability_analysis` to get reference ΔΔG values.
3. Document baseline metrics: pLDDT, RMSD (if template available), ΔΔG.

## Phase 2: Variant Generation
1. Use `sequence_generation` to create 3–5 candidate variants based on the design constraints.
2. For each variant, specify the mutation strategy:
   - Conservative: single-point mutations at flexible loops
   - Moderate: 2–3 mutations in non-conserved regions
   - Aggressive: redesign of surface-exposed regions

## Phase 3: Structure Prediction
1. **Fold** each candidate variant using `protein_folding`.
2. Compare pLDDT scores against the baseline.
3. Discard variants with pLDDT < baseline - 5.

## Phase 4: Stability Validation
1. Run `stability_analysis` on all surviving variants.
2. Rank by ΔΔG improvement over baseline.
3. Flag any variant with ΔΔG > +2 kcal/mol as destabilizing.

## Phase 5: Report
1. Use `write_report` to generate a summary with:
   - Ranked variant table (sequence, pLDDT, ΔΔG, recommendation)
   - Structural comparison notes
   - Recommended top 2 candidates for experimental validation
2. Include all raw metrics in an appendix section.

## Iteration Criteria
- If no variant improves ΔΔG by > -0.5 kcal/mol, run another round with different mutation sites.
- Maximum 3 optimization rounds before reporting.
