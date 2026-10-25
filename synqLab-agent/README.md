# synqLab-agent

This is the **implementation repo** for SynqLab V1.

All application source code, tests, configs, and scripts live here.

## Companion repo

Design docs, registry, execution plans, and component specs live in the **SynqLab** repo:

- GitHub: https://github.com/ciel-byt/SynqLab
- Local (sibling folder): `../SynqLab/`

Before writing any code, read:

| Doc | Path in SynqLab repo |
|---|---|
| Execution prompt (start here) | `docs/engineering/exec-plans/active/v1-execution-prompt.md` |
| Tool registry (tools contract) | `registry/tools.yaml` |
| Component specs | `docs/engineering/components/` |
| Architecture overview | `docs/engineering/architecture.md` |
| Knowledge Store design | `docs/engineering/design-docs/knowledge-store.md` |

## Layout

```
synqlab/          ← all application source code
tests/            ← pytest unit tests
configs/          ← base.yaml and local.yaml.example
scripts/          ← deploy.sh, train_reranker.py, ingest_brightness.py
artifacts/        ← runtime outputs (gitignored except .gitkeep)
docker-compose.yml
pyproject.toml
uv.lock
```

## Quick start

```bash
# 1. install uv (if not already installed)
# https://docs.astral.sh/uv/getting-started/installation/
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. start the postgres container
docker compose up -d db

# 3. install dependencies (creates .venv automatically)
uv sync --extra ml --extra server

# 4. run deploy + smoke test
bash scripts/deploy.sh
```
