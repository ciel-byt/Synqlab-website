# Running SynqLab locally (website + product in one server)

**Quick start:** `./start.sh` (repo root). It starts Postgres in Docker, runs migrations, builds the website and the product
frontend, and serves everything on http://localhost:8010. Options: `--dev` (reload API code), `--no-build`, `--port N`.
It reads `./.env` (gitignored) for secrets such as `X_BEARER_TOKEN`. The old todo-app script is kept as `start_todo.sh`.
Port 8000 is not the default because other local containers often use it. The manual steps below are what the script does.

One FastAPI server (`synqLab-agent/app/main.py`) serves the marketing website (built from `website/`) and the product
(React app from `synqLab-agent/frontend`). Public pages are served at `/`, `/platform`, `/aria`, `/lyra`, `/research`,
`/company`, `/book-a-call`; their assets live under `/site/`. Everything else (`/login`, `/lab`, `/workspace`, `/api`) is the product.

## One-time setup
```bash
# Postgres in Docker (port 5432 is often taken; 5545 used here)
docker run -d --name synqlab-local-db -p 127.0.0.1:5545:5432 \
  -e POSTGRES_DB=synqlab -e POSTGRES_USER=synqlab -e POSTGRES_PASSWORD=synqlab \
  -v synqlab_local_pg:/var/lib/postgresql/data postgres:16

cd synqLab-agent
export SYNQLAB_DB_URL=postgresql://synqlab:synqlab@127.0.0.1:5545/synqlab
.venv/bin/alembic upgrade head          # migrations through 022
```

## Build and run
```bash
# website -> served under /site/
cd website && npm run build
rm -rf ../synqLab-agent/app/static/site && cp -R dist ../synqLab-agent/app/static/site

# product frontend -> app/static/dist
cd ../synqLab-agent/frontend && npx vite build

# server
cd .. 
export SYNQLAB_DB_URL=postgresql://synqlab:synqlab@127.0.0.1:5545/synqlab
export SYNQLAB_JWT_SECRET=local-test-secret
export SYNQLAB_REGISTRY_DIR=$PWD/deploy/helm/synqlab/files     # tool registry (in the image it is /registry)
export SYNQLAB_ARTIFACT_DIR=/tmp/synqlab-artifacts               # uploads (Aria tables) are saved here
.venv/bin/python -m uvicorn app.main:app --port 8010
```
Open http://localhost:8010. Rebuild the website or frontend after changing them (the server serves the built files).
For live reload of the website only: `cd website && npm run dev` (http://localhost:5173; Sign in needs the :8010 server).

## Settings
| Variable | Purpose |
| --- | --- |
| `SYNQLAB_DB_URL` | Postgres URL (required) |
| `SYNQLAB_JWT_SECRET` | signs login tokens (set a real one outside local) |
| `SYNQLAB_REGISTRY_DIR` | folder with `tools.yaml` (default: `../registry`; image: `/registry`) |
| `SYNQLAB_ARTIFACT_DIR` | where uploads are stored (default `/app/data/agent_artifacts`) |
| `X_BEARER_TOKEN` | X API token, used only by `synqLab-agent/scripts/refresh_news.py` (reads `.env`). The server never calls X |
| `OPENAI_API_KEY` | chat assistant in the agent console (not needed for the Aria demo) |
| tool URLs (`SYNQLAB_*_URL`) | optional; unset = mock mode for tools |

## Accounts and testing
- Signup is closed in the UI. Create a local account through the API: `POST /auth/signup` with `email`, `password`, `full_name`.
- **Use a separate test account for automated tests.** The founder also uses this server and database, and cleanup of test data
  once deleted their models.

## One container (not deployed yet)
`Dockerfile.synqlab` (repo root) builds the website, the product frontend and the API into one image; the tool registry is copied to
`/registry`. Never built or run. Postgres must live outside the container (RDS or hosted), with `SYNQLAB_DB_URL` and `SYNQLAB_JWT_SECRET` as secrets,
and `alembic upgrade head` run once per deploy. Nothing is committed or deployed without the founder's go-ahead (commits with "deploy" trigger CI).

## News (static)
The News tab reads the `site_news` table (migration 023); nothing refreshes by itself. To update it:
`cd synqLab-agent && .venv/bin/python scripts/refresh_news.py` (10 newest distinct original posts of @BiologyAIDaily, with the first image of each). Ask when you want it refreshed.
