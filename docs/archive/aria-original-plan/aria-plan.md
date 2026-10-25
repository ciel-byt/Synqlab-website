# Aria — Biological Sequence Design Agent

Version: 0.2-draft
Date: 2026-05-30
Status: Pre-implementation design doc (parent index)

> **This is the parent doc.** It defines what Aria is, its scope, and its version roadmap. Per-version implementation detail (datasets, features, prior work, benchmarks, publishing) lives in [`training/`](training/README.md). Framework/tool/method detail common to all agents lives in [`../_shared/`](../_shared/).

---

## What Aria Is

Aria is a SynqLab specialist agent that **generates biological sequences from natural-language property prompts**. It is the protein/peptide analogue of Phoenix (SmileyLlama for small molecules).

Aria's job is narrow and well-defined:

```
Property prompt (text)
   ↓
Aria  (instruction-tuned LLM, fine-tuned on biological sequences)
   ↓
Raw candidate amino-acid sequences
```

Everything after generation — folding, docking, developability scoring, ranking, novelty checks, storing, and the DPO feedback signal — is done by the **SynqLab Agent (orchestrator)** calling shared tools. Aria does not score itself. See [`../examples.md`](../examples.md) for the explicit boundary and [`../README.md`](../README.md) for how the orchestrator composes agents.

---

## Scope & version roadmap

Each version is a self-contained training phase. Click through for full detail.

| Version | Goal | Technique | Phase doc | Status |
| ------- | ---- | --------- | --------- | ------ |
| **V0** | Data + scoring pipeline (no training) | scripts only | [phase-0-foundation](training/phase-0-foundation.md) | Planned |
| **V1** | Feature-conditioned general protein generator | SFT + LoRA | [phase-1-general-sft](training/phase-1-general-sft.md) | Planned |
| **V2** | Target-conditioned peptide binder generator | SFT from V1 | [phase-2-peptide-sft](training/phase-2-peptide-sft.md) | Planned |
| **V3** | Closed-loop peptide binder optimizer | iterative DPO | [phase-3-dpo](training/phase-3-dpo.md) | Planned |
| **V4** | Nanobody / VHH generator + optimizer | SFT + DPO | [phase-4-nanobody](training/phase-4-nanobody.md) | Future |
| **V5** | Enzyme / functional protein generator | SFT + preference tuning | [phase-5-enzyme](training/phase-5-enzyme.md) | Future |

Sequencing rationale: V1 establishes prompt-following on abundant general-protein data; V2 specializes to binders (the commercially relevant target); V3 adds the optimization loop that differentiates Aria from static generators; V4/V5 reuse the same machinery for new modalities.

---

## How Aria fits the shared agent machinery

Aria does not reinvent infrastructure. It draws from:

| Need | Shared doc |
| ---- | ---------- |
| Base model, LoRA config, hardware, lineage | [`../_shared/training-frameworks.md`](../_shared/training-frameworks.md) |
| SFT → DPO methodology, data formats, composite-score shape | [`../_shared/method-sft-dpo.md`](../_shared/method-sft-dpo.md) |
| Folding / docking / feature / clustering tools | [`../_shared/scoring-tools.md`](../_shared/scoring-tools.md) |
| Tier 1/2/3 evaluation harness | [`../_shared/evaluation-protocol.md`](../_shared/evaluation-protocol.md) |

The phase docs cite these by reference and only spell out what is **Aria- and phase-specific** (which dataset, which exact features, which competitor, which threshold).

---

## Prompt formats

Aria uses two prompt templates. Phase docs say which one applies.

### General protein (V1, V5)

```
System: You are a biological sequence designer. Generate amino acid sequences from property descriptions.

User: Generate a protein sequence with the following properties:
- Type: {protein_type}
- Length: between {min_len} and {max_len} residues
- Structural confidence: {plddt_condition}    [e.g. "high (mean pLDDT > 80)"]
- Hydrophobicity: {hydrophobicity_condition}  [e.g. "moderate, GRAVY -0.5 to 0.5"]
- Disorder: {disorder_condition}              [e.g. "low (<20% disordered)"]
- Transmembrane: {tm_condition}               [e.g. "no transmembrane helix"]
- Domain: {pfam_family}                       [e.g. "Pfam: alpha/beta hydrolase"]
- EC class: {ec}                              [e.g. "hydrolase"]
- Organism context: {organism}
```

### Peptide binder (V2, V3, basis for V4)

```
System: You are a biological sequence designer. Generate peptide sequences that bind to a given receptor.

User: Generate a peptide binder for the following target:
- Target name: {target_name}
- Target family: {target_family}
- Target sequence: {target_sequence}
- Binding site / domain: {binding_site}
- Peptide length: between {min_len} and {max_len} residues
- Net charge: {charge_condition}
- No cysteines: {no_cys}
- Preferred conformation: {conformation}  [e.g. "helical", "extended"]
- Interface contacts: high density preferred
```

---

## Compute estimate (whole roadmap)

| Phase | Hardware | Time | Notes |
| ----- | -------- | ---- | ----- |
| V0 data pipeline | CPU only | 1–3 days | feature extraction, clustering |
| V1 SFT (8B, LoRA) | 1–2× A100 80GB | 12–48 h | depends on dataset size/epochs |
| ESMFold scoring (100k seqs) | 1× GPU | 4–8 h | ~50 ms/sequence |
| Chai-1 / Boltz-1 (1k complexes) | 1× A100 | 2–6 h | ~5–10 s/complex |
| V3 DPO (one iteration) | 1–2× A100 | 6–24 h | scoring dominates, not training |
| Full V3 loop (3 iterations) | 1–2× A100 | 2–5 days | includes inter-iteration scoring |

---

## Related docs & code

| Resource | Link |
| -------- | ---- |
| Training phase index | [`training/README.md`](training/README.md) |
| Dataset specs | [`datasets/README.md`](datasets/README.md) |
| Related work | [`related-work/README.md`](related-work/README.md) |
| Worked example (Aria vs orchestrator) | [`../examples.md`](../examples.md) |
| Agent pool overview | [`../README.md`](../README.md) |
| SmileyLlama codebase (Aria's direct analogue) | `Codes/SmileyLlama/` |
| SmileyLlama code map | `Codes/SmileyLlama/docs/code-map/README.md` |
| Original Aria roadmap (brainstorming source) | `Codes/SmileyLlama/docs/code-map/protein-design-roadmap.md` |
| SynqLab platform architecture | `../../synqlab-architecture.md` |
| V1 pipeline architecture | `../../../architecture.md` |
