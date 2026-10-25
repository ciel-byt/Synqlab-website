# Agent Examples — Worked Walkthroughs

One concrete example per specialist agent, showing what it receives, what it does, and what it returns. These are illustrative samples, not exhaustive specs.

> **Important — agent vs orchestrator boundary:**
> Specialist agents do one focused thing. The **SynqLab Agent (orchestrator)** coordinates everything around them — calling tools, ranking results, writing to the Knowledge Store, and feeding results back. Where the orchestrator's role is significant, it is shown explicitly.

> For full agent specs see individual agent docs. For composed multi-agent workflows see [`../scenarios.md`](../scenarios.md).

---

## Aria — Biological Sequence Design

**User goal:** "Design short peptide binders for the CDR1 loop of EGFR."

**What Aria does (its actual scope):** generates amino-acid sequences from a structured prompt. That's it. The scoring, ranking, and DPO loop are orchestrated externally.

**Full flow — showing who does what:**

```
SynqLab Agent
  → calls Edison to retrieve known EGFR binders + interface residues
  → builds enriched prompt from literature context
  → calls Aria with:
        goal: "peptide binder for EGFR CDR1"
        target_context: UniProt P00533 + interface residues
        constraints: length 8–15 aa, soluble, no cysteines
  ↓
Aria (fine-tuned LLM)
  → parses prompt into condition vector
  → generates 50 candidate sequences
  → returns raw sequences
  ↓
SynqLab Agent (takes over)
  → calls ESMFold tool  → pLDDT per candidate
  → calls Chai-1 tool   → ipTM (peptide–EGFR complex)
  → calls FoldX tool    → ΔΔG (stability)
  → calls MMseqs2 tool  → novelty check vs UniProt
  → ranks candidates by composite score
  → writes top-K to Knowledge Store
  → feeds high/low score pairs back to Aria for DPO training
```

**What Aria specifically returns:**
```
sequences: ["WYHIVDLQK", "FKLTVEQWY", ...]   # raw, unscored
model_version: aria_v0.2.1
prompt_id: p_042
```

**What the orchestrator adds before storing:**
```
candidates:
  - sequence: WYHIVDLQK   pLDDT: 84.2  ipTM: 0.71  ΔΔG: -3.1
  - sequence: FKLTVEQWY   pLDDT: 81.0  ipTM: 0.68  ΔΔG: -2.7
  ...
novelty_flag: all pass MMseqs2 vs UniProt
lineage: aria_v0.2.1 | prompt_id: p_042 | dataset: pepBDB_v2
```

---

## Edison / Crow — Literature Search

**User goal:** "What peptide binders for EGFR have been reported, and what interface residues do they contact?"

**What Edison receives:**
```
query: "peptide binders for EGFR kinase domain CDR1 interface residues"
sources: [pubmed, biorxiv, patents]
max_papers: 20
```

**What Edison does:**
1. Searches 175M+ papers using PaperQA3 with full-text retrieval
2. Identifies 12 relevant papers with experimental binding data
3. Extracts: known binder sequences, reported Kd values, key interface residues
4. Synthesizes into a cited summary

**What Edison returns:**
```
answer: "Several studies report EGFR CDR1 binders. Smith et al. (2023)
         identified WYHIVDLQK with Kd = 45 nM, contacting Y1016 and L1017..."
citations: [doi:10.1038/..., doi:10.1016/..., ...]
has_successful_answer: true
papers_read: 12
```

---

## Falcon — Deep Structured Report

**User goal:** "Write a background section on EGFR as a therapeutic target, including known binders, mechanism, and clinical status."

**What Falcon receives:**
```
topic: "EGFR as a therapeutic target"
depth: deep
sections_requested: [mechanism, known_binders, clinical_status, failure_modes]
```

**What Falcon does:**
1. Runs multiple literature sweeps (broader than Crow, synthesizes across hundreds of papers)
2. Builds a structured report with section headings, inline citations, and a reference list
3. Flags conflicting evidence and notes confidence levels

**What Falcon returns:**
```
report:
  ## EGFR Biology and Mechanism
  EGFR (ErbB1) is a receptor tyrosine kinase...  [Smith 2022]

  ## Known Peptide Binders
  Three classes of peptide binders have been reported...  [Jones 2023]

  ## Clinical Status
  Gefitinib and erlotinib target the kinase domain...  [FDA label]

  ## Known Failure Modes
  T790M resistance mutation abrogates most known binders...

references: [25 citations]
word_count: 2400
```

---

## Owl — Scientific Q&A (Precedent)

**User goal:** "Has anyone tested ROCK inhibitors for dry AMD?"

**What Owl receives:**
```
query: "Have ROCK inhibitors been tested for dry age-related macular degeneration?"
```

**What Owl does:**
1. Searches for prior experimental or clinical work matching the question
2. Returns a direct yes/no answer with supporting evidence
3. Flags if evidence is only preclinical vs clinical

**What Owl returns:**
```
answer: "Yes. Ripasudil, a ROCK inhibitor, has been studied in RPE cell models
         for dry AMD. Wang et al. (2024) showed improved phagocytosis in RPE
         cells treated with ripasudil at 10μM..."
has_successful_answer: true
evidence_level: preclinical (no clinical trials found)
citations: [doi:10.1167/...]
```

---

## Phoenix — Small-Molecule Design

**User goal:** "Propose small molecules that inhibit ROCK kinase with good oral bioavailability."

**What Phoenix does (its actual scope):** generates SMILES strings from a property prompt (powered by SmileyLlama). Property scoring, docking, and novelty checks are done by the orchestrator using registered tools.

**Full flow — showing who does what:**

```
SynqLab Agent
  → calls Edison to gather known ROCK inhibitor scaffolds + SAR context
  → builds enriched prompt
  → calls Phoenix with:
        goal: "ROCK kinase inhibitor, oral bioavailability, low toxicity"
        target: ROCK2 kinase domain (PDB: 2ETR)
        constraints: MW < 500, logP < 5, no reactive groups
  ↓
Phoenix / SmileyLlama (fine-tuned molecule LLM)
  → generates 30 SMILES candidates conditioned on prompt
  → returns raw SMILES
  ↓
SynqLab Agent (takes over)
  → calls RDKit tool      → MW, logP, QED, Lipinski
  → calls Vina tool       → docking score vs ROCK2 crystal structure
  → calls ChEMBL search   → novelty / prior-art check
  → ranks and stores top-K candidates
```

**What Phoenix specifically returns:**
```
smiles: ["CC1=NC(=O)...", "FC1=CC=C(C=C1)...", ...]   # raw, unscored
model_version: smiley_llama_v1.2
```

**What the orchestrator adds before storing:**
```
candidates:
  - SMILES: "CC1=NC(=O)..."     MW: 342  logP: 2.1  QED: 0.78  docking_score: -8.4
  - SMILES: "FC1=CC=C(C=C1)..." MW: 389  logP: 3.2  QED: 0.71  docking_score: -7.9
  ...
novelty: 4/5 pass Tanimoto < 0.4 vs ChEMBL known ROCK inhibitors
```

---

## Finch — Data Analysis

**User goal:** "Here's my flow-cytometry CSV from a phagocytosis assay — what does it show?"

**What Finch receives:**
```
data: flow_cytometry_results.csv   (3000 cells × 8 markers)
goal: "quantify phagocytosis efficiency per treatment group"
groups: [control, ripasudil_1uM, ripasudil_10uM, Y27632_10uM]
```

**What Finch does:**
1. Loads and gates the FCS/CSV data
2. Calculates phagocytosis index per group (% pHrodo+ cells × MFI)
3. Runs ANOVA + Tukey post-hoc to identify significant differences
4. Generates plots: violin plots per group, dose-response curve

**What Finch returns:**
```
summary: "Ripasudil at 10μM increased phagocytosis index by 2.3× vs control
          (p < 0.001). Y27632 showed a 1.8× increase (p < 0.01).
          No significant effect at 1μM ripasudil."
statistics: {ANOVA_F: 18.4, p: 0.0001, effect_size: 0.62}
figures: [violin_plot.png, dose_response.png]
suggested_followup: ["Test ripasudil at 5μM", "Add time-course"]
```

---

## Lab Agent — In-Vitro Execution (Roadmap)

**User goal:** "Order synthesis of my top 5 peptide candidates and run an SPR binding assay against EGFR."

**What Lab Agent receives:**
```
candidates: [sha256:abc123, sha256:def456, ...]   # Knowledge Store IDs
assay: SPR_binding_assay_v3
target: EGFR_kinase_domain
budget: {max_usd: 3000}
```

**What Lab Agent does:**
1. Requests human approval (estimated cost: $2,400)
2. Places synthesis order via Twist/GenScript API, assigns sample IDs
3. Polls vendor status until samples delivered (async, may take days)
4. Submits assay to Emerald Cloud Lab with versioned protocol
5. Polls for results, ingests plate-reader output
6. Flags samples by activity threshold

**What Lab Agent returns:**
```
assay_results:
  - sample_id: spl_001  candidate: sha256:abc123  Kd_nM: 45.2  result: active
  - sample_id: spl_002  candidate: sha256:def456  Kd_nM: 312   result: inactive
  ...
knowledge_store_update: all results written with chain_of_custody
audit_record: evt_lab_007 | approved_by: user_001 | cost_usd: 2380
```

---

## Related Docs

| Doc | Link |
|---|---|
| Agent pool overview | [`README.md`](README.md) |
| Aria full spec | [`aria/aria.md`](aria/aria.md) |
| Multi-agent scenarios | [`../scenarios.md`](../scenarios.md) |
| Platform architecture | [`../synqlab-architecture.md`](../synqlab-architecture.md) |
