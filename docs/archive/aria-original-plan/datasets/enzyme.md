# Datasets — Enzyme / Functional Protein

Datasets for V5 (EC-conditioned enzyme generator). Index: [README.md](README.md).

---

## Swiss-Prot enzyme subset — V5 SFT base

- **What it contains:** reviewed proteins carrying an EC number (enzymes), with substrate/cofactor/organism annotations.
- **Size:** ~200k+ enzyme entries.
- **Format:** FASTA + TSV.
- **Key fields Aria uses:** sequence, EC class, catalytic activity, cofactor, organism.
- **Aria use:** SFT base for EC-conditioned generation.
- **Selection:** `reviewed:true AND ec:*`.
- **Access:** free, [uniprot enzyme query](https://www.uniprot.org/uniprotkb?query=reviewed:true+AND+ec:*).

---

## BRENDA — enzyme function & kinetics

- **What it contains:** comprehensive enzyme functional data — EC classification, substrates, products, kinetic parameters (Km, kcat), organism.
- **Size:** millions of annotations.
- **Format:** database download / SOAP API.
- **Aria use:** rich functional conditioning (substrate, cofactor, kinetics) beyond what Swiss-Prot stores.
- **Access:** free for academic, [brenda-enzymes.org](https://www.brenda-enzymes.org/).

---

## Rhea — biochemical reactions

- **What it contains:** curated, balanced biochemical reactions linked to EC numbers and ChEBI molecules.
- **Size:** ~15k reactions.
- **Format:** TSV / RDF.
- **Aria use:** cleaner reaction-level prompts (reaction → EC) than free-text BRENDA annotations.
- **Access:** free, [rhea-db.org](https://www.rhea-db.org/).

---

## ProteinGym — variant fitness (preference + eval)

- **What it contains:** deep mutational scanning datasets with measured variant fitness/activity.
- **Size:** ~2.7M variants.
- **Format:** CSV.
- **Aria use:** preference signal for V5 tuning and held-out fitness evaluation.
- **Caveat:** computational fitness proxies are weak for catalysis — V5 needs wet-lab confirmation (see [phase-5-enzyme](../training/phase-5-enzyme.md)).
- **Access:** free, [proteingym.org](https://proteingym.org/).
