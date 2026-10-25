# Datasets — Peptide Binder

Datasets for V2 (target-conditioned peptide SFT) and V3 (DPO loop). Index: [README.md](README.md).

---

## PepBDB — primary V2/V3 source

- **What it contains:** curated peptide–protein binding complexes derived from the PDB, with interface annotations.
- **Size:** ~13.3k complexes.
- **Format:** PDB structures + annotation tables.
- **Key fields Aria uses:** peptide sequence, target (receptor) sequence, binding-site residues, interface contacts.
- **Aria use:** primary training data for target-conditioned binder generation.
- **Split:** cluster by **target family** so held-out targets are unseen.
- **Access:** free, [huanglab pepbdb](http://huanglab.phys.hust.edu.cn/pepbdb/).

---

## BioLiP2 — binding-site / interaction data

- **What it contains:** biologically relevant ligand–protein interactions (incl. peptide ligands) with binding-site annotations.
- **Size:** >1M interactions.
- **Format:** TSV + PDB.
- **Aria use:** augment PepBDB with additional peptide-ligand examples and binding-site labels.
- **Access:** free, [BioLiP](https://zhanggroup.org/BioLiP/).

---

## DIPS / DIPS-Plus — protein–protein interfaces

- **What it contains:** mined protein–protein interface pairs from the PDB.
- **Size:** ~42k interfaces.
- **Format:** HDF5 / PDB.
- **Aria use:** broaden interface learning beyond short peptides (PPI-style binders).
- **Access:** free, [drorlab/DIPS](https://github.com/drorlab/DIPS).

---

## SKEMPI 2.0 — affinity changes (eval)

- **What it contains:** experimentally measured binding-affinity changes (ΔΔG) for protein–protein interface mutations.
- **Size:** 7,085 mutations.
- **Format:** CSV + PDB.
- **Aria use:** **held-out evaluation** — does the scoring pipeline / model track real affinity changes? Not used for training.
- **Access:** free, [life.bsc.es/pid/skempi2](https://life.bsc.es/pid/skempi2/).

---

## PDBBind — protein–ligand affinities (secondary)

- **What it contains:** protein–ligand complexes with measured binding affinities (mostly small molecules).
- **Size:** ~23k complexes.
- **Format:** PDB + CSV.
- **Aria use:** secondary; mainly relevant to Phoenix (small molecules), occasional peptide-ligand cases.
- **Access:** free (registration), [pdbbind.org.cn](https://www.pdbbind.org.cn/).

---

## BindingDB — affinity measurements (secondary)

- **What it contains:** measured binding affinities (Ki, Kd, IC50) for target–ligand pairs.
- **Size:** ~2.9M measurements.
- **Format:** TSV.
- **Aria use:** secondary reference for target–ligand affinity context.
- **Access:** free, [bindingdb.org](https://www.bindingdb.org/).
