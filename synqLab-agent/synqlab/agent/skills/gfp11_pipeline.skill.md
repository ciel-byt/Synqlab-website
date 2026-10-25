---
id: gfp11-pipeline
name: GFP11 Full Pipeline
description: End-to-end GFP11 brightness optimization — generate sequences, fold, score stability, predict brightness, and select top candidates
version: 1.0.0
author: SynqLab Core
tags: [gfp11, pipeline, brightness, protein-engineering, end-to-end]
agent_types: [general, protein_designer, research_director]
tools: [sequence_generation, protein_folding, score_stability, score_brightness, propose_variants, write_report]
autonomy_default: autonomous
---

# GFP11 Full Pipeline

You are running the GFP11 brightness optimization pipeline. This is a multi-stage protocol that generates, folds, scores, and ranks GFP11 variant sequences for experimental validation.

## Pipeline Overview

The GFP11 peptide (~16 amino acids) is the small fragment of split-GFP used in complementation assays. Brighter variants reconstitute more efficiently. Your job is to find variants with high predicted brightness AND structural stability.

## Stage 1: Sequence Generation

1. Use `sequence_generation` to generate 5–10 candidate GFP11 variant sequences.
2. Specify `max_length: 20` and `temperature: 0.8` for focused diversity.
3. If a parent sequence is provided by the user, use `propose_variants` instead to generate mutations around that parent.

## Stage 2: Structure Prediction

1. For each generated sequence, use `protein_folding` to predict 3D structure.
2. Record the pLDDT confidence score for each.
3. **Gate 1**: Discard any sequence with pLDDT < 65 (poor fold confidence).

## Stage 3: Stability Scoring

1. For each surviving sequence, use `score_stability` to compute ΔΔG.
2. **Gate 2**: Discard any sequence with ΔΔG > 2.0 kcal/mol (destabilizing).

## Stage 4: Brightness Prediction

1. For all gate-passing sequences, use `score_brightness` to predict fluorescence.
2. The brightness model returns a score (0–1 probability) and classification (bright/dim).
3. Sort candidates by brightness score descending.

## Stage 5: Selection & Report

1. Select the top 3–5 candidates by combined brightness + stability ranking.
2. Use `write_report` to create a structured summary:
   - **Ranked table**: sequence, pLDDT, ΔΔG, brightness_score, recommendation
   - **Gate statistics**: how many passed each stage
   - **Top picks**: recommended for experimental validation
3. Include the parent sequence (if any) as baseline comparison.

## Decision Rules

- Prioritize brightness score when stability is acceptable (ΔΔG < 1.0).
- If no candidates pass all gates, relax Gate 1 threshold to pLDDT > 55 and re-run.
- Maximum 2 generation rounds before reporting with best available candidates.

## Important Notes

- All tools hit real GPU services — be mindful that folding takes ~30s per sequence.
- The brightness model was trained on experimental GFP11 fluorescence data.
- Always report confidence intervals and caveats about in-silico predictions.
