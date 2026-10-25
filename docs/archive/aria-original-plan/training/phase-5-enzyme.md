# Phase 5 — Enzyme / Functional Protein Generator (V5)

Parent: [`../aria.md`](../aria.md) · Prev: [phase-4-nanobody](phase-4-nanobody.md) · Next: —

Status: Future (hardest evaluation — see caveat)

---

## Objective

**EC-conditioned enzyme design** — generate functional proteins conditioned on reaction class, substrate, and cofactor.

---

## Dataset

| Dataset | Use | Exact selection | URL | Format |
| ------- | --- | --------------- | --- | ------ |
| Swiss-Prot enzyme subset | SFT base | `reviewed:true AND ec:*` (~200k entries) | [uniprot enzymes](https://www.uniprot.org/uniprotkb?query=reviewed:true+AND+ec:*) | FASTA + TSV |
| BRENDA | EC, substrate, kinetics, organism conditioning | enzyme function annotations | [brenda-enzymes](https://www.brenda-enzymes.org/) | DB / download |
| Rhea | Cleaner reaction prompts | reaction → EC mapping | [rhea-db](https://www.rhea-db.org/rhea?query=&page=0) | TSV / RDF |
| ProteinGym | Preference signal + evaluation | variant fitness datasets | [proteingym](https://proteingym.org/) | CSV |

---

## Features used

General-protein features **plus** functional conditioning:

| Feature | Source | Notes |
| ------- | ------ | ----- |
| EC class | UniProt / BRENDA | reaction class — primary conditioning |
| Substrate | BRENDA / Rhea | what it acts on |
| Cofactor | BRENDA | required cofactor |
| Organism | UniProt | biological context |
| GO terms | UniProt | functional annotation |

Prompt template: **General protein** with EC/substrate fields populated ([`../aria.md`](../aria.md#prompt-formats)).

---

## Method

| Setting | Value |
| ------- | ----- |
| Base / init | Aria V1 |
| Technique | SFT then preference tuning using **ProteinGym variant fitness scores** |

---

## Prior work & how we beat it

| Competitor | What they did | How Aria V5 does better |
| ---------- | ------------- | ----------------------- |
| [ProGen2](https://github.com/salesforce/progen) | Conditional protein LM, demonstrated enzyme generation | Aria adds fine-grained EC/substrate/cofactor prompting + fitness-based preference tuning |
| [ESM3](https://github.com/evolutionaryscale/esm) | Function-aware multimodal LM | Aria is prompt-flexible and SynqLab-integrated |
| ProtGPT2 | Unconditional | no function control at all |

---

## Benchmarks

| Tier | Metric | Threshold |
| ---- | ------ | --------- |
| 1 | valid AA, length, novelty | as V1 |
| 2 | EC-conditioned vs unconditioned output | measurable difference |
| 3 | fitness proxy on ProteinGym | report; correlation with measured fitness |

**Eval dataset:** ProteinGym (held-out variant fitness).

---

## Key challenge (honest caveat)

Computational evaluation of **catalytic activity** is far weaker than binding geometry — there is no ipTM-equivalent for "does this enzyme actually catalyze the reaction." Structure prediction confirms folding, not function.

**Consequence:** V5 will require **wet-lab validation** (via the Lab Agent) to be credible. Computational metrics alone cannot prove enzyme function.

---

## Publishing angle

**Claim:** "EC/substrate-conditioned generation with fitness-based preference tuning produces enzymes with measurable in-silico fitness proxies — pending wet-lab confirmation."

**Proof:** ProteinGym fitness correlation + (longer-term) wet-lab assay results. Frame computational results as necessary-not-sufficient.

---

## Done when

- EC-conditioned generation with measurable fitness-proxy signal
- Output measurably differs by EC class
- Wet-lab validation plan defined (Lab Agent handoff)
