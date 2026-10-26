/**
 * PipelinePage — unified pipeline hub (Design C).
 *
 * Sidebar: searchable list of core templates + user pipelines.
 * Main: DAG preview + auto-generated config form + run + results + history.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FlaskConical, AlertTriangle, ArrowRight, Trophy, Wand2,
  Repeat, Check, Loader2, Pencil, Search, Plus, GitBranch,
  Clock, MessageSquare, Trash2,
} from 'lucide-react'
import { api } from '@/api/client'
import type { PipelineResult } from '@/types'
import { useToolsAndHealth } from '@/features/tools/hooks/useToolsAndHealth'
import type { PipelineTemplate, PipelineDef, PipelineNodeDef } from '@/features/lab/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { PipelineNav } from '@/features/lab/components/PipelineNav'
import { DagPreview } from '@/features/lab/components/DagPreview'
import { PipelineConfigForm } from '@/features/lab/components/PipelineConfigForm'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import { InlineCanvasEditor } from '@/features/lab/components/InlineCanvasEditor'

// ── Icon map for templates ───────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, { icon: typeof FlaskConical; color: string }> = {
  gfp11:       { icon: Repeat,       color: 'text-emerald-500' },
  design:      { icon: FlaskConical,  color: 'text-sky-500' },
  screening:   { icon: Trophy,        color: 'text-amber-500' },
  'v1-legacy': { icon: Wand2,         color: 'text-violet-500' },
}

function templateIcon(id: string) {
  return TEMPLATE_ICONS[id] || { icon: GitBranch, color: 'text-primary/60' }
}

// ── Unified item type ────────────────────────────────────────────────────

interface PipelineItem {
  id: string
  name: string
  description: string
  nodeCount: number
  nodes: PipelineNodeDef[]
  isCore: boolean
}

const GFP11_PIPELINE_DESCRIPTION =
  'Iterative GFP11 brightness optimization. Brightness VAE proposes variants, AlphaFold-Multimer folds the complex, gates filter stability/interaction, Ranker selects top candidates, and Model Update closes the loop each round.'

function buildGfp11DisplayNodes(nodes: PipelineNodeDef[]): PipelineNodeDef[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const withFallback = (id: string): PipelineNodeDef => byId.get(id) ?? {
    id,
    tool_name: 'score_brightness',
    label: id,
    parameters: {},
    depends_on: [],
    position: { x: 0, y: 0 },
    input_schema: [],
    output_schema: [],
  }

  const propose = withFallback('propose')
  const fold = withFallback('fold')
  const stability = withFallback('stability')
  const interaction = withFallback('interaction')
  const brightness = withFallback('brightness')

  return [
    {
      ...propose,
      id: 'vae',
      label: 'Brightness VAE',
      position: { x: 60, y: 120 },
      depends_on: [],
    },
    {
      ...fold,
      id: 'fold',
      label: 'AlphaFold-Multimer',
      position: { x: 250, y: 120 },
      depends_on: ['vae'],
      parameters: {
        ...fold.parameters,
        sequence: '{{vae.best_variant}}',
      },
    },
    {
      ...stability,
      id: 'stability',
      label: 'Stability Gate',
      position: { x: 440, y: 120 },
      depends_on: ['fold'],
    },
    {
      ...interaction,
      id: 'interaction',
      label: 'Interaction Gate',
      position: { x: 630, y: 120 },
      depends_on: ['stability'],
    },
    {
      ...brightness,
      id: 'rank',
      label: 'Ranker',
      position: { x: 820, y: 120 },
      depends_on: ['interaction'],
      parameters: {
        ...brightness.parameters,
        sequence: '{{vae.best_variant}}',
      },
    },
    {
      ...propose,
      id: 'update',
      label: 'Model Update',
      position: { x: 1010, y: 120 },
      depends_on: ['rank'],
      parameters: {
        ...propose.parameters,
      },
    },
  ]
}

// ── Result sub-components (kept from original) ───────────────────────────

function GateFlow({ result }: { result: PipelineResult }) {
  const pct1 = result.n_generated ? Math.round((result.n_passed_gate1 / result.n_generated) * 100) : 0
  const pct2 = result.n_passed_gate1 ? Math.round((result.n_passed_gate2 / result.n_passed_gate1) * 100) : 0
  const steps = [
    { label: 'Generated', value: result.n_generated, pct: null, highlight: false },
    { label: 'Gate 1 · pLDDT', value: result.n_passed_gate1, pct: pct1, highlight: false },
    { label: 'Gate 2 · ΔΔG', value: result.n_passed_gate2, pct: pct2, highlight: false },
    { label: 'Top-k selected', value: result.n_top_k, pct: null, highlight: true },
  ]
  return (
    <div className="flex bg-card border border-border rounded-lg shadow-sm overflow-hidden mb-4">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 min-w-0">
          <div className="flex-1 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{step.label}</div>
            <div className={cn('text-2xl font-bold font-mono mt-1 leading-none tracking-tight', step.highlight ? 'text-accent' : 'text-foreground')}>{step.value}</div>
            {step.pct !== null && <div className="text-[11px] font-mono text-status-green mt-0.5 font-medium">{step.pct}% pass</div>}
          </div>
          {i < steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground/50 flex-shrink-0 mr-0" />}
        </div>
      ))}
    </div>
  )
}

function CandidatesTable({ result }: { result: PipelineResult }) {
  return (
    <Card>
      <CardHeader>
        <Trophy size={14} className="text-accent" />
        <span className="font-semibold">Top-{result.n_top_k} Candidates</span>
        <Badge variant="running" className="ml-auto">{result.n_top_k} / {result.n_generated} survived</Badge>
      </CardHeader>
      <Table className="w-full text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {['#', 'Sequence', 'pLDDT ↑', 'ΔΔG ↓', 'Reranker'].map(col => (
              <TableHead key={col} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/50">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.top_k_sequences.map((seq, i) => {
            const s = result.top_k_scores?.[i] || {}
            return (
              <TableRow key={i} className="transition-colors">
                <TableCell className="px-4 py-2.5 w-10">
                  <span className={cn('inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold border font-mono', i === 0 ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'bg-muted border-border text-muted-foreground')}>{i + 1}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 max-w-[200px] truncate font-mono text-accent text-[11px]" title={seq}>{seq}</TableCell>
                <TableCell className="px-4 py-2.5 font-mono font-medium text-status-green">{s.confidence?.toFixed(1) ?? '—'}</TableCell>
                <TableCell className={cn('px-4 py-2.5 font-mono font-medium', (s.ddg ?? 0) < 0 ? 'text-status-green' : 'text-muted-foreground')}>{s.ddg?.toFixed(3) ?? '—'}</TableCell>
                <TableCell className="px-4 py-2.5 font-mono text-status-amber font-medium">{s.reranker_score != null ? s.reranker_score.toFixed(3) : '—'}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

// ── Run history entry ────────────────────────────────────────────────────

interface RunHistoryEntry {
  id: string
  pipeline_id: string
  status: string
  started_at?: string
  completed_at?: string
  error?: string
}

function RunHistoryList({ runs, pipelineName, onSelect }: { runs: RunHistoryEntry[]; pipelineName?: string; onSelect?: (id: string) => void }) {
  if (runs.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">
        Run History
      </div>
      {runs.slice(0, 10).map(r => {
        const statusColor = r.status === 'completed' ? 'text-status-green' : r.status === 'failed' ? 'text-status-red' : r.status === 'partial' ? 'text-orange-500' : 'text-status-amber'
        const timeAgo = r.started_at ? formatTimeAgo(r.started_at) : ''
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect?.(r.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/30 border border-border/50 text-[11px] cursor-pointer hover:bg-muted/60 hover:border-border transition-colors group"
          >
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', r.status === 'completed' ? 'bg-status-green' : r.status === 'failed' ? 'bg-status-red' : r.status === 'partial' ? 'bg-orange-500' : 'bg-status-amber')} />
            <span className={cn('font-medium', statusColor)}>{r.status}</span>
            {pipelineName && <span className="text-foreground/70 truncate max-w-[120px]">{pipelineName}</span>}
            <code className="font-mono text-muted-foreground/70 text-[10px]">{r.id.slice(0, 8)}</code>
            {timeAgo && <span className="ml-auto text-muted-foreground/50 flex items-center gap-1"><Clock size={9} />{timeAgo}</span>}
            <ArrowRight size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
          </button>
        )
      })}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Main page ────────────────────────────────────────────────────────────

type RunState = 'idle' | 'running' | 'done' | 'error'

export function PipelinePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Data
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [customPipelines, setCustomPipelines] = useState<PipelineTemplate[]>([])
  const { tools, health } = useToolsAndHealth()
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('pipeline') || null)
  const [selectedDef, setSelectedDef] = useState<PipelineDef | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  // Run state
  const [runState, setRunState] = useState<RunState>('idle')
  const [runId, setRunId] = useState('')
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [dagResult, setDagResult] = useState<Record<string, unknown> | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [stageInfo, setStageInfo] = useState<{ stage: number; total: number; label: string; round?: number; max_rounds?: number } | null>(null)
  const pollingRef = useRef(false)

  // Run history
  const [allRuns, setAllRuns] = useState<RunHistoryEntry[]>([])

  // ── Load pipeline-specific data ────────────────────────────────────────

  const loading = pipelineLoading

  useEffect(() => {
    Promise.all([
      api.listPipelineTemplates(),
      api.listCustomPipelines().catch(() => []),
      api.listPipelineRuns().catch(() => []),
    ]).then(([tpls, custom, runs]) => {
      setTemplates(tpls)
      setCustomPipelines(custom)
      setAllRuns(runs as RunHistoryEntry[])
    }).finally(() => setPipelineLoading(false))
  }, [])

  // ── Build unified list ─────────────────────────────────────────────────

  const coreItems: PipelineItem[] = useMemo(() => {
    return templates.map(t => ({
      id: t.template_id,
      name: t.name,
      description: t.description,
      nodeCount: t.node_count,
      nodes: t.nodes || [],
      isCore: true,
    }))
  }, [templates])

  const customItems: PipelineItem[] = useMemo(() => {
    return customPipelines.map(t => ({
      id: t.template_id,
      name: t.name,
      description: t.description,
      nodeCount: t.node_count,
      nodes: t.nodes || [],
      isCore: false,
    }))
  }, [customPipelines])

  const items = useMemo(() => [...coreItems, ...customItems], [coreItems, customItems])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  }, [items, searchQuery])

  // ── Load pipeline definition when selected ─────────────────────────────

  useEffect(() => {
    if (!selectedId) { setSelectedDef(null); return }
    setSelectedDef(null) // Clear immediately to avoid stale form rendering
    let cancelled = false
    api.getPipeline(selectedId)
      .then(def => { if (!cancelled) setSelectedDef(def) })
      .catch(() => { if (!cancelled) setSelectedDef(null) })
    return () => { cancelled = true }
  }, [selectedId])

  // ── Run history for selected pipeline ──────────────────────────────────

  const pipelineRuns = useMemo(() => {
    if (!selectedId) return []
    return allRuns.filter(r => r.pipeline_id === selectedId)
  }, [selectedId, allRuns])

  // ── Run pipeline ───────────────────────────────────────────────────────

  const handleRun = useCallback(async (inputs: Record<string, unknown>) => {
    if (!selectedId) return

    // Demo intercept — GFP11 pipeline goes to the mock experiment run page
    if (selectedId === 'gfp11') {
      navigate('/lab/experiments?run=gfp11')
      return
    }

    setRunState('running')
    setResult(null)
    setDagResult(null)
    setErrorMsg('')
    setStageInfo(null)
    pollingRef.current = true

    try {
      const { run_id } = await api.runDAGPipeline(selectedId, inputs)
      setRunId(run_id)
      setSearchParams({ pipeline: selectedId, run: run_id }, { replace: true })

      const deadline = Date.now() + 7_200_000
      let interval = 2000
      while (Date.now() < deadline && pollingRef.current) {
        await new Promise(r => setTimeout(r, interval))
        const run = await api.getDAGRun(run_id)

        // Progress tracking
        if (run.node_statuses) {
          const entries = Object.entries(run.node_statuses)
          // Use the pipeline definition's node count for accurate total
          const total = selectedDef?.nodes?.length || entries.length || 1
          const running = entries.find(([, s]) => s === 'running')
          const completed = entries.filter(([, s]) => s === 'completed' || s === 'failed')

          // Extract a readable label from the node ID (e.g. "protgpt2-1-..." → "protgpt2")
          const readableLabel = (nodeId: string) => {
            const match = selectedDef?.nodes?.find(n => n.id === nodeId)
            if (match?.label) return match.label
            // Fall back to parsing the tool name from the ID
            return nodeId.replace(/-\d+-\d+$/, '').replace(/-/g, ' ')
          }

          if (running) {
            const completedCount = entries.filter(([, s]) => s === 'completed').length
            setStageInfo({
              stage: completedCount + 1,
              total,
              label: readableLabel(running[0]),
              round: run.round,
              max_rounds: run.max_rounds,
            })
          } else if (completed.length > 0) {
            setStageInfo({
              stage: completed.length,
              total,
              label: `${completed.length}/${total} done`,
              round: run.round,
              max_rounds: run.max_rounds,
            })
          }
        }

        if (run.status === 'completed' || run.status === 'failed' || run.status === 'partial') {
          if (run.status === 'failed') {
            setErrorMsg(run.error || 'Pipeline failed.')
            setRunState('error')
          } else if (run.status === 'partial') {
            // Some nodes succeeded, some failed
            setDagResult({ ...run.results, rounds: run.rounds ?? [] })
            setErrorMsg('Pipeline completed with errors — some nodes failed.')
            setRunState('error')
          } else {
            setDagResult({ ...run.results, rounds: run.rounds ?? [] })
            setRunState('done')
          }
          pollingRef.current = false
          // Refresh run history
          api.listPipelineRuns().then(r => setAllRuns(r as RunHistoryEntry[])).catch(() => {})
          return
        }
        interval = Math.min(interval * 1.2, 5000)
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setRunState('error')
    }
  }, [selectedId, setSearchParams])

  // ── Selection handler ──────────────────────────────────────────────────

  const selectPipeline = useCallback((id: string) => {
    setSelectedId(id)
    setRunState('idle')
    setResult(null)
    setDagResult(null)
    setErrorMsg('')
    setSearchParams({ pipeline: id }, { replace: true })
  }, [setSearchParams])

  // ── Delete / Rename handlers ───────────────────────────────────────────

  const handleDeletePipeline = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this pipeline? This cannot be undone.')) return
    try {
      await api.deletePipeline(id)
      if (selectedId === id) {
        setSelectedId(null)
        setSelectedDef(null)
        setSearchParams({}, { replace: true })
      }
      const updated = await api.listCustomPipelines().catch(() => [])
      setCustomPipelines(updated)
    } catch (err) {
      console.error('Failed to delete pipeline:', err)
    }
  }, [selectedId, setSearchParams])

  const handleRenamePipeline = useCallback(async (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation()
    const newName = prompt('Rename pipeline:', currentName)
    if (!newName?.trim() || newName.trim() === currentName) return
    try {
      await api.renamePipeline(id, newName.trim())
      const updated = await api.listCustomPipelines().catch(() => [])
      setCustomPipelines(updated)
    } catch (err) {
      console.error('Failed to rename pipeline:', err)
    }
  }, [])

  // ── Sidebar ────────────────────────────────────────────────────────────

  const sidebar = (
    <PageSidebar title="Pipelines">
      <PipelineNav active="pipelines" />
      <SidebarGroup className="flex-1 min-h-0 flex flex-col pt-2">
        {/* Search */}
        <div className="px-2 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search pipelines…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-8 pr-3 rounded-md border border-border bg-background text-[11px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <SidebarGroupLabel className="text-[10px]">
          Templates ({filtered.length})
        </SidebarGroupLabel>
        <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <GitBranch className="h-6 w-6 text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground">
                {searchQuery ? 'No matching pipelines' : 'No pipelines'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Core Templates */}
              {filtered.filter(p => p.isCore).length > 0 && (
                <div>
                  <div className="px-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                    Core ({filtered.filter(p => p.isCore).length})
                  </div>
                  <div className="space-y-1">
                    {filtered.filter(p => p.isCore).map(p => {
                      const { icon: Icon, color } = templateIcon(p.id)
                      return (
                        <SidebarListItem
                          key={p.id}
                          active={selectedId === p.id}
                          title={p.name}
                          subtitle={`${p.nodeCount} nodes`}
                          icon={<Icon size={13} className={color} />}
                          onClick={() => selectPipeline(p.id)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Custom Pipelines */}
              {filtered.filter(p => !p.isCore).length > 0 && (
                <div>
                  <div className="px-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                    My Pipelines ({filtered.filter(p => !p.isCore).length})
                  </div>
                  <div className="space-y-1">
                    {filtered.filter(p => !p.isCore).map(p => (
                      <SidebarListItem
                        key={p.id}
                        active={selectedId === p.id}
                        title={p.name}
                        subtitle={`${p.nodeCount} nodes`}
                        icon={<GitBranch size={13} className="text-primary/60" />}
                        onClick={() => selectPipeline(p.id)}
                        hoverActions={
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => handleRenamePipeline(e, p.id, p.name)}
                              className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted rounded transition-all"
                              title="Rename"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => handleDeletePipeline(e, p.id)}
                              className="p-1 text-muted-foreground/50 hover:text-status-red hover:bg-status-red/10 rounded transition-all"
                              title="Delete"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </PageSidebar>
  )

  // ── Main content ───────────────────────────────────────────────────────

  const selected = items.find(p => p.id === selectedId)
  const isGfp11 = selected?.id === 'gfp11'
  const displayNodes = useMemo(() => {
    if (!selectedDef) return []
    if (!isGfp11) return selectedDef.nodes
    return buildGfp11DisplayNodes(selectedDef.nodes)
  }, [selectedDef, isGfp11])
  const displayDescription = isGfp11 ? GFP11_PIPELINE_DESCRIPTION : selected?.description
  const displayNodeCount = isGfp11 ? 6 : selected?.nodeCount

  return (
    <ModularPageLayout sidebar={sidebar}>
      {creatingNew ? (
        /* Inline canvas editor — fills entire content area */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <InlineCanvasEditor
            tools={tools}
            health={health}
            onSaved={() => {
              setCreatingNew(false)
              api.listCustomPipelines().catch(() => []).then(setCustomPipelines)
            }}
            onCancel={() => setCreatingNew(false)}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading pipelines…</span>
              </div>
            </div>
          ) : !selected ? (
            /* No selection — welcome screen */
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <GitBranch size={22} className="text-muted-foreground/50" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Pipelines</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Select a pipeline from the sidebar to configure and run, or create a new one.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setCreatingNew(true)}
                >
                  <Plus size={14} /> New Pipeline
                </Button>
                <Button
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => navigate('/lab/agents/console?pipeline=new')}
                >
                  <MessageSquare size={14} /> Open in Agent Chat
                </Button>
              </div>
            </div>
          ) : (
            /* Pipeline detail view */
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{displayDescription}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="running" className="text-[10px]">{displayNodeCount} nodes</Badge>
                    {selected.isCore && <Badge className="text-[10px] bg-muted text-muted-foreground border border-border">Core Template</Badge>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[11px]"
                  onClick={() => navigate(`/lab/pipelines/${selected.id}/edit`)}
                >
                  <Pencil size={12} /> Edit DAG
                </Button>
              </div>

              {/* DAG Preview */}
              {selectedDef && (
                <DagPreview
                  nodes={displayNodes}
                  tools={tools}
                  height={200}
                />
              )}

              {/* Configuration form */}
              {selectedDef && (
                <Card>
                  <CardHeader>
                    <FlaskConical size={14} className="text-accent" />
                    <span className="font-semibold">Configuration</span>
                  </CardHeader>
                  <CardBody>
                    <PipelineConfigForm
                      key={selected.id}
                      pipelineId={selected.id}
                      nodes={displayNodes}
                      tools={tools}
                      pipelineParams={selectedDef.pipeline_params}
                      onRun={handleRun}
                      running={runState === 'running'}
                    />
                  </CardBody>
                </Card>
              )}

              {/* Running progress */}
              {runState === 'running' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground/70 text-xs">
                    <Loader2 size={12} className="animate-spin text-accent" />
                    <span>Running… job <code className="font-mono">{runId.slice(0, 8)}</code></span>
                  </div>
                  {stageInfo && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${(stageInfo.stage / stageInfo.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-accent whitespace-nowrap">
                        {stageInfo.round ? `R${stageInfo.round}/${stageInfo.max_rounds} · ` : ''}
                        {stageInfo.stage}/{stageInfo.total} · {stageInfo.label}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {runState === 'error' && (
                <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                  <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-destructive">Pipeline failed</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Results — V1 Legacy */}
              {result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="ok">COMPLETE</Badge>
                    <span className="font-mono text-xs text-accent font-semibold">{result.experiment_id}</span>
                  </div>
                  <GateFlow result={result} />
                  <CandidatesTable result={result} />
                </div>
              )}

              {/* Results — DAG Engine */}
              {dagResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="ok">COMPLETE</Badge>
                    <span className="text-xs text-muted-foreground">DAG Pipeline · {selected.name}</span>
                  </div>
                  <Card className="p-4">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-3">Node Outputs</div>
                    <div className="space-y-3">
                      {Object.entries(((dagResult as any).results || {}) as Record<string, Record<string, unknown>>).map(([nodeId, data]) => {
                        if (nodeId === 'status' || nodeId === 'round') return null
                        const nodeData = typeof data === 'object' && data !== null ? data : {}
                        return (
                          <div key={nodeId} className="border border-border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Check size={12} className="text-status-green" />
                              <span className="text-[12px] font-semibold text-foreground">{selectedDef?.nodes?.find(n => n.id === nodeId)?.label || nodeId.replace(/-\d+-\d+$/, '')}</span>
                            </div>
                            <pre className="text-[10.5px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto max-h-[200px]">
                              {JSON.stringify(nodeData, null, 2)}
                            </pre>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {/* Run History */}
              {pipelineRuns.length > 0 && (
                <RunHistoryList
                  runs={pipelineRuns}
                  pipelineName={selected?.name}
                  onSelect={(id) => navigate(`/lab/experiments?run=${id}`)}
                />
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </ModularPageLayout>
  )
}
