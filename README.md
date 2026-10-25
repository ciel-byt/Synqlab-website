# SynqLab

An AI lab for biology. This repo holds the website, the product (agents such as Aria) and the AWS deployment.

## Run locally

```bash
./start.sh                # build everything and serve on http://localhost:8010
./start.sh --no-build     # faster restart, reuses the last build
./start.sh --dev          # auto-reload the API while you edit
```

Needs Docker running (Postgres), node/npm, and the Python env: `cd synqLab-agent && uv sync --extra server`.
Details: [docs/engineering/running-locally.md](docs/engineering/running-locally.md).

## Deploy

Push a commit whose message contains `deploy`. GitHub Actions builds the image and releases it to AWS.
Architecture and one-time setup: [DEPLOYMENT.md](DEPLOYMENT.md). The setup scripts are in `infra/`.

## Layout

| Folder | What |
|---|---|
| `website/` | Public website (Vite + React) |
| `synqLab-agent/` | Product: FastAPI backend, React app, agents and tools |
| `infra/` | One-time AWS scripts (`aws_setup.sh`, `aws_cloudfront.sh`) |
| `docs/` | Strategy, status, engineering notes |
