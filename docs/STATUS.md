# SynqLab — Status

_Updated 2026-10-24_

## Now

| Workstream | State |
| --- | --- |
| Docs | Reorganized (old material in `archive/`). Backup: `~/Downloads/SynqLab/docs-backup-2026-10-23.tgz` |
| Strategy and platform definition | `strategy.md`, `platform.md`, `design-spec.md`, `market-research.md` written. SynqLab = agentic platform ("An AI lab for biology"); Aria, Lyra = agents |
| Applications (YC / Speedrun) | `fundraising/yc_v2_draft.md` still on the old framing; needs founder facts |
| Website (`website/`) | Built (run with `./start.sh`): Home, Platform (clickable animated architecture), Aria, Lyra, Research (from DB), Company, Book a call (Calendly embed). No playable demos on the public site (policy: videos only; try it = sign in or book a call). Demo videos not recorded yet. See `website/README.md` |
| One container | Website + product served by one FastAPI (`/`, `/platform`, ... = website; `/login`, `/lab`, `/workspace` = product). Works locally with Postgres in Docker. `Dockerfile.synqlab` written but never built; not deployed. AWS decision (RDS Postgres) pending. See `engineering/running-locally.md` |
| Product restyle | Pine color, serif page titles, pill buttons/fields, "An AI lab for biology" taglines. Product logo (blue/teal swirl) not matched to the website wordmark |
| News tab | Research → News shows a static copy of the 10 latest distinct posts of @BiologyAIDaily with images, stored in the `site_news` table. Updated only on request: `synqLab-agent/scripts/refresh_news.py` (X token from `.env`). Plan/quota of the X token unknown |
| Research list | `site_papers` table + public `GET /api/public/papers`; 25 papers from both founders' Scholar profiles. Aria NeurIPS 2026 entry has no authors or link yet |
| Aria workspace (demo) | Lab → Aria: **Models** (queryable performance table, delete, compare, new model with data stats) and **Use models** (chat with a model version, compare two). Replays recorded results, not a live model. Details in `agents/aria/aria.md` ("Aria in the product") |
| Lyra | Placeholder page in the product with an interest form. In development |
| SynqLab agent ↔ Aria | Assignment of an Aria version to the agent is stored; the agent does not call Aria yet |

## Open facts (needed from founders)

1. Aria paper: NeurIPS 2026 (confirmed). Which paper in `research/papers/`, and main track or workshop?
2. What each collaborating lab provides, and what is in writing
3. ~~Merck advisor~~ — dropped, not used
4. Customer conversations, LOIs, pilots, revenue
5. Full-time status, location, equity, funding to date
6. ~~Pouriya's degree~~ — PhD, Pharmaceutical Sciences (confirmed)
7. ~~The ask~~ — the accelerator deals: YC $500K, Speedrun up to $1M (confirmed)
8. Lyra: trademark check and SyntheMol-RL license
9. GFP11 data rights
10. Whether the transfer fix can go in a preprint
11. Small-molecule agent: Lyra or the old name "Phoenix"? SmileyLlama or SyntheMol-RL base? Licenses
12. Edison / FutureHouse agents: keep in the system or drop? (site shows only Aria and Lyra by name)
13. Tools layer: are we integrating a hosted tool provider (e.g. Tamarind Bio)? Which, and may we name it? Confirm each engine on the site is callable from the platform
14. Which workspace features exist today (orgs, projects, roles, documents, approvals, audit log)? The site timeline is illustrative
15. Reconcile `fundraising/yc_v2_draft.md` and the Speedrun answers with the new framing (SynqLab = platform, Aria = self-improving agent)
16. Website: Aria paper authors and link, logo validation, Twitter/X handle for News
17. Website tool diagram lists engines (AlphaFold, RFdiffusion, DiffDock, ...) as available; the product registry has only 7 live tools (ProtGPT2, OmegaFold, FoldX, ESMFold, reranker, experiment store, label ingestor). Show Live vs Planned per engine in the panel, or trim the list
18. Demo videos for SynqLab and Aria: scripts drafted in `video/scripts.md`; voiceover and screen recordings still to do
19. AWS: RDS Postgres vs hosted Postgres for the one-container demo; secrets (JWT, OpenAI key); migrations at deploy

## Next 90 days

Customer interviews → provider quotes → benchmark + ablation → one prospective wet-lab round. See `strategy.md`.
