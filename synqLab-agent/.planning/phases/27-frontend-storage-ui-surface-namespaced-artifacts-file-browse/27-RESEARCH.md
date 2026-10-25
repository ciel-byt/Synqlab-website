# Phase 27: Frontend Storage UI — Research

**Date:** 2026-05-07
**Mode:** Implementation research (codebase-focused)
**Confidence:** High — all code inspected, no external dependencies needed

---

## Standard Stack

This phase uses **only existing dependencies** — no new libraries required.

| Domain | Stack | Already installed |
|--------|-------|-------------------|
| Chat inline rendering | React + existing Shadcn components (`Card`, `Badge`, `Button`) | ✅ |
| File browser tree | Plain React + recursive component (no tree lib needed — namespace depth is max 2-3 levels) | ✅ |
| Backend browse API | FastAPI + `pathlib` for directory listing, `os.scandir` for perf | ✅ |
| Download endpoint | FastAPI `FileResponse` + `Content-Disposition: attachment` | ✅ |
| Route restructuring | React Router v6 (`<Route>` nesting, already used) | ✅ |

**Don't add:** react-arborist, react-treeview, or any tree library — the namespace structure is flat (7 top-level namespaces, each with files or 1-level subdirectories). A recursive `<StorageNode>` component is simpler and more maintainable.

---

## Architecture Patterns

### 1. Inline Tool Calls — Message-Anchored Rendering

**Current architecture (right panel):**
- `useAgentSession.toolCalls` is a `Map<string, ToolCallState>` — keyed by tool_call_id
- `tool_use_start` events attach the tool call to the **most recent assistant message** via `setMessages()` splice (lines 290-308 of `useAgentSession.ts`)
- The right panel reads from `allToolCalls = Array.from(toolCalls.values())` — a flat list with no per-message grouping

**Pattern for inline rendering:**
- Assistant messages already carry `msg.tool_calls[]` (attached by `tool_use_start` handler and `reconstructToolCalls`)
- Render tool call cards **immediately after** each assistant message that has `msg.tool_calls`
- Look up each `tool_call.id` in the `toolCalls` Map to get status/result
- This naturally groups tool calls per Q&A turn (fixes the ordering bug from CONTEXT.md D-04)

```tsx
{messages.map((msg) => {
  if (msg.role === 'tool') return null
  return (
    <Fragment key={msg.id}>
      <MessageBubble msg={msg} />
      {/* Inline tool call cards — anchored to this turn */}
      {msg.tool_calls?.map((tc) => {
        const state = toolCalls.get(tc.id)
        return state ? <InlineToolCard key={tc.id} toolCall={state} /> : null
      })}
      {/* Inline artifact chips — for artifacts produced by this turn's tools */}
      {msg.tool_calls?.map((tc) => {
        const state = toolCalls.get(tc.id)
        if (!state?.result?.artifact_id) return null
        const art = artifacts.find(a => a.id === state.result.artifact_id)
        return art ? <InlineArtifactChip key={art.id} artifact={art} sessionId={sessionId} /> : null
      })}
    </Fragment>
  )
})}
```

**Key insight:** The `tool_use_start` handler already attaches tool calls to assistant messages. The data model is already correct — only the rendering location needs to change (from sidebar to inline).

### 2. Storage Browse API — Hybrid Endpoint

**Pattern:** Single `GET /api/storage/browse` endpoint that:
1. Lists filesystem directories/files under `SYNQLAB_ARTIFACT_DIR`
2. Enriches entries with DB metadata when available (via `AgentArtifact.file_path` matching)

```python
@app.get("/api/storage/browse")
async def browse_storage(
    namespace: str = "",  # e.g. "folding", "sessions"
    path: str = "",       # relative path within namespace
):
    root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))
    target = root / namespace / path if namespace else root
    
    # Security: prevent path traversal
    target = target.resolve()
    if not str(target).startswith(str(root.resolve())):
        raise HTTPException(403, "Access denied")
    
    entries = []
    for entry in sorted(target.iterdir()):
        entries.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else None,
            "modified": entry.stat().st_mtime,
            "path": str(entry.relative_to(root)),
        })
    return {"entries": entries, "namespace": namespace, "path": path}
```

**Security critical:** Always resolve paths and check they stay within `root` to prevent directory traversal attacks.

### 3. Tab Restructuring — React Router Nesting

**Current route tree:**
```
/lab/agents/          → AgentsLayout
  /console            → AgentsConsoleLayout → AgentConsoleView
  /designer           → AgentsHub
  /designer/:id       → AgentDesignerCanvasPage
  /datasets           → AgentDatasetsPage
/lab/skills           → SkillsPage (STANDALONE — to be moved)
```

**Target route tree:**
```
/lab/agents/          → AgentsLayout
  /console            → AgentsConsoleLayout → AgentConsoleView
  /designer           → AgentsHub
  /designer/:id       → AgentDesignerCanvasPage
  /datasets           → AgentDatasetsPage (refactored as StorageBrowser)
  /skills             → SkillsPage (MOVED from /lab/skills)
```

Changes in `App.tsx`:
- Add: `<Route path="skills" element={<SkillsPage />} />` inside the agents block
- Keep: `<Route path="skills" element={<Navigate to="/lab/agents/skills" replace />} />` at `/lab/skills` for backward compat
- Rename "Datasets" → "Storage" in nav labels

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| File download | `FileResponse` (FastAPI built-in) | Handles Content-Disposition, MIME types, streaming |
| Path traversal prevention | `Path.resolve()` + prefix check | Standard pattern, don't use regex |
| Tree component | Recursive `<StorageNode>` + CSS indent | Don't add a tree library for 2-level depth |
| Inline markdown links | Existing `<MarkdownContent>` component | Already renders links — add custom renderer for artifact:// protocol if needed |

### Mandatory Component Reuse

**Use the existing shadcn UI + shared blocks. Do NOT create custom equivalents.**

| Need | Use This | Location |
|------|----------|----------|
| File/folder tree expand/collapse | `<Collapsible>` | `components/ui/collapsible.tsx` |
| Breadcrumb navigation | `<Breadcrumb>` | `components/ui/breadcrumb.tsx` |
| File listing table | `<Table>` | `components/ui/table.tsx` |
| Type/status indicators | `<Badge>` | `components/ui/badge.tsx` |
| File cards | `<EntityCard>` | `components/ui/entity-card.tsx` (has `layout="horizontal"`, icon letter+color) |
| Empty namespace state | `<EmptyState>` | `components/blocks/EmptyState.tsx` |
| Page titles | `<PageHeader>` | `components/blocks/PageHeader.tsx` |
| Loading skeletons | `<Skeleton>`, `<ListSkeleton>` | `components/ui/skeleton.tsx`, `components/blocks/ListSkeleton.tsx` |
| Scrollable panels | `<ScrollArea>` | `components/ui/scroll-area.tsx` |
| Tab switching (if needed) | `<Tabs>` | `components/ui/tabs.tsx` |
| Tool call detail expand | `<Collapsible>` or `<Card>` | `components/ui/collapsible.tsx`, `components/ui/card.tsx` |
| Preview modals | `<Dialog>` / `<Sheet>` | `components/ui/dialog.tsx`, `components/ui/sheet.tsx` |
| Markdown rendering | `<MarkdownContent>` | `components/blocks/MarkdownContent.tsx` |
| Tooltips | `<Tooltip>` | `components/ui/tooltip.tsx` |

**Theme system:** All components use CSS variables from the theme (e.g., `bg-card`, `text-muted-foreground`, `border-border`). Use these tokens — don't hardcode colors. Dark mode works automatically via the `<ThemeProvider>`.

---

## Common Pitfalls

### P-01: Tool call ordering in chat (CRITICAL)
**Problem:** Tool calls rendered at end of chat instead of anchored to producing turn.
**Root cause:** Previous approach iterated `toolCalls.values()` (a flat Map) instead of reading `msg.tool_calls` per message.
**Fix:** Render tool cards after each `msg` using `msg.tool_calls` for grouping, `toolCalls.get(id)` for state.

### P-02: Duplicate artifact chips
**Problem:** Artifact chips appearing twice — once in tool call result, once in trailing artifact list.
**Fix:** Only render artifact chips for tool calls that have `result.artifact_id`, not from a separate `artifacts` array pass. The `artifacts` array is for the Storage page, not inline chat.

### P-03: Path traversal in browse endpoint
**Problem:** User could pass `../../etc/passwd` as the path parameter.
**Fix:** `Path.resolve()` the target and verify it starts with `root.resolve()`. Reject with 403 if not.

### P-04: File download for large files
**Problem:** Loading entire PDB/FASTA into memory for download.
**Fix:** Use `FileResponse` which streams the file. Don't `read_bytes()` first.

### P-05: Skills route change breaking bookmarks
**Problem:** Users with bookmarked `/lab/skills` get 404.
**Fix:** Keep old route as `<Navigate to="/lab/agents/skills" replace />`.

### P-06: Empty namespaces in tree
**Problem:** `sandbox/`, `sessions/` may be empty, showing bare folders.
**Fix:** Show empty state per namespace ("No artifacts yet"), not suppress empty folders — users need to know the namespace exists.

---

## Code Examples

### InlineToolCard component (new)
```tsx
function InlineToolCard({ toolCall }: { toolCall: ToolCallState }) {
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = toolCall.isRunning ? Loader2 
    : toolCall.success ? CheckCircle2 : XCircle
  const statusColor = toolCall.isRunning ? 'text-blue-500 animate-spin'
    : toolCall.success ? 'text-emerald-500' : 'text-rose-500'

  return (
    <div className="my-1.5 ml-11 rounded-md border border-border/40 bg-card/50">
      <button onClick={() => setExpanded(!expanded)} 
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs">
        {expanded ? <ChevronDown .../> : <ChevronRight .../>}
        <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
        <span className="font-mono text-[11px]">{toolCall.name}</span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2 bg-muted/10">
          {/* input/output JSON */}
        </div>
      )}
    </div>
  )
}
```

### StorageBrowser component (new)
```tsx
function StorageBrowser() {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<StorageEntry[]>([])
  
  useEffect(() => {
    api.browseStorage(currentPath).then(setEntries)
  }, [currentPath])

  return (
    <div>
      <Breadcrumb path={currentPath} onNavigate={setCurrentPath} />
      {entries.map(entry => (
        <StorageNode key={entry.name} entry={entry} 
          onClick={() => entry.is_dir 
            ? setCurrentPath(entry.path)
            : handlePreviewOrDownload(entry)} 
        />
      ))}
    </div>
  )
}
```

### Browse API endpoint
```python
@app.get("/api/storage/browse")
async def browse_storage(namespace: str = "", path: str = ""):
    root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))
    target = (root / namespace / path) if namespace else root
    target = target.resolve()
    if not str(target).startswith(str(root.resolve())):
        raise HTTPException(403, "Path traversal denied")
    if not target.is_dir():
        raise HTTPException(404, f"Not a directory: {namespace}/{path}")
    
    entries = []
    for entry in sorted(target.iterdir()):
        stat = entry.stat()
        entries.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": stat.st_size if entry.is_file() else None,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "path": str(entry.relative_to(root)),
        })
    return {"entries": entries, "namespace": namespace, "path": path}
```

---

## Existing Code Integration Map

| Component | Current State | Phase 27 Change |
|-----------|--------------|-----------------|
| `AgentChat.tsx` (351 lines) | Has `showRightPanel` state + 320px sidebar | Remove lines 249-347 (right panel), add inline rendering after each message |
| `InlineArtifactChip.tsx` (149 lines) | Exists, unused, fully functional | Activate — import and render per-turn after tool cards |
| `useAgentSession.ts` (421 lines) | `reconstructToolCalls` already attaches TCs to messages | No changes needed — data model already supports inline |
| `AgentDatasetsPage.tsx` (140 lines) | Calls `api.listDatasets(projectId)` which returns empty | Replace with `StorageBrowser` calling new `api.browseStorage()` |
| `SkillsPage.tsx` (435 lines) | Standalone at `/lab/skills` | Move route to `/lab/agents/skills`, add redirect |
| `App.tsx` routes (134 lines) | Line 106: `<Route path="skills" .../>` under `/lab` | Move into agents block, keep redirect |
| `api/client.ts` | Has `listArtifacts`, `listDatasets`, `promoteArtifact` | Add `browseStorage(path)`, `downloadStorageFile(path)` |
| `app/main.py` | Has `GET /api/artifact?path=` for file serving | Add `GET /api/storage/browse`, `GET /api/storage/download` |
| `ArtifactViewer.tsx` (164 lines) | Used only in right sidebar | Can be repurposed as a detail panel in StorageBrowser, or deprecated |
| `AgentTaskTree.tsx` | Used only in right sidebar | Deprecated (per D-07) |

---

## Files Touched (estimated)

### Backend (2 files)
- `app/main.py` — Add `/api/storage/browse` and `/api/storage/download` endpoints
- No router extraction needed — mount directly on `app` like existing `/api/artifact`

### Frontend (8 files)
- `features/agent/components/AgentChat.tsx` — Remove right panel, add inline rendering
- `features/agent/components/InlineToolCard.tsx` — New component (extract from sidebar tool card)
- `features/agent/components/InlineArtifactChip.tsx` — Activate (already exists, no major changes)
- `pages/AgentDatasetsPage.tsx` — Replace with StorageBrowser
- `features/agent/components/StorageBrowser.tsx` — New component
- `pages/SkillsPage.tsx` — No changes (just route move)
- `App.tsx` — Route restructuring
- `api/client.ts` — Add `browseStorage`, `downloadStorageFile` methods

---

*Research complete. All patterns verified against existing codebase. No external dependencies needed.*
