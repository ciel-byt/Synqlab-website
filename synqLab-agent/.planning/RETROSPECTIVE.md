# SynqLab — Living Retrospective

A milestone-by-milestone log of what worked, what didn't, and the
patterns that survived. Append-only at the top; cross-milestone trends
roll up at the bottom.

---

## Milestone: v1.0 — Agentic AI Platform

**Shipped:** 2026-04-30
**Phases:** 8 of 9 executed (Phase 9 deferred to M2) | **Plans:** 28

### What Was Built

- Agent core (`AgentEngine`, `AgentContext`, three autonomy modes,
  WebSocket streaming) — Phase 1
- Three-mode autonomy with copilot approval gates — Phase 2
- Coordinator/worker `TaskManager` with full lifecycle — Phase 3
- Markdown skill system (4 core skills, browser UI, REST API) — Phase 4
- Research Director protocol with end-to-end demo — Phase 5
- Visual pipeline DAG editor + CSV/FASTA batch processor — Phase 6
- Per-session/org token budgets + 5 agent templates — Phase 7
- Concurrency stress tests, Research Director chain test, full E2E
  REST→engine→DB roundtrip, eval gap closure — Phase 8

### What Worked

- **Claude Code as architectural anchor** — naming and patterns
  (`QueryEngine` → `AgentEngine`, `ToolUseContext` → `AgentContext`,
  `Task` lifecycle, coordinator restricted tool set) gave the codebase
  a coherent shape from day one. No mid-milestone refactors.
- **Pydantic-first tool schemas** — `build_tool(AgentToolDef)` produces
  OpenAI function-calling JSON automatically. Adding a new tool means
  one file, no boilerplate registry edits.
- **GSD per-phase plan structure** — every phase had a written PLAN.md
  with explicit tasks before any code. Made parallelisation feasible
  even with single-developer execution.
- **Phase 8 gap-closure pattern** — running a milestone audit, finding
  REQ-07 partial and EVAL-REVIEW G7 gap, then writing a dedicated
  gap-closure phase rather than retroactively patching earlier
  phases. Kept history readable.
- **Mock-first tests with real wiring** — `httpx.ASGITransport` +
  temp SQLite + signed JWT + patched `submit_message` exercises the
  real FastAPI app + DB layer end-to-end without the network.

### What Was Inefficient

- **PLAN.md drift from real APIs** — multiple Phase 8 plan code samples
  referenced stale APIs (`TaskManager()` missing arg,
  `loader.list_skills()` instead of `get_all_skills()`,
  `literature_search` vs registered `search_literature`,
  `template_id` field that never existed). Cost ~10 minutes of test-fix
  iteration. Plan reviews against the live codebase would catch this.
- **Per-plan SUMMARY.md only emerged in Phase 8** — Phases 1–7 shipped
  via condensed `feat()` commits without explicit per-plan summaries,
  making retrospective accomplishment extraction harder.
- **Pre-existing `tests/unit/` failures unaddressed** — 10 V1
  orchestrator/registry test failures predate Milestone 1 but were
  carried forward. Should have been triaged at GSD bootstrap.
- **Optional dependencies not installed in test venv** —
  `python-jose`, `passlib`, `fastapi`, `uvicorn` are declared as
  `[server]` extras in `pyproject.toml` but weren't in the active
  environment, blocking Phase 8 E2E tests until installed manually.
  A `dev` extra (or `uv sync --all-extras`) at bootstrap would prevent
  this.

### Patterns Established

- **Three-test-class layout** for new test files: independence
  assertions (sync) + concurrent stress (async) + cross-session
  isolation (async with `asyncio.gather`).
- **`@pytest.mark.asyncio` + `pytest-asyncio` STRICT mode** — keep
  fixtures explicit; no `auto` mode.
- **Engine context fixtures use `with patch.dict("os.environ",
  {"OPENAI_API_KEY": "test-key"})`** — uniform stub for any test that
  instantiates `AgentEngine` without hitting OpenAI.
- **Worker context inherits identity** — `org_id`, `user_id`,
  `project_id` from coordinator, fresh `session_id`, sets
  `parent_task_id`. Verified in Phase 8 chain test.
- **Skip-with-defer rather than skip-with-silence** — Phase 9 was
  marked `Skipped (deferred to M2)` with explicit gap traceability
  in MILESTONES.md, not silently dropped.

### Key Lessons

1. **A milestone audit before final close is high-value.** The Phase 8
   work flowed directly from `v1-MILESTONE-AUDIT.md` findings — REQ-07
   partial, integration test gap, E2E flow gap, eval G7. Without the
   audit those would have been technical debt entering v1.0.
2. **PLAN.md examples must be live-validated.** The cost of stale plan
   code is asymmetric — minutes per occurrence, but compounds across
   many plans. Future phases should run a quick "does the example
   compile?" pass before plan-check.
3. **Verification ≠ tasks-complete.** Phase 8's `08-VERIFICATION.md`
   re-checked must-haves against the live code, separated cumulative
   test counts (84 → 103) and confirmed REQ-07's status promotion.
   Without this step the plan claims wouldn't have been audit-trail
   evidence.
4. **Defer don't drop.** Phase 9 wasn't shipped — but its scope is
   pinned in MILESTONES.md with EVAL-REVIEW G1–G4 mapped, so M2
   scoping doesn't have to re-discover it.

### Cost Observations

- Single-developer execution; LLM-assisted via Cursor + Claude.
- Heavy use of inline editing; minimal subagent spawning (most phases
  ran inline).
- ~37 commits, 1-day intensive build window (Apr 29 → Apr 30).

---

## Cross-Milestone Trends

*(First milestone — populate from v1.1 onward.)*

| Milestone | Phases | Plans | Tests Δ | LOC Δ | Key Lesson |
|-----------|--------|-------|---------|-------|------------|
| v1.0 | 8/9 (1 deferred) | 28 | 16 → 103 | +15,837 | Plan examples must compile against live APIs |
