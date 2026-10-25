# SynqLab — Sample Scenarios

Concrete walkthroughs of how the SynqLab Agent decomposes a user goal and routes it to specialist agents, tools, and compute. Each scenario shows the **plan**, the **actors used**, and the **output**.

> Legend — **Agent** = specialist agent (reasons, multi-step) · **Tool** = single-step function · **Compute** = job on the compute layer.

---

## Scenario 1 — Design a peptide binder for a target

**User goal:** "Design peptide binders for the EGFR kinase domain."

| Step | Actor | Type | What happens |
|------|-------|------|--------------|
| 1 | Edison / Crow | Agent | Pull literature on known EGFR binders + interface residues |
| 2 | UniProt + PDB search | Tool | Fetch target sequence and reference structures |
| 3 | Aria | Agent | Generate N candidate peptide sequences, grounded in literature context |
| 4 | ESMFold → Chai-1 | Tool | Fold candidates, then predict target–peptide complex (ipTM, interface pAE) |
| 5 | FoldX + Biopython | Tool | Stability (ΔΔG) + developability (charge, solubility, aggregation) |
| 6 | MMseqs2 + BLAST | Tool | Novelty / prior-art check against public + patent databases |
| 7 | SynqLab Agent | — | Rank candidates, select top-K, write to Knowledge Store |
| 8 | Falcon | Agent | Generate a candidate report with citations |

**Output:** Ranked peptide candidates with scores, novelty flags, and a cited report. Every candidate carries full lineage (prompt → model → scores).

---

## Scenario 2 — Prior-art / "what is known" check

**User goal:** "Is there prior art for this sequence, and what's known about this target?"

| Step | Actor | Type | What happens |
|------|-------|------|--------------|
| 1 | Edison / Crow | Agent | Literature search across PubMed, bioRxiv, patents |
| 2 | Owl | Agent | Direct scientific Q&A with citations |
| 3 | BLAST | Tool | Similarity search vs USPTO patented sequences |
| 4 | MMseqs2 | Tool | Similarity vs UniProt / PDB |
| 5 | SynqLab Agent | — | Produce `novelty_score`, `closest_prior_art`, `freedom_to_operate_flag` |

**Output:** Novelty report + freedom-to-operate signal, traced and timestamped for IP records.

---

## Scenario 3 — Small-molecule design

**User goal:** "Propose small molecules that inhibit this target."

| Step | Actor | Type | What happens |
|------|-------|------|--------------|
| 1 | Edison / Crow | Agent | Gather known inhibitors + SAR context |
| 2 | Phoenix (SmileyLlama) | Agent | Generate SMILES candidates conditioned on property goals |
| 3 | RDKit | Tool | Compute molecular properties (MW, logP, QED, Lipinski) |
| 4 | AutoDock Vina | Tool | Dock candidates against target structure |
| 5 | ChEMBL / PubChem search | Tool | Bioactivity + known-compound lookup |
| 6 | SynqLab Agent | — | Rank, filter, store top candidates |

**Output:** Ranked SMILES candidates with docking scores and property profiles.

---

## Scenario 4 — Interpret experimental data

**User goal:** "Here's my flow-cytometry CSV — what does it show?"

| Step | Actor | Type | What happens |
|------|-------|------|--------------|
| 1 | SynqLab Agent | — | Ingest uploaded CSV, detect data type |
| 2 | Finch | Agent | Statistical analysis + interpretation |
| 3 | Plot generator | Tool | Generate charts (dose-response, distributions) |
| 4 | SynqLab Agent | — | Summarize findings, suggest follow-up experiments |

**Output:** Analysis summary, figures, and suggested next experiments — written to project memory.

---

## Scenario 5 — Closed-loop wet-lab iteration (roadmap)

**User goal:** "Advance my top candidates to the lab and improve the model from results."

| Step | Actor | Type | What happens |
|------|-------|------|--------------|
| 1 | SynqLab Agent | — | Select candidates from Knowledge Store; request human approval (cost) |
| 2 | Lab Agent | Agent | Order synthesis (Twist/GenScript), track vendor, assign sample IDs |
| 3 | Lab Agent | Agent | Submit assay (Emerald/Strateos), ingest results |
| 4 | SynqLab Agent | — | Flag active vs inactive candidates |
| 5 | Aria | Agent | DPO update: strong results = chosen, weak = rejected |
| 6 | Aria | Agent | Generate improved candidates → loop repeats |

**Output:** Wet-lab-validated candidates + an improved Aria model. The full loop is versioned and auditable.

---

## What every scenario shares

1. **Plan → approve → trace** — every action is logged as an audit record with inputs, outputs, versions, and a content hash.
2. **Knowledge Store as the hub** — all agents read from and write to it; it bridges in-silico and in-vitro.
3. **Budget awareness** — expensive steps (compute jobs, lab orders) estimate cost and may require approval.
4. **Grounding** — generation steps (Aria, Phoenix) are enriched with literature/graph context before producing candidates.

---

## Related Docs

| Doc | Link |
|---|---|
| Platform architecture | [`synqlab-architecture.md`](synqlab-architecture.md) |
| Agent pool overview | [`agents/README.md`](agents/README.md) |
| Aria agent spec | [`agents/aria/aria.md`](agents/aria/aria.md) |
| Visual diagram | [`../design-docs/synqlab-platform.drawio`](../design-docs/synqlab-platform.drawio) |
