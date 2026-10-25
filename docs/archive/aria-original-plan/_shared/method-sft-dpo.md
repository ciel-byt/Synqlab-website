# Shared — SFT → DPO Methodology

The two-stage training methodology common to all SynqLab generative agents (Aria for sequences, Phoenix/SmileyLlama for molecules). Phase docs reference this instead of re-explaining the method.

---

## The pattern

```
1. SFT   — teach the model to follow property prompts (supervised, on real data)
2. Score — generate N candidates per prompt, score them with objective tools
3. DPO   — pair best vs worst, train the model to prefer the best
4. Repeat 2–3 for several iterations (closed loop)
```

- **SFT** gives prompt-following ("generate something with these properties").
- **DPO** gives optimization ("generate something that *scores well* on the real objective").
- The objective in DPO comes from external scoring tools ([`scoring-tools.md`](scoring-tools.md)), not from labels — this is what makes the loop self-improving.

---

## Stage 1 — SFT data format

One JSON object per training example. Train on the response only (`train_on_inputs: false`).

```json
{
  "system": "You are a biological sequence designer. Generate amino acid sequences from property descriptions.",
  "prompt": "Generate a protein sequence with the following properties: ...",
  "response": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ..."
}
```

Prompts are built by **randomizing which feature subset is shown** (30–70% of available features per sample) so the model learns to condition on any combination, not a fixed schema.

---

## Stage 2 — Scoring → preference pairs

For each prompt, generate N candidates, score each with a **composite score**, then bucket:

- `chosen` = a candidate in the **top quartile** of composite score for that prompt
- `rejected` = a candidate in the **bottom quartile** for the **same prompt**

Pairing rules (strict — prevents noisy gradients):

1. Both members of a pair use the **identical prompt**.
2. Never pair two candidates from the **same** score bucket.
3. Candidates failing **hard filters** are excluded entirely (not used as `rejected` either — they teach nothing useful).

---

## Stage 3 — DPO data format

```json
{
  "system": "You are a biological sequence designer. Generate peptide sequences that bind to a given receptor.",
  "prompt": "Generate a peptide binder for target EGFR with length 10-18 residues, helical conformation...",
  "chosen": "KKLAELLQKLAEELL",
  "rejected": "ACDEFGHIKLMNPQR"
}
```

Run with TRL DPO (under Axolotl `rl: dpo`). Start from the SFT checkpoint, **not** the base model.

---

## Composite score (template)

Each agent defines its own weights and metrics, but the shape is identical: a weighted sum of objective scores, gated by binary hard filters.

```python
score = (
    w_1 * metric_1      # e.g. ipTM (binding confidence)
  - w_2 * metric_2      # e.g. interface pAE (penalty)
  + w_3 * metric_3      # e.g. pLDDT (structural confidence)
  + w_4 * metric_4      # e.g. solubility / developability
  + w_5 * novelty       # e.g. 1 - max_identity_to_train
) * hard_filters_pass   # binary 0/1 — any failed filter zeroes the score
```

**Hard filters** are agent-specific but always include: valid tokens only, length in range, no forbidden motifs. A candidate that fails any hard filter is dropped before pairing.

---

## Iteration & stopping

- Run 2–3 DPO iterations; re-score with fresh candidates each round.
- **Stop** when the mean target metric stops improving by the agreed margin (e.g. < 5% relative gain over the previous iteration) or the compute budget is hit.
- Each iteration produces a new versioned checkpoint with a lineage record (see [`training-frameworks.md`](training-frameworks.md)).
