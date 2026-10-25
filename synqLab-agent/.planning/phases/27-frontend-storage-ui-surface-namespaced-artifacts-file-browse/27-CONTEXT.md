# Phase 27: Frontend Storage UI — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate the frontend storage and artifact experience into a coherent UI. Three workstreams:

1. **Chat layout restructure** — Remove the agent chat right sidebar panel; render tool calls and artifacts inline in the chat stream
2. **Storage/Datasets page** — Wire the existing Datasets page to a full namespace file browser backed by the namespaced storage layout from Phase 24-25
3. **Tab reorganization** — Move Skills into the Agent tab; move PDB samples into the Storage/Datasets page

The brightness-svc model path bug is **resolved** (user retrained model) — not in scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Chat Layout Restructure
- **D-01:** Remove the right sidebar panel entirely from `AgentChat.tsx` (the 320px `showRightPanel` div with tool calls, tasks, artifacts sections)
- **D-02:** Tool calls render as collapsible cards inline in the chat message flow — each tool invocation appears as a compact card (name, status icon, expand for input/output) positioned chronologically in the message stream
- **D-03:** Artifacts render as inline chips after tool results — refactor `InlineArtifactChip.tsx` (currently unused) to serve this purpose
- **D-04:** **Chip ordering bug fix required** — previous implementation had chips appearing above new messages or bunching at the end regardless of which Q&A turn they belonged to. Fix: anchor artifact chips to the specific tool call / Q&A turn that produced them, not at the end of the entire message stream
- **D-05:** Per-question grouping — for each Q&A turn, keep all artifact references at the end of that turn's response block
- **D-06:** Support inline text references within assistant messages — artifact links can appear as clickable refs (link, modal preview) within markdown content, not just as trailing chips
- **D-07:** Task tree is removed from the sidebar (it was a right-panel-only concept). If task state visualization is needed later, it's a separate phase

### Storage/Datasets Page
- **D-08:** Datasets page becomes a full namespace file browser with tree view showing namespace folders: `sessions/`, `pipelines/`, `folding/`, `candidates/`, `foldx/`, `sandbox/`, `bundled/`
- **D-09:** Hybrid data source — DB-tracked artifacts as primary source (provides metadata: type, scope, session association, timestamps), supplemented by filesystem scanning for namespace tree completeness. Some files (pipeline JSONs, FoldX scratch outputs) may exist on disk without corresponding DB rows — the tree view shows what's actually on disk, artifact detail cards pull metadata from DB when available
- **D-10:** PDB sample files (currently `scope=global` in the agent sidebar) move to the Storage/Datasets page as part of the `bundled/` namespace tree

### Tab Reorganization
- **D-11:** Skills become a sub-tab inside the Agents section (`/lab/agents/skills`), not a standalone `/lab/skills` route
- **D-12:** The existing `SkillBrowser` and `SkillCard` components are reused and nested under the Agents layout
- **D-13:** Remove `/lab/skills` route and add `/lab/agents/skills` route in its place

### Agent's Discretion
- Data source implementation details (how to efficiently merge DB metadata with filesystem listings) — agent picks best approach during planning
- Specific inline chip styling and expand/collapse micro-interactions — agent discretion
- Whether the namespace tree uses lazy-loading or eager scan — agent picks based on expected artifact volume

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Storage Backend (Phase 24-25 outputs)
- `synqlab/storage/artifact_paths.py` — Source of truth for namespace constants and `build_agent_artifact_path()` helper
- `.planning/phases/25-writer-migration/25-CONTEXT.md` — Writer migration decisions (path patterns locked)

### Chat Components (modify)
- `frontend/src/features/agent/components/AgentChat.tsx` — Main chat with right sidebar to remove (lines 249-347)
- `frontend/src/features/agent/components/ArtifactViewer.tsx` — Current sidebar artifact viewer (will be decomposed into inline elements)
- `frontend/src/features/agent/components/InlineArtifactChip.tsx` — Unused inline chip component to refactor and activate
- `frontend/src/features/agent/components/AgentTaskTree.tsx` — Task tree to remove from sidebar
- `frontend/src/features/agent/hooks/useAgentSession.ts` — Provides `artifacts`, `toolCalls`, `tasks` state

### Storage/Datasets Page
- `frontend/src/pages/AgentDatasetsPage.tsx` — Existing datasets page to transform into namespace file browser
- `frontend/src/api/client.ts` — API client to extend with `browseStorage()` method

### Backend Artifact Endpoints
- `app/main.py` lines 860-920 — `GET /api/artifact?path=` file serving endpoint
- `app/routers/agents.py` — Artifact CRUD endpoints (`listArtifacts`, `getArtifact`)

### Routing and Tab Structure
- `frontend/src/App.tsx` — Route definitions (line 95-109 for Agent routes, line 106 for Skills route)
- `frontend/src/pages/SkillsPage.tsx` — Standalone skills page to move under Agents
- `frontend/src/features/agent/components/SkillBrowser.tsx` — Reusable skill browser component
- `frontend/src/features/agent/components/SkillCard.tsx` — Reusable skill card component

### Requirements
- `.planning/REQUIREMENTS.md` — v1.2 artifact segmentation requirements (SEG-01 through SEG-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InlineArtifactChip` (5.7KB): Already has download/preview logic for inline display — needs ordering fix and activation
- `ArtifactViewer` (6.5KB): Has scope-based grouping (session/project/global) with type badges — can inform the file browser's metadata display
- `SkillBrowser` + `SkillCard`: Self-contained components, can be moved under Agents layout with no changes
- `ChatDropZone`: File upload drag-and-drop — stays in chat (independent of sidebar removal)
- `PageSidebar`: Existing collapsible sidebar pattern for the left nav — Datasets page can use `ModularPageLayout`

### Established Patterns
- Shadcn UI components (`Card`, `Badge`, `Button`) used throughout — continue using
- `api/client.ts` uses `axios` with typed response wrappers — new endpoints follow same pattern
- Agent routes use `AgentsLayout` → `AgentsConsoleLayout` nesting — Skills sub-tab fits naturally as a sibling to `console`, `designer`, `datasets`

### Integration Points
- New `GET /api/storage/browse` endpoint needed in `app/main.py` or new router
- `useAgentSession` hook already tracks `toolCalls` Map and `artifacts` array — inline rendering can consume these directly
- `AgentChat.tsx` message rendering loop (lines 90-126) is where inline tool calls + artifact chips get inserted

</code_context>

<specifics>
## Specific Ideas

- Artifact chips should be anchored per Q&A turn — user explicitly flagged the ordering bug where chips migrated to the top or bottom of the entire chat
- Support both trailing chips (after tool result) AND inline text references (clickable links/modals within markdown) — two distinct affordances
- The namespace tree should match the backend constants exactly: `SESSIONS`, `PIPELINES`, `FOLDING`, `CANDIDATES`, `FOLDX`, `SANDBOX`, `BUNDLED`

## Repo Storage Fragmentation (scan 2026-05-07)

The backend was segmented (Phase 24-25) but the repo still has scattered storage directories. The file browser and any cleanup work should be aware of:

| Path | Status | Files | Notes |
|------|--------|-------|-------|
| `data/agent_artifacts/bundled/` | ✅ Active (namespaced) | 4 | PDB samples |
| `data/agent_artifacts/candidates/` | ✅ Active | 6 | |
| `data/agent_artifacts/folding/` | ✅ Active | 8 | |
| `data/agent_artifacts/foldx/` | ✅ Active | 15 | |
| `data/agent_artifacts/pipelines/` | ✅ Active | 3 | |
| `data/agent_artifacts/sandbox/` | ✅ Active | 0 | |
| `data/agent_artifacts/brightness_models/` | ✅ Active | 3 | Training output |
| `data/agent_artifacts/training_datasets/` | ✅ Active | 2 | Uploaded datasets |
| `data/agent_artifacts/pipeline_runs/` | ⚠️ Legacy | 6 | Old name — Phase 25 renamed to `pipelines/` |
| `artifacts/` | ⚠️ Legacy root-level | 1 | Experiment-level artifacts (separate concern) |
| `artifacts/foldx_0ab850bd/` etc. | ❌ Orphan | 0 | 4 empty old-layout FoldX dirs at repo root |
| `datasets/` | ⚠️ Root-level | 1 | Scattered training data |
| `data/training_datasets/` | ⚠️ Duplicate | 1 | Duplicate of `agent_artifacts/training_datasets/` |
| `data/pipelines/` | ⚠️ Empty | 0 | Stale empty directory |
| `resources/pdb_samples/` | Source | 4 | PDB files to surface in Storage |
| `models/` | Empty | 0 | Unused directory |

**Frontend implications:** The Storage browser should show `data/agent_artifacts/` as its root. Orphan directories and root-level legacy paths are a cleanup concern but don't need to be surfaced in the UI.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-Frontend Storage UI*
*Context gathered: 2026-05-07*
