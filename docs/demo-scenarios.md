# Demo scenarios

The scenarios used in the product demos, written down so they can be restored, extended or filmed. Updated 2026-10-24.

## 1. SynqLab agent: starter scenarios (New chat)

File: `synqLab-agent/frontend/src/features/agent/starterPrompts.ts`. For the demo only **one** chip is offered, in every mode
(General, Research Director, Pipeline). Clicking it starts a scripted conversation (see section 2).

### Kept

| Chip | Message sent | Opens |
| --- | --- | --- |
| ✦ Design brighter GFP11 variants | "I have split-GFP assay brightness data for 113 GFP11 variants. Design a closed-loop optimization workflow that proposes new variants with higher fluorescence while preserving GFP1-10 binding and thermal stability. Use AlphaFold-Multimer for structure prediction. Run three rounds of 50 candidates each and return the top five for wet-lab validation." | demo flow `/lab/pipelines/gfp11-demo/run` |

### Removed from the New chat screen (kept here to restore)

**General research**

| Chip | Message | Needs |
| --- | --- | --- |
| Search PubMed for protein stability ML papers | "Search PubMed for recent papers on protein stability prediction using machine learning." | – |
| Compare AlphaFold vs ESMFold | "Create an analysis report on the advantages of AlphaFold vs ESMFold for protein engineering." | – |
| Fold a short peptide with ESMFold | "Predict the structure of the sequence RDHMVLHEYVNAAGIT using ESMFold and report the pLDDT score." | esmfold-svc |
| Score crambin stability with FoldX | "Analyze the stability of the crambin structure (1crn) using FoldX." | foldx-svc |
| Generate de novo protein sequences | "Generate 3 short candidate protein sequences (around 40 residues each) and briefly describe their composition." | protgpt2-svc |
| Summarize recent CRISPR papers | "Search for 3 recent papers on CRISPR protein engineering and summarize the key findings." | – |

**Research Director**

| Chip | Message |
| --- | --- |
| Design a thermostable GFP variant | "Design a thermostable GFP variant: search literature for known stabilizing mutations, generate candidates, fold the top 3, and score their stability. Produce a ranked report." |
| Screen 5 binder candidates end-to-end | "Generate 5 candidate binder sequences for the target protein, fold each with ESMFold, analyze stability with FoldX, and produce a ranked comparison report." |
| Literature review on split-GFP engineering | "Search for papers on split-GFP protein engineering, summarize key approaches for improving GFP11 complementation, and write a comprehensive review report." |
| Multi-worker enzyme stability protocol | "Find literature on protein engineering approaches for enzyme stability, then create a protocol document summarizing best practices. Use parallel workers for search and analysis." |

**Pipeline mode**

| Chip | Message | Needs |
| --- | --- | --- |
| Build a fold → score pipeline | "Create a pipeline that generates 3 protein sequences with ProtGPT2, folds each with OmegaFold, and scores their stability with FoldX." | protgpt2-svc, omegafold-svc, foldx-svc |
| Design a GFP11 brightness screen | "Build a pipeline to propose 5 GFP11 variants, fold them, and score their predicted brightness. Rank the results." | protgpt2-svc, omegafold-svc |
| Fold a single sequence | "Create a simple 1-node pipeline that takes a protein sequence as input and predicts its 3D structure using OmegaFold." | omegafold-svc |
| Generate → analyze → report | "Build a 3-step pipeline: generate candidate sequences, analyze their stability, and produce a summary report." | protgpt2-svc, foldx-svc |

To restore them, put these entries back into the arrays in `starterPrompts.ts` (the original file is in git history of the agent repo).

## 2. SynqLab agent: the GFP11 demo flow (scripted, ~2.5 minutes)

A front-end replay. Nothing runs live: the upload dialog is mock ("Drag & drop (mock)"), the analysis text and the KPI numbers are scripted.

1. **New chat** → click the chip. The user message appears; the agent shows three tool pills: *Reasoning about goal*, *Checking literature*, *Scanning tool registry*.
2. Agent: "closed-loop peptide optimisation problem…", asks for the dataset. A dashed button **Upload gfp11_brightness.xlsx**.
3. **Upload dialog** ("Upload Excel file", file preselected) → **Upload**. Tabs appear: Chat, the file, Dataset, Pipeline. The file chip reads "113 rows · 18 KB"; a quality check passes ("Open full report").
4. Agent pills: *Analysing data distribution*, *Selecting architecture*, *Configuring VAE layers*. Key observations: 4 mutational neighbourhoods, bimodal brightness (61% dark, 39% bright), replicates agree (Pearson r = 0.94), median length 16 aa. Model choice: a variational autoencoder, with reasons.
5. **Recommended pipeline** card: 6 nodes, 3 rounds, closed loop: Brightness VAE → AlphaFold-Multimer → Stability Gate → Interaction Gate → Ranker → Model Update. Button **Approve & build**.
6. The run page **GFP11 Brightness Redesign** ("3 rounds · 50 candidates each"): **Start run** → pipeline nodes light up, an agent execution log streams (Model Agent, Brightness Worker, Ranker, Learning Worker, Artifact Agent), a progress bar for Round 1/3 → 3/3 (about 60 s), KPI cards (best brightness, hit rate, cost saved, candidates, wet-lab picks, model R²), a candidate funnel (Generated → Folded → Stable → Binding+ → Top picks), round-over-round improvement bars, a 3D viewer, and a round report.
7. Scripted values worth knowing: top candidate predicted 1.42× (round 1), 1.63× (round 2), 1.87× (round 3); model R² 0.71 → 0.76 → 0.81 → 0.84.

Say "demo data" on screen when this is shown publicly.

## 3. Aria chat: scenario prompts per family

Lab → Aria → Use models. Each family has 12 recorded requests; the chat offers the first 6 as chips and matches free text to the nearest one.
Free-text examples that work: "a 105 residue protein with net charge +7", "104 aa, stable", "soluble, low aggregation, charge +11".
Each prompt below is the exact specification the model was evaluated on.


### PF00237 · uL22 (Large ribosomal subunit protein uL22)

| # | Chip label | Specification |
| --- | --- | --- |
| 1 | moderate hydrophobicity · unstable | Hydrophobicity: moderate; Stability: unstable; Structural confidence: high; Signal peptide: no; Molecular function: rRNA binding |
| 2 | 185 aa · charge +28 | Length: 185 residues; Net charge at pH 7.4: +28; Cysteine count: 5; Structural confidence: high; Signal peptide: no; Domain: PF00237; Molecular function: structural constituent of ribosome; Organism: Maconellicoccus hirsutus (Pink hibiscus mealybug) |
| 3 | 156 aa · moderate hydrophobicity · low aggregation · stable | Length: 156 residues; Hydrophobicity: moderate; Stability: stable; Aggregation propensity: low; Structural confidence: high; Transmembrane helix: no |
| 4 | 185 aa · high aggregation | Length: 185 residues; Aggregation propensity: high; Cysteine count: 0; Transmembrane helix: no; Molecular function: rRNA binding; Organism: Caldivirga maquilingensis (strain ATCC 700844 / DSM 13496 / JCM 10307 / IC-167) |
| 5 | low hydrophobicity | Hydrophobicity: low; Cysteine count: 1; Structural confidence: high; Transmembrane helix: no; Signal peptide: no; Molecular function: rRNA binding; Organism: Pyrococcus horikoshii (strain ATCC 700860 / DSM 12428 / JCM 9974 / NBRC 100139 / OT-3) |
| 6 | 170 aa · charge +18 · low hydrophobicity | Length: 170 residues; Net charge at pH 7.4: +18; Hydrophobicity: low; Structural confidence: high; Transmembrane helix: no; Domain: PF00237; Molecular function: structural constituent of ribosome; Organism: Hordeum vulgare (Barley) |
| 7 | 174 aa · charge +21 · moderate aggregation · stable | Length: 174 residues; Net charge at pH 7.4: +21; Stability: stable; Aggregation propensity: moderate; Structural confidence: high; Transmembrane helix: no; Signal peptide: no; Domain: PF00237 |
| 8 | 186 aa · low hydrophobicity · low aggregation · unstable | Length: 186 residues; Hydrophobicity: low; Stability: unstable; Aggregation propensity: low; Cysteine count: 6; Structural confidence: high; Transmembrane helix: no; Molecular function: structural constituent of ribosome; Organism: Aedes aegypti (Yellowfever mosquito) (Culex aegypti) |
| 9 | 188 aa · charge +22 · unstable | Length: 188 residues; Net charge at pH 7.4: +22; Stability: unstable; Cysteine count: 6; Structural confidence: moderate; Transmembrane helix: no; Signal peptide: no; Domain: PF00237; Molecular function: structural constituent of ribosome |
| 10 | 185 aa | Length: 185 residues; Cysteine count: 0; Structural confidence: high; Signal peptide: no; Domain: PF00237 |
| 11 | charge +17 · unstable | Net charge at pH 7.4: +17; Stability: unstable; Cysteine count: 0; Structural confidence: high; Signal peptide: no; Molecular function: structural constituent of ribosome |
| 12 | charge +15 · low aggregation · stable | Net charge at pH 7.4: +15; Stability: stable; Aggregation propensity: low; Cysteine count: 1; Transmembrane helix: no; Signal peptide: no; Molecular function: rRNA binding; Organism: Sulfurisphaera tokodaii (strain DSM 16993 / JCM 10545 / NBRC 100140 / 7) (Sulfolobus tokodaii) |

### PF00467 · uL24 (Large ribosomal subunit protein uL24)

| # | Chip label | Specification |
| --- | --- | --- |
| 1 | 105 aa · low aggregation · stable | Length: 105 residues; Stability: stable; Aggregation propensity: low; Cysteine count: 0; Transmembrane helix: no; Signal peptide: no; Molecular function: rRNA binding |
| 2 | 104 aa · stable | Length: 104 residues; Stability: stable; Structural confidence: high; Domain: PF00467; Molecular function: rRNA binding |
| 3 | 103 aa · moderate hydrophobicity · low aggregation | Length: 103 residues; Hydrophobicity: moderate; Aggregation propensity: low; Structural confidence: high; Domain: PF00467; Molecular function: rRNA binding |
| 4 | charge +8 · stable | Net charge at pH 7.4: +8; Stability: stable; Transmembrane helix: no; Signal peptide: no; Molecular function: rRNA binding |
| 5 | charge +11 · low aggregation | Net charge at pH 7.4: +11; Aggregation propensity: low; Cysteine count: 1; Transmembrane helix: no; Domain: PF00467; Molecular function: rRNA binding |
| 6 | charge +8 · low hydrophobicity · low aggregation | Net charge at pH 7.4: +8; Hydrophobicity: low; Aggregation propensity: low; Cysteine count: 0; Transmembrane helix: no; Molecular function: rRNA binding |
| 7 | 104 aa · charge +12 · moderate hydrophobicity · low aggregation | Length: 104 residues; Net charge at pH 7.4: +12; Hydrophobicity: moderate; Stability: unstable; Aggregation propensity: low; Signal peptide: no; Domain: PF00467 |
| 8 | low aggregation · stable | Stability: stable; Aggregation propensity: low; Structural confidence: high; Transmembrane helix: no; Domain: PF00467; Organism: Geobacillus sp. (strain WCH70) |
| 9 | moderate hydrophobicity · low aggregation · stable | Hydrophobicity: moderate; Stability: stable; Aggregation propensity: low; Structural confidence: high; Transmembrane helix: no; Signal peptide: no; Molecular function: rRNA binding; Organism: Polaromonas sp. (strain JS666 / ATCC BAA-500) |
| 10 | 106 aa · stable | Length: 106 residues; Stability: stable; Transmembrane helix: no; Signal peptide: no |
| 11 | 101 aa · low aggregation · stable | Length: 101 residues; Stability: stable; Aggregation propensity: low; Signal peptide: no; Domain: PF00467; Molecular function: rRNA binding |
| 12 | 104 aa · low aggregation · stable | Length: 104 residues; Stability: stable; Aggregation propensity: low; Cysteine count: 0; Transmembrane helix: no; Signal peptide: no; Domain: PF00467; Organism: Chromobacterium violaceum (strain ATCC 12472 / DSM 30191 / JCM 1249 / CCUG 213 / NBRC 12614 / NCIMB 9131 / NCTC 9757 / MK) |

### PF03652 · YqgF (putative pre-16S rRNA nuclease)

| # | Chip label | Specification |
| --- | --- | --- |
| 1 | 170 aa · charge +1 · moderate hydrophobicity | Length: 170 residues; Net charge at pH 7.4: +1; Hydrophobicity: moderate; Structural confidence: moderate; Transmembrane helix: no; Signal peptide: no; Domain: PF03652; Enzyme class: EC 3.1; Organism: Mycobacterium ulcerans (strain Agy99) |
| 2 | 169 aa · charge +0 · unstable | Length: 169 residues; Net charge at pH 7.4: +0; Stability: unstable; Cysteine count: 0; Transmembrane helix: no; Signal peptide: no; Domain: PF03652; Organism: Mycobacterium sp. (strain KMS) |
| 3 | charge -5 · moderate hydrophobicity · moderate aggregation | Net charge at pH 7.4: -5; Hydrophobicity: moderate; Aggregation propensity: moderate; Structural confidence: moderate; Signal peptide: no; Domain: PF03652; Enzyme class: EC 3.1; Organism: Limosilactobacillus reuteri (strain DSM 20016) (Lactobacillus reuteri) |
| 4 | 161 aa · charge +1 · low aggregation · stable | Length: 161 residues; Net charge at pH 7.4: +1; Stability: stable; Aggregation propensity: low; Cysteine count: 1; Transmembrane helix: no; Signal peptide: no; Domain: PF03652; Enzyme class: EC 3.1 |
| 5 | charge -9 · unstable | Net charge at pH 7.4: -9; Stability: unstable; Transmembrane helix: no; Domain: PF03652; Enzyme class: EC 3.1 |
| 6 | charge +1 · stable | Net charge at pH 7.4: +1; Stability: stable; Structural confidence: moderate; Signal peptide: no; Molecular function: hydrolase activity, acting on ester bonds; Organism: Mycobacterium leprae (strain Br4923) |
| 7 | 182 aa · charge -2 · low aggregation | Length: 182 residues; Net charge at pH 7.4: -2; Aggregation propensity: low; Signal peptide: no; Domain: PF03652; Molecular function: hydrolase activity, acting on ester bonds |
| 8 | 146 aa · moderate hydrophobicity · stable | Length: 146 residues; Hydrophobicity: moderate; Stability: stable; Cysteine count: 0; Structural confidence: moderate; Transmembrane helix: no; Domain: PF03652; Molecular function: hydrolase activity, acting on ester bonds |
| 9 | 143 aa · high aggregation | Length: 143 residues; Aggregation propensity: high; Cysteine count: 0; Structural confidence: moderate; Signal peptide: no; Domain: PF03652; Enzyme class: EC 3.1; Molecular function: hydrolase activity, acting on ester bonds |
| 10 | 180 aa · charge -2 · moderate hydrophobicity · low aggregation | Length: 180 residues; Net charge at pH 7.4: -2; Hydrophobicity: moderate; Stability: stable; Aggregation propensity: low; Structural confidence: moderate; Organism: Nocardia farcinica (strain IFM 10152) |
| 11 | low aggregation · unstable | Stability: unstable; Aggregation propensity: low; Cysteine count: 1; Domain: PF03652; Molecular function: hydrolase activity, acting on ester bonds |
| 12 | 138 aa · charge +1 · moderate hydrophobicity · moderate aggregation | Length: 138 residues; Net charge at pH 7.4: +1; Hydrophobicity: moderate; Aggregation propensity: moderate; Structural confidence: moderate; Signal peptide: no; Enzyme class: EC 3.1 |

uS13 (PF00416) has no chat (its per-round run is non-canonical). Source: `synqlab/seed/aria_chat/index.json`, built by `scripts/aria_demo/build_chat_data.py`.

## Aria page: "What Aria did" examples (website)
Three recorded designs shown next to the natural protein, one per tuned family. Built by `synqLab-agent/scripts/aria_demo/build_site_examples.py` from the product seed (`aria_chat/index.json`), output `website/src/ariaExamples.json`. Names: Aria uL22-1 (PF00237-00, round 1), Aria uL24-1 (PF00467-07, round 3), Aria YqgF-1 (PF03652-07, round 1). All pass the request gate, quality filters and the domain check; identity is to the natural reference shown.
Wording rule: "recorded Aria output, designed and checked on the computer" until any design is lab-tested. Humalog is an analogy (a human-designed change), never presented as Aria's work.
Video hook for the Aria script: open with the Humalog idea (two amino acids swapped, same job, faster), then cut to one natural-vs-Aria card.
