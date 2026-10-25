# Shared — Scoring & Analysis Tools

Common scoring, structure-prediction, feature-extraction, and clustering tools used across SynqLab agents. Phase docs reference a tool by its **ID** here (e.g. "score with `ESMFold`") instead of redefining it.

> These are *orchestrator-invoked* tools, not part of the generative model. The agent generates raw sequences/molecules; the SynqLab Agent runs these to score them. See [`../examples.md`](../examples.md) for the agent-vs-orchestrator boundary.

---

## Structure prediction

| ID | What it outputs | When to use | URL |
| -- | --------------- | ----------- | --- |
| **ESMFold** | Single-chain structure + per-residue pLDDT | Fast confidence proxy for a generated monomer/peptide | [facebookresearch/esm](https://github.com/facebookresearch/esm) |
| **Boltz-1** | Complex structure + ipTM, interface pAE | Peptide–target / PPI complex scoring | [jwohlwend/boltz](https://github.com/jwohlwend/boltz) |
| **Chai-1** | Complex structure + ipTM (open AF3 alternative) | Complex scoring; cross-check vs Boltz-1 | [chaidiscovery/chai-lab](https://github.com/chaidiscovery/chai-lab) |
| AlphaFold2-Multimer | Complex + ipTM | Reference-grade complex scoring (slower) | [google-deepmind/alphafold](https://github.com/google-deepmind/alphafold) |
| AlphaFold3 | Best complex accuracy; API only, non-commercial | Milestone validation only | [alphafoldserver.com](https://alphafoldserver.com/) |
| OmegaFold | Fast single-chain fold | ESMFold alternative | [HeliXonProtein/OmegaFold](https://github.com/HeliXonProtein/OmegaFold) |

**Default scoring ladder:** ESMFold (cheap, every candidate) → Boltz-1 or Chai-1 (complex, top candidates only) → AlphaFold3 (milestone confirmation only).

---

## Interface analysis

| ID | What it computes | URL |
| -- | ---------------- | --- |
| **PLIP** | Interface contacts, H-bonds, hydrophobic/salt-bridge interactions | [pharmai/plip](https://github.com/pharmai/plip) |
| **BioPython Structure** | Interface residue extraction from PDB/mmCIF | [Biopython structural FAQ](https://biopython.org/wiki/The_Biopython_Structural_Bioinformatics_FAQ) |
| FreeSASA | Solvent-accessible surface area | [freesasa.github.io](https://freesasa.github.io/) |
| DSSP | Secondary structure + solvent accessibility from a structure | [PDB-REDO/dssp](https://github.com/PDB-REDO/dssp) |

---

## Sequence feature calculation

| ID | Exact features it produces | URL |
| -- | -------------------------- | --- |
| **Biopython `ProtParam`** | length, MW, net charge at pH, isoelectric point (pI), GRAVY hydrophobicity, instability index, aromaticity | [ProtParam API](https://biopython.org/docs/1.75/api/Bio.SeqUtils.ProtParam.html) |
| iFeature | Extended descriptors (AAC, CTD, composition-transition-distribution) | [Superzchen/iFeature](https://github.com/Superzchen/iFeature) |
| IUPred3 | Per-residue intrinsic disorder fraction | [iupred.elte.hu](https://iupred.elte.hu/) |
| DeepTMHMM | Transmembrane helix count/topology | [dtu.biolib.com/DeepTMHMM](https://dtu.biolib.com/DeepTMHMM) |
| SignalP 6.0 | Signal-peptide presence + cleavage site | [SignalP-6.0](https://services.healthtech.dtu.dk/services/SignalP-6.0/) |
| PSIPRED | Secondary-structure fractions (helix/sheet/coil) | [psipred](http://bioinf.cs.ucl.ac.uk/psipred/) |

---

## Developability (peptides / proteins)

| ID | What it computes | URL |
| -- | ---------------- | --- |
| Biopython `ProtParam` | charge, pI, GRAVY, instability (fast first pass) | see above |
| peptidy | Peptide-specific property calculator | [enriquea/peptidy](https://github.com/enriquea/peptidy) |
| aggrescan3D | Aggregation propensity from structure | [A3D2](https://biocomp.chem.uw.edu.pl/A3D2/) |
| CamSol | Solubility prediction | [camsol](https://www.prottrans.de/camsol) |

---

## Clustering, novelty & dedup

| ID | Use | URL |
| -- | --- | --- |
| **MMseqs2** | (1) cluster sequences for leakage-free train/test split; (2) novelty = max % identity of a generated sequence vs a reference set | [soedinglab/MMseqs2](https://github.com/soedinglab/MMseqs2) |
| CD-HIT | Alternative clustering | [weizhongli/cdhit](https://github.com/weizhongli/cdhit) |

**Standard usage conventions:**
- **Train/test split:** cluster at **30% identity** (`mmseqs easy-cluster --min-seq-id 0.3`), assign whole clusters to train or test → no near-duplicate leakage.
- **Novelty flag:** a candidate **passes** novelty if its max identity to the training/reference set is **< 80%** (`< 70%` for the stricter V1 target).

---

## Small-molecule tools (Phoenix and molecule-generating agents)

| ID | What it computes | URL |
| -- | ---------------- | --- |
| **RDKit** | MW, logP, QED, Lipinski rules, validity, Tanimoto similarity | [rdkit.org](https://www.rdkit.org/) |
| **AutoDock Vina** | Docking score vs a target pocket | [vina](https://github.com/ccsb-scripps/AutoDock-Vina) |
| ChEMBL search | Prior-art / known-compound novelty check | [ebi.ac.uk/chembl](https://www.ebi.ac.uk/chembl/) |

---

## Antibody-specific tools (Aria V4 and future antibody agents)

| ID | Use | URL |
| -- | --- | --- |
| **ANARCI** | Antibody numbering + CDR annotation | [oxpig/ANARCI](https://github.com/oxpig/ANARCI) |
| **IgFold** | Fast antibody/VHH structure prediction | [Graylab/IgFold](https://github.com/Graylab/IgFold) |
| NanoBodyBuilder2 | Nanobody structure prediction | [brennanaba/ImmuneBuilder](https://github.com/brennanaba/ImmuneBuilder) |
| AbLang2 | Antibody language model (humanness/likelihood) | [oxpig/AbLang2](https://github.com/oxpig/AbLang2) |
| AntiFold | Inverse folding for antibodies | [oxpig/AntiFold](https://github.com/oxpig/AntiFold) |
