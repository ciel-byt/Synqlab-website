# SynqLab — Milestones

Chronological record of shipped milestones.

---

## v1.0 — Agentic AI Platform

**Shipped:** 2026-04-30
**Phases:** 8 of 9 executed (Phase 9 skipped — deferred to M2)
**Plans:** 28 across executed phases
**Tests:** 103 passing in agent system (was 16 at start)
**Requirements:** 13/13 in-scope satisfied

### Delivered

A product-grade agentic AI platform for protein engineering: researchers
describe goals in natural language and AI agents orchestrate
generate → fold → analyze → report pipelines through configurable
autonomy modes (copilot / supervised / autonomous), with coordinator/worker
sub-agent patterns, an extensible skill system, and full cost controls.

### Key Accomplishments

1. **Agent core** — `AgentEngine` with OpenAI function calling, `AgentContext`
   per-session isolation, three autonomy modes (copilot, supervised,
   autonomous), real-time WebSocket streaming.
2. **Coordinator/Worker pattern** — `TaskManager`, `spawn_worker`,
   `send_message`, `stop_task`, `list_tasks` tools; full lifecycle
   (pending → running → completed/failed/killed) with concurrent session
   isolation proven under stress.
3. **Skill system** — Markdown-based `SKILL.md` format with YAML
   frontmatter, `SkillLoader` with directory + DB sources, 4 bundled
   core skills, browser UI, REST API, `list_skills` / `activate_skill`
   tools available to all agent types.
4. **Research Director workflow** — Autonomous coordinator agent with
   research-director-protocol skill, end-to-end demo (generate → fold →
   analyze → report), artifact persistence (PDB / markdown / score tables).
5. **Frontend Agent Console** — Full chat UI with tool-call cards,
   session sidebar, sub-agent task tree view, autonomy mode selector,
   pipeline editor, batch upload, template gallery, integrated into the
   Lab hub.
6. **Pipeline & batch** — Visual drag-and-drop pipeline editor, DAG
   execution engine with topological order + cycle detection, CSV/FASTA
   batch processing with concurrency control.
7. **Cost controls & templates** — Per-session token budget (soft/hard
   limits), org monthly quotas, usage dashboards, 5 pre-configured agent
   templates (quick-analysis, protein-optimization, binder-design,
   literature-review, custom-research).
8. **Eval infrastructure** — `tool_selection.json` (21 cases), workflow
   evals, faithfulness scorer, 5 online guardrails (PII redaction, PDB
   validation, ΔΔG sanity, citation linking, schema validation).
9. **Integration & E2E test hardening (gap closure)** — Multi-session
   concurrency stress (REQ-07 satisfied), Research Director chain
   integration test, full FastAPI → engine → DB roundtrip via
   `httpx.ASGITransport`, 5th multi-tool eval case (EVAL-REVIEW G7
   closed). +19 tests in Phase 8.

### Stats

| Metric | Value |
|--------|-------|
| Phases executed | 8 (Phases 1–8) |
| Phases skipped | 1 (Phase 9 deferred to M2) |
| Plans | 28 |
| Commits since GSD init | 37 |
| Files changed | 163 |
| Lines added / removed | +15,837 / −103 |
| Python LOC (synqlab + app + tests + evals) | ~14,579 |
| TypeScript LOC (frontend/src) | ~26,456 |
| Tests passing (agent system) | 103 |
| Timeline | 2026-04-29 → 2026-04-30 (≈1 day intensive build) |

### Known Gaps (Deferred to Milestone 2)

| Gap | Origin | Note |
|-----|--------|------|
| Phase 9: Production Observability | Skipped 2026-04-30 | Tracing, org metrics, session outcomes, CI/CD eval |
| EVAL-REVIEW G1 | Phase 9 deferral | No Arize Phoenix tracing on AgentEngine |
| EVAL-REVIEW G2 | Phase 9 deferral | No org-level usage aggregation endpoint |
| EVAL-REVIEW G3 | Phase 9 deferral | No `outcome` field on `agent_sessions` |
| EVAL-REVIEW G4 | Phase 9 deferral | No Promptfoo CI/CD regression pipeline |
| EVAL-REVIEW G5 | Eval audit | `--live` eval validation not run (requires real OPENAI_API_KEY) |
| EVAL-REVIEW G6 | Eval audit | No domain-expert dataset review |
| REQ-14 Skill Marketplace | Originally deferred | Community skill discovery |
| REQ-15 Agent Memory | Originally deferred | Cross-session learning |
| `tests/unit/` failures (10) | Pre-existing V1 | Legacy orchestrator/registry, not in Milestone 1 scope |

### Key Decisions Made

- OpenAI as LLM provider (native function calling) — Decided ✓
- Python/FastAPI for agent backend (async-native, matches stack) — Decided ✓
- Coordinator/Worker pattern from Claude Code — Decided ✓ Good
- Pydantic for tool schemas (replacing Zod) — Decided ✓ Good
- Three autonomy modes (copilot/supervised/autonomous) — Decided ✓ Good
- Skills as markdown files with YAML frontmatter — Decided ✓ Good
- WebSocket for streaming (not SSE) — Decided ✓ Good
- Skip Phase 9 production observability for M1 — Decided 2026-04-30 (defer to M2)

### Tag

`v1.0` — see `.planning/milestones/v1.0-ROADMAP.md` and
`.planning/milestones/v1.0-REQUIREMENTS.md` for archived state.

---

## v1.1 — UI Polish & Stabilization

**Shipped:** 2026-05-02
**Phases:** 3 of 4 executed (Phase 11 deferred to M2)
**Plans:** 14 across executed phases
**Commits:** 76 since v1.0

### Delivered

UI alignment with existing design system and runtime fixes. Unified Agent hub
with Console/Designer toggle, dedicated New Session page, and artifact
orchestration (tools can pass files to each other via `artifact_id`).

### Key Accomplishments

1. **Unified Agent Hub** — `/lab/agents` with Console/Designer toggle, full-width
   Console layout (like ChatGPT/Claude), Designer landing with pipeline cards.
2. **New Session Page** — Dedicated route `/lab/agents/console/new` with formal
   academic design, breadcrumbs ("Lab / Console / New Session").
3. **Artifact Orchestration** — `artifact_id` ↔ `file_path` bridging via
   `_persist.py` and server-side resolution in `stability_analysis.py`.
4. **Scope Model** — Session → Project → Global artifact scopes with
   `POST /artifacts/{id}/promote` action.
5. **User Upload** — ChatDropZone for drag-drop/paperclip upload with extension
   allowlist (`.pdb/.fasta/.fa/.csv/.json`).
6. **Discovery Tools** — `list_pdb_samples` for bundled sample enumeration,
   lifespan ingest for global scope rows.
7. **Infrastructure** — Shared `agent_artifacts` mount in Docker Compose and
   Helm across gateway + tool services.
8. **Documentation** — `docs/AGENT_ARCHITECTURE.md` "Tool System" section
   updated with the artifact_id contract.

### Stats

| Metric | Value |
|--------|-------|
| Phases executed | 3 (Phases 10, 12, 13) |
| Phases deferred | 1 (Phase 11 → M2) |
| Plans | 14 |
| Commits since v1.0 | 76 |
| Timeline | 2026-04-30 → 2026-05-02 |

### Known Gaps (Deferred to Milestone 2)

| Gap | Origin | Note |
|-----|--------|------|
| Phase 11: Console & Routing Polish | v1.1 deferral | Phase 12 covered primary goals |
| D-12 LLM smoke | Phase 13 | predict_structure → analyze_stability chain (needs FoldX) |
| UI-DROP live smoke | Phase 13 | Drag-drop browser test (needs interactive dev) |
| UI-PROMOTE live smoke | Phase 13 | Promote action browser test (needs interactive dev) |
| BL-01..BL-07 | Phase 13 code review | Security hardening for artifact endpoints |

### Key Decisions Made

- Console breaks from ModularPageLayout intentionally (chat-app UX priority) — ✓ Good
- artifact_id-only schema for path-consuming tools (server-side resolution) — ✓ Good
- Three-tier scope model (session/project/global) — ✓ Good
- Phase 11 deferred (Phase 12 covered dedicated routes/breadcrumbs) — Decided 2026-05-02
- Team config with local `.planning/` (commit_docs: false) — Decided 2026-05-02

### Tag

`v1.1` — see `.planning/milestones/v1.1-ROADMAP.md` and
`.planning/milestones/v1.1-MILESTONE-AUDIT.md` for archived state.
