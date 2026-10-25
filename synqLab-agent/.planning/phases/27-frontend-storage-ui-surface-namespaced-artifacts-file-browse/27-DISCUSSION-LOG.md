# Phase 27: Frontend Storage UI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 27-frontend-storage-ui
**Areas discussed:** Chat layout restructure, Storage/Datasets page scope, Tab reorganization

---

## Chat Layout Restructure

| Option | Description | Selected |
|--------|-------------|----------|
| Keep right sidebar | Maintain current 320px panel for tool calls, tasks, artifacts | |
| Remove sidebar → inline | Tool calls as collapsible cards, artifacts as inline chips in chat stream | ✓ |
| Hybrid (collapsed sidebar + inline highlights) | Keep sidebar but default collapsed, show key items inline | |

**User's choice:** Remove sidebar entirely, render everything inline
**Notes:** User confirmed:
- Tool calls → collapsible cards inline in message flow
- Artifacts → inline chips after tool results (refactor existing unused `InlineArtifactChip`)
- Task tree → removed (not needed)
- **Critical bug fix:** Previous `InlineArtifactChip` implementation had ordering issues — chips appeared above new messages or bunched at end regardless of which Q&A turn produced them. Fix: anchor per Q&A turn
- Support both trailing chips AND inline text references (links, modals) within markdown content

---

## Storage/Datasets Page Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Flat artifact list | Keep current tabular list filtered by type | |
| Full namespace file browser | Tree view with folders for each namespace (sessions/, folding/, etc.) | ✓ |
| Card grid with filters | Visual card layout with namespace filter chips | |

**User's choice:** Full namespace file browser with tree view

| Option | Description | Selected |
|--------|-------------|----------|
| DB-tracked artifacts only | Only show artifacts with database metadata rows | |
| Filesystem only | Scan directories directly, no DB metadata | |
| Hybrid (DB primary + filesystem scan) | DB for metadata, filesystem for tree completeness | ✓ |

**User's choice:** Asked "what's best practice?" — agent recommended hybrid approach (DB primary for metadata, filesystem scan for completeness since some files lack DB rows). User accepted.

---

## Tab Reorganization

| Option | Description | Selected |
|--------|-------------|----------|
| Skills as standalone `/lab/skills` | Keep current separate route | |
| Skills as Agent sub-tab | Move to `/lab/agents/skills` nested under Agents layout | ✓ |
| Skills in Storage | Treat skills as files, show in Datasets/Storage browser | |

**User's choice:** Skills become a sub-tab under Agents (`/lab/agents/skills`)

| Option | Description | Selected |
|--------|-------------|----------|
| PDB samples in Agent sidebar | Keep in global scope artifacts (current) | |
| PDB samples in Storage/Datasets | Show under `bundled/` namespace in file browser | ✓ |
| PDB samples in dedicated section | New "Samples" area | |

**User's choice:** PDB samples move to Storage page (under `bundled/` namespace)

---

## Agent's Discretion

- Data source implementation details (merging DB metadata with filesystem listings)
- Inline chip styling and micro-interactions
- Namespace tree lazy-loading vs eager scan strategy

## Deferred Ideas

None — discussion stayed within phase scope
