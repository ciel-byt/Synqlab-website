# SynqLab website (prototype)

Public marketing site. Static React build, no backend of its own. In production the product's FastAPI serves it (one container): pages at `/`, `/platform`, ... and its assets under `/site/`. Sign in goes to the product's `/login`; Book a call uses Calendly.

```
cd website
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

## Routes

| Route | Page |
|---|---|
| `/` | Home: mission, Aria example, explore cards |
| `/platform` | SynqLab: clickable animated architecture, team-workspace timeline, principles |
| `/aria` | Product page (shared `ProductPage` template) |
| `/research`, `/research/:slug` | Papers, Blog, News tabs (blog and news empty on purpose) |
| `/company` | Team, supporters and collaborators |
| `/book-a-call` | Form + calendar placeholder |
| `/sign-in` | Sign in / request access → `/app` (mock) |
| `/app` | Placeholder where the real platform mounts |

## Where to edit

- **All copy and data:** `src/content.js`.
- **Platform diagram text and node panels:** `src/components/platformNodes.js`. Animation and layout: `PlatformFlow.jsx`. Aria loop animation: `AriaLoop.jsx`. Timeline: `WorkspaceTimeline.jsx`. Background in `docs/platform.md`.
- **Colors, fonts, radii, button tokens:** `src/theme.css` only. Nothing else defines a color. JS (3D viewer) reads the same tokens via `src/theme.js`.
- **Layout and components:** `src/styles.css`. Icons: `src/components/icons.jsx` (Lucide).
- **Switches in `content.js`:**
  - `FORMS_CONNECTED` — false until forms and sign-in hit a real backend. While false, the UI says nothing was sent.
  - `COLLABORATORS_CONFIRMED` — false until each university confirms in writing. Hides their names.

## Rules

- Every number links to a paper. Only confirmed-published results go on the site (not the ICLR-template DPO numbers).
- No testimonials, logos, or customer claims without written permission.
- NVIDIA, Google, and AWS are programs/credits, never "investors".
- Videos are placeholders. Record real screens only; label replay or simulated data.

## News

Research → News shows the latest posts of the X account in `NEWS_HANDLE` (`src/content.js`), stored as a static copy in the product database (`GET /api/public/news`, `site_news` table) and refreshed only by running `synqLab-agent/scripts/refresh_news.py`. The server never calls X.

## Research list

Papers come from the product database: `GET /api/public/papers` (table `site_papers`, seeded from `synqLab-agent/synqlab/seed/site_papers.json`). Add a paper by adding a row there or to the JSON (new slugs are inserted on the next request). Without the backend (`npm run dev`) the page falls back to the short list in `src/content.js`. Abstracts are stored only for open-access works.

## One container (local check)

```
cd website && npm run build                      # dist/ (assets use the /site/ base)
rm -rf ../synqLab-agent/app/static/site && cp -R dist ../synqLab-agent/app/static/site
cd ../synqLab-agent/frontend && npx vite build   # product SPA → app/static/dist
cd .. && SYNQLAB_DB_URL=postgresql://… SYNQLAB_JWT_SECRET=… .venv/bin/python -m uvicorn app.main:app --port 8010
```

`/`, `/platform`, `/aria`, `/research`, `/company`, `/book-a-call` serve the website; everything else is the product. `Dockerfile.synqlab` (repo root) builds both into one image. Not deployed yet.

## To do
- Replace `VideoSlot` with embeds, add paper PDF links, restyle the product's login and app to the brand.
