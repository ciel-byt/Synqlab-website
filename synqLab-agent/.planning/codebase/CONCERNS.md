# Codebase Concerns

**Analysis Date:** 2026-05-02

## Tech Debt

**Phase 13 Security Blockers (BL-01..BL-07):**
- Issue: Authentication and authorization gaps on newly-introduced artifact endpoints
- Files: `app/main.py:173-178`, `app/routers/agents.py:515-839`
- Impact: Any valid `X-Api-Key` bypasses proper auth; new endpoints skip per-user/per-org authorization; potential IDOR on artifact access
- Fix approach: Implement proper JWT validation on all `/api/agents/artifacts/*` endpoints; add ownership checks before artifact read/promote/delete operations

**X-Api-Key Middleware Accepts Any Value:**
- Issue: `X-Api-Key` middleware accepts any non-empty string as valid authentication
- Files: `app/main.py:214-220`
- Impact: Test auth strategy leaks into production code; no actual key validation
- Fix approach: Implement proper API key validation against stored keys or remove `X-Api-Key` path entirely in favor of JWT-only auth

**WebSocket Auth Bypass:**
- Issue: WebSocket endpoint performs no auth validation before accepting connections
- Files: `app/routers/agents.py:356-446`
- Impact: Unauthorized users could connect to agent sessions
- Fix approach: Validate JWT or session token during WebSocket handshake before accepting connection

**Missing GSD Artifacts (v1.0 Phases 1-7):**
- Issue: No VERIFICATION.md, SUMMARY.md, or VALIDATION.md for early phases
- Files: `.planning/phases/01-*` through `.planning/phases/07-*`
- Impact: Phase work was executed without GSD verification gates; no Nyquist validation
- Fix approach: Run `/gsd-validate-phase` for each phase retroactively (low priority — phases shipped)

**Frontend `any` Type Usage:**
- Issue: Extensive use of TypeScript `any` type defeats type safety
- Files: `frontend/src/features/workspace/hooks/useWorkspaceMutations.tsx:7-350` (40+ occurrences), `frontend/src/pages/AgentDesignerCanvasPage.tsx:318,364,384,516`
- Impact: Runtime errors not caught at compile time; refactoring risk
- Fix approach: Define proper interfaces for organization, team, member, and invite types; replace `any` with typed generics

**ESLint Disable Comments:**
- Issue: Multiple `eslint-disable-next-line` comments suppressing hook dependency warnings
- Files: `frontend/src/pages/ChatPage.tsx:99`, `frontend/src/features/chat/components/NewChatDialog.tsx:84`, `frontend/src/features/tools/views/ToolsConsoleView.tsx:160`
- Impact: Potential stale closure bugs or infinite re-renders
- Fix approach: Audit each suppressed rule; fix dependency arrays or extract callbacks properly

**Pre-existing Unit Test Failures:**
- Issue: 10 failing legacy tests in `tests/unit/` for V1 orchestrator/registry
- Files: `tests/unit/test_executor.py`, `tests/unit/test_registry_loader.py` (and others)
- Impact: CI may pass due to selective test runs; regressions go unnoticed
- Fix approach: Address root causes or remove obsolete tests as part of M2

**Mock Mode Dependency:**
- Issue: Tools default to mock mode (`SYNQLAB_MOCK_TOOLS=true`) returning simulated data
- Files: `synqlab/agent/tools/protein_folding.py`, `synqlab/agent/tools/sequence_generation.py`
- Impact: No test validates actual compute backend connectivity (OmegaFold, FoldX, etc.)
- Fix approach: Add integration tests that run with `SYNQLAB_MOCK_TOOLS=false` against containerized backends

**Editable Install Gap:**
- Issue: Alembic CLI not available via normal venv activation; requires manual `PYTHONPATH` workaround
- Files: `.venv/`, `requirements.txt`
- Impact: Migration commands fail without workaround; onboarding friction
- Fix approach: Run `pip install -e .[dev]` or add alembic to dev dependencies properly

## Known Bugs

**Cancel Session Race Condition:**
- Symptoms: `cancel_session` endpoint aborts engine before authorization check completes
- Files: `app/routers/agents.py:236-256`
- Trigger: Concurrent cancel request while auth middleware still processing
- Workaround: None — low impact since abort is the intended action

**ChatDropZone Single File Handling:**
- Symptoms: Only the first file is processed when multiple files are dragged onto chat input
- Files: `frontend/src/features/agent/components/ChatDropZone.tsx:60-65`
- Trigger: Drag multiple files at once
- Workaround: Drag files one at a time

**ArtifactViewer Single Expanded Content:**
- Symptoms: Expanding one artifact collapses the previously expanded one globally
- Files: `frontend/src/features/agent/components/ArtifactViewer.tsx:33-49`
- Trigger: Click expand on artifact A, then artifact B
- Workaround: View artifacts sequentially

**AgentDatasetsPage Silent Errors:**
- Symptoms: API fetch errors are swallowed silently with no user feedback
- Files: `frontend/src/pages/AgentDatasetsPage.tsx:31-56,67-90`
- Trigger: Network failure or 4xx/5xx response
- Workaround: Check browser console for errors

## Security Considerations

**Artifact Endpoint IDOR Risk:**
- Risk: Users can potentially access artifacts from other sessions/projects by guessing artifact_id
- Files: `app/routers/agents.py:515-627` (list/get), `:732-792` (promote)
- Current mitigation: Scope-based visibility logic exists but no per-user ownership validation
- Recommendations: Add `created_by` check for session-scoped artifacts; validate `org_id` membership for project-scoped

**Promote Endpoint Trust Boundary:**
- Risk: promote endpoint trusts source-session derived project_id without validating caller owns that project
- Files: `app/routers/agents.py:732-784`
- Current mitigation: None — functional copy semantics work correctly
- Recommendations: Validate caller has write access to target project before promotion

**Path Traversal Risk (Defensive):**
- Risk: `ctx.session_id` used in file paths could enable directory traversal if malformed
- Files: `synqlab/agent/tools/_persist.py:99,101-103`
- Current mitigation: Session IDs are UUIDs today; code relies on well-formedness
- Recommendations: Add explicit UUID validation before path construction

**Scope Constraint Violation:**
- Risk: `scope='session'` with falsy `ctx.session_id` would violate CHECK constraint on insert
- Files: `synqlab/agent/tools/_persist.py:98-99,121,144`
- Current mitigation: Production callers always populate `ctx.session_id`
- Recommendations: Add `ValueError` guard at persist_artifact entry point

**Mutations Input Not Validated:**
- Risk: `mutations` parameter in stability_analysis not regex-validated; could contain shell metacharacters
- Files: `synqlab/agent/tools/stability_analysis.py:47-49`
- Current mitigation: FoldX service presumably handles input validation
- Recommendations: Add regex validation for expected mutation format (e.g., `[A-Z]\d+[A-Z]`)

## Performance Bottlenecks

**Large Engine File Complexity:**
- Problem: `engine.py` is 572 lines with embedded system prompts, event loop, and tool dispatch
- Files: `synqlab/agent/engine.py`
- Cause: Monolithic design combining multiple responsibilities
- Improvement path: Extract system prompts to separate module; extract tool dispatch to dedicated class

**Per-Session Budget Tracking Only:**
- Problem: `BudgetTracker` operates per-session; no org-level monthly aggregation
- Files: `synqlab/agent/budget.py`
- Cause: Original design focused on single-session limits
- Improvement path: Add `get_org_usage()` endpoint with DB aggregation across sessions (EVAL-REVIEW G3)

**No Cross-Session Latency Dashboard:**
- Problem: Latency stats exist per-session but no cross-session p95 aggregation
- Files: `synqlab/agent/engine.py:297-299` (thresholds), `engine.llm_latencies/tool_latencies`
- Cause: Metrics stay in-memory; no persistence or aggregation layer
- Improvement path: Depends on Arize Phoenix integration (EVAL-REVIEW G1)

**Auth Service DB Patterns:**
- Problem: Multiple unbatched queries for org membership operations
- Files: `synqlab/auth/service.py:106-135,229-276`
- Cause: Sequential query pattern for list + filter operations
- Improvement path: Consider eager loading or batch queries for high-traffic paths

## Fragile Areas

**Agent Engine Core Loop:**
- Files: `synqlab/agent/engine.py:300-450` (estimated)
- Why fragile: Combines streaming, tool dispatch, budget tracking, guardrails, and autonomy mode logic
- Safe modification: Write unit tests for any touched path; use integration tests for full flow
- Test coverage: 5 engine tests exist but don't cover all branches

**Frontend Workspace Hooks:**
- Files: `frontend/src/features/workspace/hooks/useWorkspaceMutations.tsx`
- Why fragile: 40+ uses of `any` type; callback closures over mutable state
- Safe modification: Add TypeScript interfaces before refactoring; test each mutation path
- Test coverage: No frontend tests exist

**Persist Helper Session/Scope Logic:**
- Files: `synqlab/agent/tools/_persist.py:85-160`
- Why fragile: Scope-dependent path construction relies on ctx fields being present
- Safe modification: Add explicit validation; check unit tests cover all scope combinations
- Test coverage: 3 unit tests in `test_persist_helper.py`

**OmegaFold Adapter Error Handling:**
- Files: `synqlab/adapters/omegafold.py`
- Why fragile: 8 try/except blocks with varied exception handling strategies
- Safe modification: Consolidate error handling; ensure all paths log appropriately
- Test coverage: Unit tests exist but may not cover all failure modes

## Scaling Limits

**SQLite for Local Development:**
- Current capacity: Single-user, low concurrency
- Limit: Concurrent writes will block; file locking issues at scale
- Scaling path: Switch to Postgres for any multi-user or production deployment (supported via `DATABASE_URL`)

**In-Memory Session State:**
- Current capacity: Works for single-instance deployment
- Limit: No shared state between multiple app instances
- Scaling path: Persist session state to Redis or DB for horizontal scaling

## Dependencies at Risk

**OpenAI SDK Version Pinning:**
- Risk: `openai` package version may lag behind API changes
- Impact: New model features unavailable; potential breaking changes on upgrade
- Migration plan: Monitor OpenAI changelog; test upgrades in staging

**FastAPI/Pydantic Compatibility:**
- Risk: Pydantic v2 migration may introduce breaking changes
- Impact: Model validation behavior may change
- Migration plan: Lock versions; test thoroughly before upgrading

## Missing Critical Features

**Production Observability (Phase 9 Deferred):**
- Problem: No distributed tracing, no production metrics dashboard
- Blocks: Cannot debug production issues; no visibility into agent behavior at scale

**Arize Phoenix Integration:**
- Problem: Planned tracing tool not installed or integrated
- Blocks: EVAL-REVIEW G1 gap; no session-level traces for debugging

**Org-Level Usage Aggregation:**
- Problem: No `get_org_usage()` endpoint for monthly cost tracking
- Blocks: Cannot enforce org-level budgets; no billing visibility

**Session Completion Tracking:**
- Problem: No `outcome` field on `agent_sessions` table
- Blocks: Cannot compute session completion rate metrics

**Skill Marketplace (REQ-14):**
- Problem: Skills are bundled only; no community contribution mechanism
- Blocks: Users cannot share or discover custom skills

**Agent Memory (REQ-15):**
- Problem: No cross-session learning or memory persistence
- Blocks: Each session starts fresh; no accumulated context

## Test Coverage Gaps

**No E2E Browser Tests:**
- What's not tested: Full UI interaction flows (chat, drag-drop, navigation)
- Files: `frontend/src/features/agent/*`, `frontend/src/pages/*`
- Risk: UI regressions unnoticed; broken user flows shipped
- Priority: High (blocks UI confidence)

**No Concurrency Stress Test:**
- What's not tested: Multiple simultaneous agent sessions under load
- Files: `synqlab/agent/engine.py`, `synqlab/agent/task.py`
- Risk: Race conditions, deadlocks, or resource exhaustion in production
- Priority: Medium (REQ-07 partial verification gap)

**No Full API-to-DB Roundtrip Test:**
- What's not tested: REST API → WebSocket → Engine → Tool → Artifact persistence
- Files: Full stack integration
- Risk: Integration bugs between layers go unnoticed
- Priority: High (E2E flow gap from v1.0 audit)

**Integration Tests Require Runtime Dependencies:**
- What's not tested: Tests in `tests/test_artifact_*.py`, `tests/test_bundled_ingest.py`
- Files: Tests exist but skip due to missing `fastapi`/`bcrypt`/`python-jose` in some environments
- Risk: Tests pass locally but fail in CI or vice versa
- Priority: Medium (environment consistency)

**Visual Regression for Pipeline Editor:**
- What's not tested: Drag-and-drop interactions, node/edge rendering
- Files: `frontend/src/pages/AgentDesignerCanvasPage.tsx`
- Risk: UI breaks in layout or interaction go unnoticed
- Priority: Low (designer is secondary path)

**No Eval Harness `--live` Validation:**
- What's not tested: Eval scripts against real OpenAI API
- Files: `evals/eval_tool_selection.py`, `evals/eval_workflows.py`
- Risk: Eval results may not reflect production behavior
- Priority: Medium (EVAL-REVIEW G5)

---

*Concerns audit: 2026-05-02*
