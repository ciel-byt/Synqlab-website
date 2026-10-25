# Component Spec — Reranker

## Responsibility

Predict the probability that a candidate sequence will be a hit (fluorescence ≥ τ), given tool-score features from the pipeline. Train from labeled data stored in the Knowledge Store. Version and persist the model artifact so the pipeline can load it automatically in subsequent rounds.

## Location

- Adapter: `synqlab/adapters/reranker.py`
- Training script: `scripts/train_reranker.py`
- Model artifact: `artifacts/reranker/model.pkl`

## Input features (V1)

| Feature | Source |
|---|---|
| `plddt` | OmegaFold output |
| `ddg` | FoldX output |

Additional features (V2+): iPTM, docking confidence, ESM-2 embedding norm.

## Model (V1)

Logistic regression (sklearn). Chosen because:
- Interpretable — coefficients show feature importance directly
- Works well under small data (113-set seed)
- Trains in < 1 second; no GPU required
- Easy to version with `pickle`

Upgrade path: gradient boosted trees (XGBoost) in V1.5; small MLP in V2.

## Training

```bash
python scripts/train_reranker.py \
  --dataset-artifact-id <knowledge_store_id> \
  --output artifacts/reranker/model.pkl
```

The script:
1. Retrieves the labeled dataset from the Knowledge Store
2. Builds the `[plddt, ddg]` feature matrix
3. Trains logistic regression with cross-validation
4. Saves model + evaluation summary (accuracy, AUC) to `artifacts/reranker/`
5. Registers the model artifact in the Knowledge Store

## Skip behaviour

If `artifacts/reranker/model.pkl` does not exist, `RerankerAdapter.run()` returns:

```json
{"score": null, "model_version": "none", "skipped": true}
```

This is not an error. The orchestrator simply treats all survivors equally in Stage 4 and falls back to FoldX ΔΔG for top-k ranking.

## Versioning

Each trained model is saved as `model_v{N}.pkl` and symlinked to `model.pkl`. The `model_version` field in the adapter output records which version was used, enabling full reproducibility.

## Connections

- Reads from Knowledge Store via `synqlab/knowledge_store/store.py`
- Called by `synqlab/engine/executor.py` as a standard adapter
- Training triggered manually or by the orchestrator after a round completes (config flag: `auto_retrain_reranker`)
