# Datasets — Antibody / Nanobody

Datasets for V4 (nanobody / VHH generator + optimizer). Index: [README.md](README.md).

---

## OAS (Observed Antibody Space) — V4 pretraining

- **What it contains:** immune-repertoire antibody sequences (heavy/light chains, incl. VHH), from many sequencing studies.
- **Size:** >1B sequences.
- **Format:** CSV per data unit.
- **Key fields Aria uses:** sequence, chain type, germline (V/J), species; filter to VHH / heavy-chain-only for nanobodies.
- **Aria use:** large-scale SFT pretraining for realistic CDR distributions.
- **Caveat:** sequences only (no structure, no antigen) — pair with SAbDab for structural grounding.
- **Access:** free, [opig OAS](https://opig.stats.ox.ac.uk/webapps/oas/).

---

## SAbDab — antibody–antigen structures

- **What it contains:** structural antibody database with antigen complexes and CDR annotations.
- **Size:** ~10.8k structures.
- **Format:** PDB + TSV.
- **Key fields Aria uses:** CDR sequences/lengths, antigen, germline, structure.
- **Aria use:** structural grounding + held-out evaluation set.
- **Access:** free, [opig SAbDab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/SAbDab/).

---

## SAbDab-nano — VHH / nanobody subset

- **What it contains:** the nanobody (single-domain, VHH) subset of SAbDab.
- **Size:** subset of SAbDab (filter `vh_call` starts with `VH`).
- **Format:** PDB + TSV.
- **Aria use:** nanobody-specific training/eval — the core V4 target modality.
- **Access:** same as SAbDab with the VHH filter.

---

## CoV-AbDab — COVID antibodies

- **What it contains:** coronavirus-binding antibodies/nanobodies with metadata.
- **Size:** thousands of entries.
- **Format:** CSV.
- **Aria use:** therapeutic-context filtering and a focused evaluation domain.
- **Access:** free, [opig CoV-AbDab](https://opig.stats.ox.ac.uk/webapps/covabdab/).

---

## Thera-SAbDab — therapeutic antibodies

- **What it contains:** clinical-stage / approved therapeutic antibodies.
- **Size:** hundreds of entries.
- **Format:** CSV.
- **Aria use:** therapeutic-relevance reference and developability grounding.
- **Access:** free, [opig Thera-SAbDab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/TheraSAbDab).
