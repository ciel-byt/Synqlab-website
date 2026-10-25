# Aria demo data builders

One-off scripts that produce the files in `synqlab/seed/`. They read the Aria research outputs on the founder's machine
(`~/Downloads/SynqLab/SynqLab/aria/...`, absolute paths inside) and are not run in production. Re-run when the research
results change, then rebuild the app.

| Script | Writes | From |
| --- | --- | --- |
| `build_family_map.py` | `aria_families.json` (2,415 families, t-SNE position), `aria_samples.json` (sample proteins) | `embeddings/out/esm2_t6_8M`, `family_embeddings.parquet`, `family_summary.csv` |
| `build_family_stats.py` | `aria_family_stats.json` (length, species, GO, EC, properties) | `embeddings/out/esm2_t6_8M/meta.parquet` |
| `build_runs.py` | `aria_runs.json` (per-round metrics; 15 paper metrics are added by hand from the NeurIPS paper) | `multi-domain-selection/domain_hit`, `tm_score` detail files |
| `build_chat_data.py` | `aria_chat/index.json` + `aria_chat/pdb/*.pdb` (12 prompts x 4 rounds x 3 families) | `multi-domain-selection/training/pf*_seed1001/eval/final_test` |
| `fetch_papers_openalex.py`, `build_site_papers.py` | `site_papers.json` | OpenAlex (open-access abstracts only) + Scholar titles |

Notes: `aria_runs.json` metric definitions and the `control` block were edited after generation (see `docs/agents/aria/aria.md`).
`build_runs.py` does not carry those edits, so do not overwrite the file blindly.
