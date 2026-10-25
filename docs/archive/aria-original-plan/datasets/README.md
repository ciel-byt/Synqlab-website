# Aria — Datasets

Spec sheet for every dataset Aria uses, organized by category. Parent: [`../aria.md`](../aria.md).

> Each phase doc lists the *exact selection* it applies (e.g. "Swiss-Prot `reviewed:true` only"). This folder is the **full reference**: what each dataset contains, how big it is, its format, and which phase consumes it.

---

## Master stats table

| Dataset | Category | What it is | Size | Format | Used by |
| ------- | -------- | ---------- | ---- | ------ | ------- |
| Swiss-Prot | General protein | Reviewed, curated proteins | ~574k entries | FASTA + TSV/JSON | V0, V1, V5 |
| TrEMBL | General protein | Unreviewed proteins | ~250M+ entries | FASTA + TSV | V1 scale-up (optional) |
| AlphaFold DB | General protein | Predicted structures + pLDDT | ~214M+ structures | mmCIF / pLDDT JSON | V0, V1 (pLDDT feature) |
| Pfam (InterPro) | General protein | Protein domain families | ~20k families | TSV / HMM | V0, V1 (domain feature) |
| InterPro | General protein | Integrated domain/function | ~40k entries | TSV / XML | V0, V1 |
| PDB | General protein | Experimental structures | ~220k structures | PDB / mmCIF / FASTA | V2 (complexes) |
| PepBDB | Peptide binder | Peptide–protein complexes | ~13.3k complexes | PDB + annotations | V2, V3 |
| BioLiP2 | Peptide binder | Biologically relevant interactions | >1M interactions | TSV + PDB | V2 |
| DIPS / DIPS-Plus | Peptide binder | Protein–protein interfaces | ~42k interfaces | HDF5 / PDB | V2/V3 (PPI) |
| SKEMPI 2.0 | Peptide binder | PPI mutations with ΔΔG | 7,085 mutations | CSV + PDB | V3 eval |
| PDBBind | Peptide binder | Protein–ligand complexes | ~23k complexes | PDB + CSV | secondary |
| BindingDB | Peptide binder | Binding affinity measurements | ~2.9M measurements | TSV | secondary |
| OAS | Antibody | Observed antibody repertoires | >1B sequences | CSV per unit | V4 |
| SAbDab | Antibody | Antibody–antigen structures | ~10.8k structures | PDB + TSV | V4 |
| SAbDab-nano | Antibody | VHH/nanobody subset | subset of SAbDab | PDB + TSV | V4 |
| CoV-AbDab | Antibody | COVID antibodies | thousands | CSV | V4 filtering |
| Thera-SAbDab | Antibody | Therapeutic antibodies | hundreds | CSV | V4 relevance |
| Swiss-Prot enzymes | Enzyme | EC-annotated enzymes | ~200k+ entries | FASTA + TSV | V5 |
| BRENDA | Enzyme | Enzyme function/kinetics | millions of annotations | DB / download | V5 |
| Rhea | Enzyme | Biochemical reactions | ~15k reactions | TSV / RDF | V5 |
| ProteinGym | Enzyme / general | Variant fitness scores | ~2.7M variants | CSV | V1, V5 eval |

> Sizes are approximate and drift over time — verify against the source before an ingestion run.

---

## Category specs

| Category | File | Datasets |
| -------- | ---- | -------- |
| General protein | [general-protein.md](general-protein.md) | Swiss-Prot, TrEMBL, AlphaFold DB, Pfam, InterPro, PDB, ProteinGym |
| Peptide binder | [peptide-binder.md](peptide-binder.md) | PepBDB, BioLiP2, DIPS, SKEMPI 2.0, PDBBind, BindingDB |
| Antibody / nanobody | [antibody.md](antibody.md) | OAS, SAbDab, SAbDab-nano, CoV-AbDab, Thera-SAbDab |
| Enzyme / functional | [enzyme.md](enzyme.md) | Swiss-Prot enzymes, BRENDA, Rhea, ProteinGym |

---

## Conventions

- **Reviewed-first:** prefer curated (Swiss-Prot) over bulk (TrEMBL) so feature labels are reliable. Scale up to unreviewed only with extra filtering.
- **Leakage-free splits:** cluster with MMseqs2 before splitting (sequence clusters for general; *target-family* clusters for binders). See [`../../_shared/scoring-tools.md`](../../_shared/scoring-tools.md).
- **Held-out eval sets** (SKEMPI, PepBDB held-out, SAbDab held-out, ProteinGym) are never used in training — see each phase's benchmark section.
