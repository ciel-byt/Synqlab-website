# Phase 0 — Foundation (V0)

Parent: `[../aria.md](../aria.md)` · Prev: — · Next: [phase-1-general-sft](phase-1-general-sft.md)

---

## Objective

Prove the data pipeline and scoring pipeline work **before spending any GPU on training**. Output is data + scripts, not a model.

---

## Dataset


| Dataset                | Use                                       | Exact selection                                      | URL                                                                           | Format             |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| UniProtKB / Swiss-Prot | Primary sequence source (V1 SFT base)     | `reviewed:true` only (~574k entries); drop fragments | [uniprot.org reviewed](https://www.uniprot.org/uniprotkb?query=reviewed:true) | FASTA + TSV/JSON   |
| AlphaFold DB           | pLDDT structural-confidence feature       | join by UniProt accession; take mean pLDDT           | [alphafold.ebi.ac.uk/download](https://alphafold.ebi.ac.uk/download)          | mmCIF / pLDDT JSON |
| Pfam (via InterPro)    | Domain-family conditioning                | map accession → Pfam family string                   | [ebi.ac.uk/interpro](https://www.ebi.ac.uk/interpro/)                         | TSV / HMM          |
| PepBDB                 | Peptide source for the scoring smoke test | all ~13.3k complexes                                 | [huanglab pepbdb](http://huanglab.phys.hust.edu.cn/pepbdb/)                   | PDB + annotations  |


**Quality filter (apply in order):** canonical 20 AAs only → length 20–512 → drop fragments/uncertain → dedup exact sequences.

---

## Features used (exact, with computing tool)

All via `Biopython ProtParam` unless noted. See `[../../_shared/scoring-tools.md](../../_shared/scoring-tools.md)`.


| Feature                | Tool                            | Prompt encoding                       |
| ---------------------- | ------------------------------- | ------------------------------------- |
| Length                 | `len(seq)`                      | integer range bins                    |
| Net charge at pH 7.4   | `ProtParam.charge_at_pH(7.4)`   | rounded integer                       |
| Isoelectric point (pI) | `ProtParam.isoelectric_point()` | 0.5-unit bins                         |
| GRAVY hydrophobicity   | `ProtParam.gravy()`             | {low <-0.5, mod -0.5..0.5, high >0.5} |
| Instability index      | `ProtParam.instability_index()` | {stable <40, unstable ≥40}            |
| Aromaticity            | `ProtParam.aromaticity()`       | 0.05 bins                             |
| Disorder fraction      | IUPred3                         | {low <0.2, mod, high >0.5}            |
| Mean pLDDT             | AlphaFold DB                    | {low <50, mod, high >80}              |
| Pfam family            | InterPro lookup                 | family string                         |


---

## Prompt engineering strategy

This is where the data design decisions live — how features are selected, encoded, and assembled into prompts that will train V1.

### Core principle: randomized feature subsets

Do **not** always include all features in every prompt. Include a random 30–70% of available features per sample. This forces the model to learn to generate from *any* combination of constraints, not just a fixed schema.

```
Sample A prompt:  "length: 120–150 · charge: +2 · Pfam: kinase"
Sample B prompt:  "GRAVY: low · disorder: low · EC: hydrolase · pLDDT: high"
Sample C prompt:  "length: 80 · organism: human"
```

Same training set, same model — but the model learns to handle any subset a user might provide at inference.

### Feature tiers

Not all features are equally reliable or useful. Organize them into three tiers:

**Tier 1 — always include if available (high signal, computable from sequence)**


| Feature              | Tool                            | Encoding                                         |
| -------------------- | ------------------------------- | ------------------------------------------------ |
| Length               | `len(seq)`                      | exact integer or range (e.g. "120–150 residues") |
| Net charge at pH 7.4 | `ProtParam.charge_at_pH(7.4)`   | rounded integer (e.g. "+2")                      |
| GRAVY hydrophobicity | `ProtParam.gravy()`             | 3-bin label: `low / moderate / high`             |
| Instability index    | `ProtParam.instability_index()` | 2-bin label: `stable / unstable`                 |


These come from the sequence itself — no join needed, no missing data.

**Tier 2 — include when the join succeeds (external annotation)**


| Feature               | Source                             | Encoding                                     |
| --------------------- | ---------------------------------- | -------------------------------------------- |
| Mean pLDDT            | AlphaFold DB (joined by accession) | 3-bin label: `low / moderate / high`         |
| Pfam family           | InterPro (joined by accession)     | family string (e.g. "Protein kinase domain") |
| EC class              | Swiss-Prot annotation              | first 2 digits only (e.g. "EC 3.4")          |
| GO molecular function | Swiss-Prot annotation              | top-1 term string                            |
| Organism              | Swiss-Prot annotation              | species string (e.g. "Homo sapiens")         |


These require a successful join; if the join fails for a given sequence (e.g. no AlphaFold prediction exists), simply omit that feature from the prompt — do not impute or hallucinate it.

**Tier 3 — optional / V1+ only (expensive or noisy)**


| Feature                       | Reason to defer                           |
| ----------------------------- | ----------------------------------------- |
| Disorder fraction (IUPred3)   | external API call, adds latency           |
| Isoelectric point (pI)        | low user interpretability, keep for later |
| Aromaticity                   | low signal for prompt conditioning        |
| Secondary structure fractions | requires folding, expensive at scale      |


Include Tier 3 features only if they're cheap to compute at batch scale and add measurable conditioning signal in V1 eval. Otherwise leave for V2+.

### Should we use 3D features in the prompt?

**Short answer: no raw 3D coordinates in the prompt. Only use 3D-derived scalar summaries.**

Why:

- Raw coordinates (x/y/z per residue) are thousands of numbers — too long for a prompt, not natural language.
- Aria is an LLM, not a structure predictor. It doesn't need to "understand" geometry, just follow property targets.
- 3D tools (ESMFold, Chai-1) are used **after** generation to score the output — not as input to generation.

The one exception: **mean pLDDT** from AlphaFold DB. This is a 3D-derived feature but distilled into a single number / 3-bin label. It's a proxy for "is this protein expected to fold well?" — a useful generation target. Include it as Tier 2.

```
✅ "structural confidence: high (pLDDT > 80)"   ← ok, scalar label
❌ "coordinates: [x1,y1,z1, x2,y2,z2, ...]"    ← never
```

### Prompt format

Use natural language, not JSON or key=value. The model is an instruction-tuned LLM — it follows natural language better.

```
System:
  You are a biological sequence designer. Generate an amino acid sequence
  that satisfies the given properties.

User:
  Generate a protein sequence with the following properties:
  - Length: 120–150 residues
  - Net charge at pH 7.4: +2
  - Hydrophobicity: low (GRAVY < -0.5)
  - Stability: stable (instability index < 40)
  - Structural confidence: high (mean pLDDT > 80)
  - Domain: Protein kinase (Pfam: PF00069)

Response:
  MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ...
```

Rules:

- Only list features that are actually present for this sample (no "N/A" or placeholder lines).
- Order features consistently (length → charge → hydrophobicity → stability → structure → domain → function → organism) so the model learns the schema.
- Use human-readable bin labels (`low / moderate / high`, `stable / unstable`) not raw numbers — the goal is steerable generation, not numeric regression.
- Keep prompts under ~200 tokens. Long prompts with many features are fine; just don't pad with empty or redundant lines.

### What to validate in Phase 0

Before training starts, run these checks on the generated JSONL:


| Check                      | How                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Feature coverage           | what % of samples have each feature? (expect pLDDT ~80%, Pfam ~70%, EC ~40%)                        |
| Feature distribution       | are bins balanced or skewed? (e.g. >90% "stable" → instability is useless as a conditioning signal) |
| Prompt length distribution | histogram of token counts; flag outliers                                                            |
| Missing feature rate       | how often does a join fail per feature?                                                             |
| Label consistency          | same bin boundaries applied everywhere (no off-by-one in binning)                                   |


If any feature has >95% of samples in one bin, drop it from Tier 1/2 — it carries no useful conditioning signal.

---

No training. Build:

1. **Ingestion + join** scripts (Swiss-Prot ↔ AlphaFold pLDDT ↔ Pfam).
2. **Feature calculator** producing the table above.
3. **Cluster split** with MMseqs2 at 30% identity → leakage-free train/test (see `[../../_shared/scoring-tools.md](../../_shared/scoring-tools.md)`).
4. **Prompt/sequence JSONL generator** — randomized 30–70% feature subset per sample (format per `[../../_shared/method-sft-dpo.md](../../_shared/method-sft-dpo.md)`).
5. **Scoring scripts**: sequence validity, ESMFold pLDDT, solubility/disorder proxies.

---

## Prior work & how we beat it

V0 is infrastructure, so "prior work" = how others built their data pipelines.


| Prior approach                 | What they did                                | Our edge                                                                       |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| ProtGPT2 / ProGen2 data prep   | Raw sequences, minimal conditioning metadata | We attach structured, computed feature labels → enables conditioned generation |
| Manual random train/test split | Random shuffle, ignores homology             | MMseqs2 cluster split → no homology leakage, honest eval from day one          |


---

## Benchmarks (this phase = pipeline health, not model quality)


| Check                                 | Threshold                       |
| ------------------------------------- | ------------------------------- |
| Clean prompt/sequence pairs produced  | 100k–500k                       |
| Scoring pipeline returns valid scores | 100% of 1000-sequence smoke set |
| Train/test split                      | zero cross-cluster leakage      |
| Feature coverage report               | produced for all features       |


---

## Publishing angle

Not a publishable result on its own. It produces the **reproducible dataset + feature schema** that every later Aria paper cites as its data section.

---

## Done when

- 100k–500k clean prompt/sequence pairs written as SFT JSONL
- Feature coverage report generated
- Scoring scripts return valid scores for all 1000 smoke-test sequences
- Cluster-based train/test split committed (no leakage)

