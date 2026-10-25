# V1 Baseline Experiment

## Experiment metadata

| Field | Value |
|---|---|
| experiment_id | `<fill in>` |
| date | `<fill in>` |
| operator | `<fill in>` |
| config used | `configs/base.yaml` + any local overrides |
| mock_mode | `false` |

---

## Configuration

```yaml
n_sequences: 50
plddt_threshold: 70.0
ddg_threshold: 2.0
top_k: 10
use_reranker: false
```

---

## Pipeline summary

| Stage | Metric | Value |
|---|---|---|
| Stage 1 (Generate) | n_generated | `<fill in>` |
| Stage 2 (OmegaFold) | n_passed_gate1 | `<fill in>` |
| Stage 3 (FoldX) | n_passed_gate2 | `<fill in>` |
| Stage 4 (Reranker) | skipped (round 1) | — |
| Stage 5 (Top-k) | n_top_k | `<fill in>` |

Elapsed time: `<fill in>` seconds

---

## Top-k candidates

| Rank | Sequence | pLDDT | ΔΔG | Reranker score |
|---|---|---|---|---|
| 1 | `<fill in>` | `<fill in>` | `<fill in>` | — |
| 2 | | | | |
| ... | | | | |

---

## Observations

- `<fill in notes about sequence diversity, confidence distribution, etc.>`

---

## Next steps

- [ ] Submit top-k candidates for wet-lab split-GFP assay
- [ ] Ingest assay results via `scripts/ingest_brightness.py`
- [ ] Retrain reranker: `python scripts/train_reranker.py`
- [ ] Run round 2 with `use_reranker: true`
