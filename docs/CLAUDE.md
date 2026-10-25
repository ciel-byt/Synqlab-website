# SynqLab — Workspace Entry Point

Read [`STATUS.md`](STATUS.md) first, then [`strategy.md`](strategy.md).

## What SynqLab is

**SynqLab is an AI lab for biology: the agentic platform**: a team workspace (organizations, projects, documents, approvals, audit trail) with agents and tools doing the work. See [`platform.md`](platform.md).

**Aria** is the protein agent: a customization framework (SFT + preference tuning) that turns a team's own data into a private model for their target. Customers host and own the models. **Lyra** (working name) is the small-molecule agent, in development.

Today an expert guides diagnosis and fixes. Automating that is the goal, not the current state.

## Map

| Path | What |
| --- | --- |
| `platform.md` | the SynqLab platform, tools layer, website diagram |
| `strategy.md` | thesis, flow, roadmap, risks |
| `design-spec.md` | layers, loop, pack contract, experiment gates |
| `market-research.md` | competitors, size, costs, comparables |
| `STATUS.md` | living board — update when state changes |
| `fundraising/` | applications. `yc_v2_draft.md` is current; the rest are pre-pivot |
| `agents/aria/aria.md` | Aria as built: recipe, results, limits. The old V0–V5 plan is in `archive/aria-original-plan/` |
| `engineering/` | implementation docs for the platform as built |
| `research/papers/` | papers and figures |
| `team/`, `tools/` | roster, tool registry |
| `archive/` | pre-pivot material. Do not treat as current |

## Rules

- Keep docs short, simple, with a diagram where it helps.
- Mark unverified facts `[TODO]` or "founder-reported". Never claim a venue, partner, or result that isn't confirmed.
- Public taglines (decision 2026-10-24): SynqLab "An AI lab for biology." Aria "AI that designs proteins." Keep site language plain for non-technical readers. Do not use "operating system", "decision engine" or "digital twin" as claims. Say "built for traceability toward a filing", never "FDA-ready".
- Nothing playable on the public website without login: videos only. Trying a product demo = sign in or book a call.
- Aria demo honesty: recorded rounds replay real results; rounds beyond them are illustrative; uploads are queued, never simulated; GO/EC in the chat are inherited from the family and labelled demo.
- Test with a separate account, not the founder's. Do not commit, deploy or run AWS commands without an explicit go.
- Update `STATUS.md` when project state changes.
