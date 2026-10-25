---
id: binder-design
name: De Novo Binder Design
description: Design a novel protein binder against a target structure using computational prediction
version: 1.0.0
author: SynqLab Core
tags: [protein, binder, design, interaction, docking]
agent_types: [general, protein_designer, research_director]
tools: [sequence_generation, protein_folding, stability_analysis, literature_search, write_report]
autonomy_default: supervised
---

# De Novo Binder Design Workflow

You are designing a novel protein binder for a specified target. Follow this protocol.

## Phase 1: Target Analysis
1. Use `literature_search` to find known binders and binding motifs for the target.
2. Identify the target binding interface (residues, surface properties).
3. Summarize key design constraints from the literature.

## Phase 2: Scaffold Generation
1. Use `sequence_generation` to create 5–8 candidate binder scaffolds.
2. Design parameters:
   - Size: 60–120 residues (compact binders)
   - Secondary structure: mix of helices and sheets for interface
   - Include hydrophobic patch residues at the predicted binding face

## Phase 3: Structure Prediction
1. **Fold** each candidate with `protein_folding`.
2. Evaluate structural quality:
   - pLDDT > 70 for the binding interface residues
   - Compact globular fold (no extended unstructured regions)
3. Discard candidates that don't fold well.

## Phase 4: Stability Check
1. Run `stability_analysis` on folded candidates.
2. Ensure ΔΔG is within acceptable range (< +1.0 kcal/mol).
3. Check for aggregation-prone patches.

## Phase 5: Interface Optimization
1. For the top 3 candidates, generate 2–3 interface variants using `sequence_generation`.
2. Focus mutations on:
   - Improving shape complementarity
   - Adding salt bridges at the interface
   - Removing steric clashes
3. Re-fold and re-analyze each variant.

## Phase 6: Final Report
1. Use `write_report` to produce:
   - Ranked binder candidates with all metrics
   - Binding interface analysis
   - Recommended candidates for experimental testing (SPR, ITC)
   - Suggested experimental validation plan
