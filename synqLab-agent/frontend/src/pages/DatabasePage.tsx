import { useEffect, useMemo, useRef, useState } from 'react'
import { Database, GitBranch, PanelRightOpen, RefreshCw, Table2, ZoomIn, ZoomOut } from 'lucide-react'
import { api } from '@/api/client'
import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { Button } from '@/components/ui/button'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'

type TableSummary = { name: string; row_count: number }
type ColumnSchema = { name: string; type: string; nullable: boolean; primary_key: boolean }
type TableDetail = { name: string; columns: ColumnSchema[]; row_count: number }
type SchemaMap = {
  tables: Array<{ name: string; columns: ColumnSchema[] }>
  relationships: Array<{ from_table: string; from_column: string; to_table: string; to_column: string }>
}
type DiagramPosition = { x: number; y: number }
type Palette = {
  groupText: string
  groupDot: string
  selectedBg: string
  selectedText: string
  selectedCount: string
  borderAccent: string
  softBg: string
  hoverBg: string
}

const GROUPS: Array<{ name: string; matcher: (table: string) => boolean }> = [
  { name: 'Identity', matcher: t => ['users', 'organizations', 'org_members', 'org_invitations', 'api_keys'].includes(t) },
  { name: 'Teams', matcher: t => ['teams', 'team_members', 'user_groups', 'user_group_members'].includes(t) },
  { name: 'Projects', matcher: t => ['projects', 'project_members'].includes(t) },
  { name: 'Pipelines', matcher: t => ['pipelines', 'pipeline_versions'].includes(t) },
  { name: 'Runs', matcher: t => ['runs', 'candidates', 'tool_runs', 'artifacts', 'experiments', 'artifact_tags'].includes(t) },
  { name: 'Datasets', matcher: t => ['datasets', 'dataset_entries', 'dataset_access_log'].includes(t) },
  { name: 'Publications', matcher: t => ['publications', 'pub_authors', 'pub_runs', 'pub_candidates', 'pub_datasets', 'pub_reviews'].includes(t) },
  { name: 'Collaboration', matcher: t => ['tags', 'resource_tags', 'comments', 'sharing_tokens'].includes(t) },
  { name: 'People', matcher: t => ['user_connections'].includes(t) },
  { name: 'Chat', matcher: t => ['chat_sessions', 'chat_messages'].includes(t) },
]

function groupTableName(name: string): string {
  const group = GROUPS.find(g => g.matcher(name))
  return group ? group.name : 'Other'
}

function groupPalette(group: string): Palette {
  const palettes: Record<string, Palette> = {
    Identity: {
      groupText: 'text-teal-700 dark:text-teal-300/80',
      groupDot: 'bg-teal-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Teams: {
      groupText: 'text-cyan-700 dark:text-cyan-300/80',
      groupDot: 'bg-cyan-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Projects: {
      groupText: 'text-violet-700 dark:text-violet-300/80',
      groupDot: 'bg-violet-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Pipelines: {
      groupText: 'text-sky-700 dark:text-sky-300/80',
      groupDot: 'bg-sky-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Runs: {
      groupText: 'text-emerald-700 dark:text-emerald-300/80',
      groupDot: 'bg-emerald-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Datasets: {
      groupText: 'text-amber-700 dark:text-amber-300/80',
      groupDot: 'bg-amber-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Publications: {
      groupText: 'text-rose-700 dark:text-rose-300/80',
      groupDot: 'bg-rose-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Collaboration: {
      groupText: 'text-fuchsia-700 dark:text-fuchsia-300/80',
      groupDot: 'bg-fuchsia-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    People: {
      groupText: 'text-teal-700 dark:text-teal-300/80',
      groupDot: 'bg-teal-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
    Chat: {
      groupText: 'text-blue-700 dark:text-blue-300/80',
      groupDot: 'bg-blue-500',
      selectedBg: 'bg-sidebar-accent',
      selectedText: 'text-sidebar-accent-foreground',
      selectedCount: 'text-muted-foreground',
      borderAccent: 'border-border',
      softBg: 'bg-muted/30',
      hoverBg: 'hover:bg-sidebar-accent/50',
    },
  }
  return palettes[group] ?? {
    groupText: 'text-foreground/80',
    groupDot: 'bg-muted-foreground',
    selectedBg: 'bg-sidebar-accent',
    selectedText: 'text-sidebar-accent-foreground',
    selectedCount: 'text-muted-foreground',
    borderAccent: 'border-border',
    softBg: 'bg-muted/30',
    hoverBg: 'hover:bg-sidebar-accent/50',
  }
}

function tableDescription(name: string): string {
  const map: Record<string, string> = {
    users: 'Platform identities with auth metadata.',
    organizations: 'Top-level workspaces for teams and projects.',
    org_members: 'User memberships and roles inside organizations.',
    org_invitations: 'Pending and accepted organization invites.',
    api_keys: 'Programmatic access credentials.',
    projects: 'Scoped research projects under organizations.',
    pipelines: 'Reusable workflow templates.',
    runs: 'Pipeline execution instances.',
    candidates: 'Generated candidate sequences/results per run.',
    tool_runs: 'Tool-level execution records and metadata.',
    artifacts: 'Stored output references for tool runs.',
    datasets: 'Curated data collections.',
    publications: 'Publication tracking and attribution.',
    tags: 'Organization-wide tag definitions.',
    resource_tags: 'Tag assignments to resources.',
    comments: 'Collaboration comment threads.',
    sharing_tokens: 'Time-limited sharing tokens for resources.',
    user_connections: 'Implicit network edges between collaborating users.',
    chat_sessions: 'LLM-powered chat session records.',
    chat_messages: 'Individual messages within chat sessions.',
  }
  return map[name] ?? 'Live table data from the connected database.'
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const DIAGRAM_CARD_WIDTH = 230
const DIAGRAM_GAP_X = 270
const DIAGRAM_GAP_Y = 170
const DIAGRAM_PADDING_X = 8
const DIAGRAM_PADDING_Y = 8

function buildInitialDiagramPositions(tables: SchemaMap['tables']): Record<string, DiagramPosition> {
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name))
  const columnsPerRow = 5
  const positions: Record<string, DiagramPosition> = {}
  for (const [index, table] of sorted.entries()) {
    const row = Math.floor(index / columnsPerRow)
    const col = index % columnsPerRow
    positions[table.name] = {
      x: DIAGRAM_PADDING_X + col * DIAGRAM_GAP_X,
      y: DIAGRAM_PADDING_Y + row * DIAGRAM_GAP_Y,
    }
  }
  return positions
}

function buildFocusedDiagramPositions(
  tables: SchemaMap['tables'],
  relationships: SchemaMap['relationships'],
  selectedTable: string | null,
): Record<string, DiagramPosition> {
  if (!selectedTable || tables.length === 0) {
    return buildInitialDiagramPositions(tables)
  }
  const centerX = 420
  const centerY = 260
  const radius = 240
  const tableNames = new Set(tables.map(t => t.name))
  const neighbors = new Set<string>()
  for (const rel of relationships) {
    if (rel.from_table === selectedTable && tableNames.has(rel.to_table)) neighbors.add(rel.to_table)
    if (rel.to_table === selectedTable && tableNames.has(rel.from_table)) neighbors.add(rel.from_table)
  }
  const orderedNeighbors = Array.from(neighbors).sort()
  const positions: Record<string, DiagramPosition> = {
    [selectedTable]: { x: centerX, y: centerY },
  }
  orderedNeighbors.forEach((name, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(orderedNeighbors.length, 1)
    positions[name] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    }
  })
  let spillRow = 0
  for (const table of tables) {
    if (positions[table.name]) continue
    positions[table.name] = {
      x: 40 + (spillRow % 4) * 260,
      y: 620 + Math.floor(spillRow / 4) * 150,
    }
    spillRow += 1
  }
  return positions
}

function columnsForDiagram(table: { name: string; columns: ColumnSchema[] }, schemaMap: SchemaMap): ColumnSchema[] {
  const fkCols = new Set(
    schemaMap.relationships.filter(r => r.from_table === table.name).map(r => r.from_column),
  )
  const keyCols = table.columns.filter(col => col.primary_key || fkCols.has(col.name))
  if (keyCols.length > 0) return keyCols.slice(0, 4)
  return table.columns.slice(0, 2)
}

export function DatabasePage() {
  const [tables, setTables] = useState<TableSummary[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [activeView, setActiveView] = useState<'rows' | 'diagram'>('rows')
  const [schemaMap, setSchemaMap] = useState<SchemaMap | null>(null)
  const [diagramError, setDiagramError] = useState<string | null>(null)
  const [diagramLoading, setDiagramLoading] = useState(false)
  const [diagramScope, setDiagramScope] = useState<'focused' | 'all'>('focused')
  const [zoom, setZoom] = useState(0.85)
  const [diagramPositions, setDiagramPositions] = useState<Record<string, DiagramPosition>>({})
  const [dragging, setDragging] = useState<{ table: string; offsetX: number; offsetY: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  async function loadTables(): Promise<void> {
    setLoading(true)
    try {
      const response = await api.dbListTables()
      const payload = response as unknown as TableSummary[]
      setTables(payload)
      setSelectedTable(prev => prev ?? payload[0]?.name ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database not connected')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables()
    const timer = window.setInterval(loadTables, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedTable) {
      setDetail(null)
      return
    }
    api.dbGetTable(selectedTable)
      .then((payload) => setDetail(payload as unknown as TableDetail))
      .catch(() => setDetail(null))
  }, [selectedTable])

  useEffect(() => {
    if (!selectedTable) {
      setRows([])
      setRowsError(null)
      return
    }

    setRowsLoading(true)
    api.dbGetRows(selectedTable)
      .then((payload) => {
        const rows = (payload as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? payload as unknown as Array<Record<string, unknown>>
        const rowsArr = Array.isArray(rows) ? rows : []
        setRows(rowsArr.map(row => ({ ...row, password_hash: row.password_hash ? '••••••••' : row.password_hash })))
        setRowsError(null)
      })
      .catch((e: unknown) => {
        setRowsError(e instanceof Error ? e.message : 'Failed to load rows.')
        setRows([])
      })
      .finally(() => setRowsLoading(false))
  }, [selectedTable])

  const grouped = useMemo(() => {
    const byGroup = new Map<string, TableSummary[]>()
    for (const table of tables) {
      const key = groupTableName(table.name)
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key)!.push(table)
    }
    return Array.from(byGroup.entries())
  }, [tables])

  const activeColumns = useMemo(() => {
    if (detail?.columns?.length) {
      return detail.columns.map(c => c.name)
    }
    if (rows.length > 0 && rows[0]) {
      return Object.keys(rows[0])
    }
    return []
  }, [detail, rows])
  const activeGroup = detail ? groupTableName(detail.name) : 'Other'
  const activePalette = groupPalette(activeGroup)
  const filteredSchemaMap = useMemo(() => {
    if (!schemaMap || diagramScope === 'all' || !selectedTable) return schemaMap
    const visible = new Set<string>([selectedTable])
    for (const rel of schemaMap.relationships) {
      if (rel.from_table === selectedTable) visible.add(rel.to_table)
      if (rel.to_table === selectedTable) visible.add(rel.from_table)
    }
    return {
      tables: schemaMap.tables.filter(t => visible.has(t.name)),
      relationships: schemaMap.relationships.filter(r => visible.has(r.from_table) && visible.has(r.to_table)),
    }
  }, [schemaMap, diagramScope, selectedTable])
  const visibleDiagramTables = useMemo(
    () => (filteredSchemaMap ? [...filteredSchemaMap.tables].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [filteredSchemaMap],
  )
  const diagramSize = useMemo(() => {
    const fallbackWidth = DIAGRAM_PADDING_X * 2 + DIAGRAM_GAP_X * 5
    const fallbackHeight = DIAGRAM_PADDING_Y * 2 + DIAGRAM_GAP_Y * 4
    if (!filteredSchemaMap || visibleDiagramTables.length === 0) {
      return { width: fallbackWidth, height: fallbackHeight }
    }
    let maxX = fallbackWidth
    let maxY = fallbackHeight
    for (const table of visibleDiagramTables) {
      const position = diagramPositions[table.name]
      if (!position) continue
      const visibleColumns = columnsForDiagram(table, filteredSchemaMap)
      const cardHeight = 42 + visibleColumns.length * 18 + 16
      maxX = Math.max(maxX, position.x + DIAGRAM_CARD_WIDTH + 80)
      maxY = Math.max(maxY, position.y + cardHeight + 80)
    }
    return { width: maxX, height: maxY }
  }, [filteredSchemaMap, visibleDiagramTables, diagramPositions])

  async function refreshRows(): Promise<void> {
    if (!selectedTable) return
    setRowsLoading(true)
    try {
      const payload = await api.dbGetRows(selectedTable)
      const rows = (payload as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? payload as unknown as Array<Record<string, unknown>>
      const rowsArr = Array.isArray(rows) ? rows : []
      setRows(rowsArr.map(row => ({ ...row, password_hash: row.password_hash ? '••••••••' : row.password_hash })))
      setRowsError(null)
    } catch (e) {
      setRowsError(e instanceof Error ? e.message : 'Failed to load rows.')
      setRows([])
    } finally {
      setRowsLoading(false)
    }
  }

  async function loadSchemaMap(force = false): Promise<void> {
    if (diagramLoading) return
    if (!force && schemaMap) return
    setDiagramLoading(true)
    try {
      const payload = await api.dbGetSchemaMap() as unknown as SchemaMap
      setSchemaMap(payload)
      setDiagramPositions(buildFocusedDiagramPositions(payload.tables, payload.relationships, selectedTable))
      setDiagramError(null)
    } catch (e) {
      setDiagramError(e instanceof Error ? e.message : 'Failed to load schema diagram.')
    } finally {
      setDiagramLoading(false)
    }
  }

  function zoomIn(): void {
    setZoom(prev => Math.min(1.8, Number((prev + 0.1).toFixed(2))))
  }

  function zoomOut(): void {
    setZoom(prev => Math.max(0.45, Number((prev - 0.1).toFixed(2))))
  }

  useEffect(() => {
    if (activeView === 'diagram') {
      loadSchemaMap()
    }
  }, [activeView])

  useEffect(() => {
    if (!schemaMap) return
    if (diagramScope === 'focused') {
      setDiagramPositions(buildFocusedDiagramPositions(schemaMap.tables, schemaMap.relationships, selectedTable))
      return
    }
    setDiagramPositions(buildInitialDiagramPositions(schemaMap.tables))
  }, [schemaMap, diagramScope, selectedTable])

  useEffect(() => {
    if (!dragging) return
    const onMouseMove = (event: MouseEvent): void => {
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (!bounds) return
      const x = Math.max(8, (event.clientX - bounds.left) / zoom - dragging.offsetX)
      const y = Math.max(8, (event.clientY - bounds.top) / zoom - dragging.offsetY)
      setDiagramPositions(prev => ({ ...prev, [dragging.table]: { x, y } }))
    }
    const onMouseUp = (): void => setDragging(null)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, zoom])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading database metadata...</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Database not connected. {error}
      </div>
    )
  }

  const sidebar = (
    <PageSidebar
      title="Database"
      actions={
        <Button variant="ghost" size="sm" onClick={loadTables} className="h-6 w-6 p-0">
          <RefreshCw size={12} />
        </Button>
      }
    >
      {grouped.map(([group, items]) => {
        const palette = groupPalette(group)
        return (
          <SidebarCollapsibleGroup key={group} title={group} titleClassName={palette.groupText} defaultOpen>
            {items.map(table => (
              <SidebarListItem
                key={table.name}
                active={selectedTable === table.name}
                title={<span className="font-mono">{table.name}</span>}
                trailing={<span className="text-[10px] text-muted-foreground">{table.row_count}</span>}
                onClick={() => setSelectedTable(table.name)}
              />
            ))}
          </SidebarCollapsibleGroup>
        )
      })}
    </PageSidebar>
  )

  return (
    <ModularPageLayout sidebar={sidebar}>

      <section className="flex min-h-0 flex-1 flex-col p-4 overflow-hidden">
        {!detail ? (
          <div className="text-sm text-muted-foreground">Select a table.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
                  <p className="text-sm text-muted-foreground">{tableDescription(detail.name)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{detail.row_count} total rows</p>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto">
                {activeView === 'diagram' && (
                  <p className="pr-1 text-xs text-muted-foreground">
                    {diagramScope === 'focused' ? 'Focused' : 'All'} · {Math.round(zoom * 100)}%
                  </p>
                )}
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-2 py-1">
                  <ToggleGroup type="single" value={activeView} onValueChange={(v) => { if (v) setActiveView(v as 'rows' | 'diagram') }} className="gap-1">
                    <ToggleGroupItem value="rows" className="h-9 w-9 rounded-full p-0">
                      <Table2 size={14} />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="diagram" className="h-9 w-9 rounded-full p-0">
                      <GitBranch size={14} />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {activeView === 'rows' ? (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={refreshRows}>
                      <RefreshCw size={14} />
                    </Button>
                  ) : (
                    <>
                      <ToggleGroup type="single" value={diagramScope} onValueChange={(v) => { if (v) setDiagramScope(v as 'focused' | 'all') }} className="gap-1">
                        <ToggleGroupItem value="focused" className="h-9 w-9 rounded-full p-0">
                          <GitBranch size={14} />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="all" className="h-9 w-9 rounded-full p-0">
                          <Database size={14} />
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={zoomOut}>
                        <ZoomOut size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={zoomIn}>
                        <ZoomIn size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => loadSchemaMap(true)}>
                        <RefreshCw size={14} />
                      </Button>
                    </>
                  )}
                  <Button variant="default" size="icon" className="h-9 w-9 rounded-full" onClick={() => setSchemaOpen(true)}>
                    <PanelRightOpen size={14} />
                  </Button>
                </div>
              </div>
            </div>

            {activeView === 'rows' ? (
              rowsError ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {rowsError}
                </div>
              ) : (
                <div className={`overflow-hidden rounded-lg border ${activePalette.borderAccent}`}>
                  <Table className="min-w-full text-sm">
                    <TableHeader className={`${activePalette.softBg} text-foreground/80`}>
                      <TableRow className="hover:bg-transparent">
                        {activeColumns.map(column => (
                          <TableHead key={column} className="px-3 py-2 font-medium">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rowsLoading ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={Math.max(activeColumns.length, 1)} className="px-3 py-6 text-sm text-muted-foreground">
                            Loading rows...
                          </TableCell>
                        </TableRow>
                      ) : rows.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={Math.max(activeColumns.length, 1)} className="px-3 py-6 text-sm text-muted-foreground">
                            No rows found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row, idx) => (
                          <TableRow key={idx} className="align-top odd:bg-card even:bg-muted/20">
                            {activeColumns.map(col => (
                              <TableCell key={col} className="px-3 py-2 text-foreground/80 max-w-[320px]">
                                <div className="truncate" title={safeJson(row[col])}>
                                  {typeof row[col] === 'object' && row[col] !== null ? safeJson(row[col]) : String(row[col] ?? 'null')}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : diagramError ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {diagramError}
              </div>
            ) : diagramLoading && !schemaMap ? (
              <div className="text-sm text-muted-foreground">Loading schema diagram...</div>
            ) : !filteredSchemaMap ? (
              <div className="text-sm text-muted-foreground">No schema diagram data available.</div>
            ) : (
              <div className={`min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/10 p-2`}>
                <div
                  className="relative"
                  style={{
                    width: `${diagramSize.width * zoom}px`,
                    height: `${diagramSize.height * zoom}px`,
                  }}
                >
                  <div
                    ref={canvasRef}
                    className="relative rounded-md border border-border bg-card"
                    style={{
                      width: `${diagramSize.width}px`,
                      height: `${diagramSize.height}px`,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                      <defs>
                        <marker id="inline-schema-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                        </marker>
                      </defs>
                      {filteredSchemaMap.relationships.map((rel, idx) => {
                        const from = diagramPositions[rel.from_table]
                        const to = diagramPositions[rel.to_table]
                        if (!from || !to) return null
                        const fromOnRight = from.x <= to.x
                        const startX = fromOnRight ? from.x + DIAGRAM_CARD_WIDTH : from.x
                        const endX = fromOnRight ? to.x : to.x + DIAGRAM_CARD_WIDTH
                        const startY = from.y + 28
                        const endY = to.y + 28
                        const curve = Math.max(40, Math.abs(endX - startX) * 0.3)
                        const c1x = fromOnRight ? startX + curve : startX - curve
                        const c2x = fromOnRight ? endX - curve : endX + curve
                        const path = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
                        return (
                          <g key={`${rel.from_table}:${rel.from_column}:${rel.to_table}:${rel.to_column}:${idx}`}>
                            <path d={path} fill="none" stroke="#94a3b8" strokeWidth="1.3" markerEnd="url(#inline-schema-arrow)" />
                          </g>
                        )
                      })}
                    </svg>

                    {visibleDiagramTables.map(table => {
                      const position = diagramPositions[table.name] ?? { x: 24, y: 24 }
                      const visibleColumns = columnsForDiagram(table, filteredSchemaMap)
                      const fkColumnNames = new Set(
                        filteredSchemaMap.relationships.filter(r => r.from_table === table.name).map(r => r.from_column),
                      )
                      return (
                        <article
                          key={table.name}
                          className="absolute rounded-md border border-border bg-card shadow-sm"
                          style={{ left: `${position.x}px`, top: `${position.y}px`, width: `${DIAGRAM_CARD_WIDTH}px` }}
                        >
                          <button
                            onMouseDown={event => {
                              const bounds = event.currentTarget.getBoundingClientRect()
                              setDragging({
                                table: table.name,
                                offsetX: (event.clientX - bounds.left) / zoom,
                                offsetY: (event.clientY - bounds.top) / zoom,
                              })
                            }}
                            className="w-full cursor-grab rounded-t-md border-b border-border bg-muted/30 px-2.5 py-1.5 text-left active:cursor-grabbing"
                          >
                            <p className="truncate font-mono text-[11px] font-semibold text-foreground">{table.name}</p>
                          </button>
                          <div className="space-y-1 px-2.5 py-2">
                            {visibleColumns.map(col => (
                              <div key={col.name} className="flex items-center justify-between gap-2 text-[11px] text-foreground/80">
                                <span className="font-mono">
                                  {col.name}
                                  {col.primary_key ? ' (PK)' : fkColumnNames.has(col.name) ? ' (FK)' : ''}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{col.type}</span>
                              </div>
                            ))}
                            {table.columns.length > visibleColumns.length && (
                              <p className="text-[10px] text-muted-foreground/70">Only key fields shown</p>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Sheet open={schemaOpen} onOpenChange={setSchemaOpen}>
        <SheetContent side="right" className={`w-full max-w-xl p-0 ${activePalette.borderAccent}`}>
          <SheetHeader className={`border-b px-4 py-3 ${activePalette.borderAccent} ${activePalette.softBg}`}>
            <SheetTitle className="text-sm">Schema · {detail?.name}</SheetTitle>
            <SheetDescription className="sr-only">Column schema for {detail?.name}</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="overflow-auto p-4 h-[calc(100%-60px)]">
              <div className="overflow-hidden rounded-lg border border-border">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-2 font-medium">Column</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Type</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Nullable</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Primary key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.columns.map(col => (
                      <TableRow key={col.name}>
                        <TableCell className="px-3 py-2 font-mono text-xs text-foreground/80">{col.name}</TableCell>
                        <TableCell className="px-3 py-2 text-foreground/80">{col.type}</TableCell>
                        <TableCell className="px-3 py-2 text-foreground/80">{col.nullable ? 'Yes' : 'No'}</TableCell>
                        <TableCell className="px-3 py-2 text-foreground/80">{col.primary_key ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </ModularPageLayout>
  )
}
