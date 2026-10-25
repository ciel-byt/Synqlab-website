import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, RefreshCw, Trash2, FlaskConical, Activity, Dna, Microscope, Sparkles, ChevronDown, ExternalLink } from 'lucide-react'
import { api } from '@/api/client'
import type { DAGPipelineRun } from '@/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'

import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { PipelineNav } from '@/features/lab/components/PipelineNav'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import { Gfp11RunPage } from '@/pages/Gfp11RunPage'

// Icons per pipeline node
const NODE_META: Record<string, { icon: typeof Dna; label: string; color: string }> = {
  propose:     { icon: Dna,        label: 'Variant Proposal',     color: 'text-violet-500' },
  fold:        { icon: Microscope, label: 'Structure Prediction', color: 'text-sky-500' },
  stability:   { icon: Activity,   label: 'Stability Scoring',    color: 'text-emerald-500' },
  interaction: { icon: Activity,   label: 'Interaction Scoring',  color: 'text-teal-500' },
  brightness:  { icon: Sparkles,   label: 'Brightness Prediction',color: 'text-amber-500' },
  generate:    { icon: Dna,        label: 'Sequence Generation',  color: 'text-violet-500' },
  analyze:     { icon: Activity,   label: 'Stability Analysis',   color: 'text-emerald-500' },
  report:      { icon: FlaskConical, label: 'Report',             color: 'text-sky-500' },
}

/** Format a value for display — numbers get fixed precision, objects become compact */
function fmtVal(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

/** Render a single node's output as a definition-list style card */
function NodeResultCard({ nodeId, data, status }: { nodeId: string; data: Record<string, unknown> | null; status?: string }) {
  const meta = NODE_META[nodeId] || { icon: FlaskConical, label: nodeId, color: 'text-muted-foreground' }
  const Icon = meta.icon
  const [expanded, setExpanded] = useState(false)

  // Separate simple scalar fields from complex nested objects
  const scalarFields: [string, unknown][] = []
  const complexFields: [string, unknown][] = []
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'all_scored_candidates') continue // handled separately
      if (v != null && typeof v === 'object' && !Array.isArray(v)) complexFields.push([k, v])
      else scalarFields.push([k, v])
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <Icon size={14} className={meta.color} />
        <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">{meta.label}</span>
        {status && (
          <Badge variant={status === 'completed' ? 'ok' : status === 'failed' ? 'error' : 'secondary'} className="scale-90">
            {status}
          </Badge>
        )}
        <ChevronDown size={12} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <CardContent className="p-0">
          {!data ? (
            <div className="px-4 py-6 text-xs text-muted-foreground/50 text-center">No output data</div>
          ) : (
            <div className="divide-y divide-border/30">
              {scalarFields.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                  <span className="font-mono text-muted-foreground/70 min-w-[120px] shrink-0">{k}</span>
                  <span className={cn(
                    'font-mono font-medium truncate',
                    typeof v === 'number' ? 'text-accent' : 'text-foreground/80'
                  )} title={String(v)}>
                    {Array.isArray(v) ? v.map(fmtVal).join(', ') : fmtVal(v)}
                  </span>
                </div>
              ))}
              {complexFields.map(([k, v]) => (
                <div key={k} className="px-4 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">{k}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(v as Record<string, unknown>).map(([sk, sv]) => (
                      <div key={sk} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-muted-foreground/60">{sk}</span>
                        <span className="font-mono text-foreground/70">{fmtVal(sv)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/** Scored candidates table (from score-all mode) */
function ScoredCandidatesTable({ candidates }: { candidates: any[] }) {
  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
        <Dna size={14} className="text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wider">Scored Candidates</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/60">{candidates.length} evaluated</span>
      </CardHeader>
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {['#', 'Sequence', 'pLDDT', 'FoldX ΔG', 'p_hit', 'Fitness'].map(h => (
              <TableHead key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-muted/30">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="px-3 py-1.5 font-mono text-muted-foreground w-8">{i + 1}</TableCell>
              <TableCell className="px-3 py-1.5 font-mono text-accent text-[11px] max-w-[160px] truncate" title={c.sequence}>{c.sequence}</TableCell>
              <TableCell className="px-3 py-1.5 font-mono text-status-green">{c.fold?.plddt_mean?.toFixed(1) ?? '—'}</TableCell>
              <TableCell className="px-3 py-1.5 font-mono">{c.interaction?.interaction_score?.toFixed(2) ?? c.stability?.interface_dg?.toFixed(2) ?? '—'}</TableCell>
              <TableCell className="px-3 py-1.5 font-mono text-status-amber">{c.brightness?.p_hit?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="px-3 py-1.5 font-mono font-medium">{c.fitness != null ? c.fitness.toFixed(3) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function ExperimentDetail({ exp }: { exp: DAGPipelineRun }) {
  const isDone = exp.status === 'completed' || exp.status === 'failed'
  const results = (exp.results as Record<string, any>) || {}
  const nodeStatuses = exp.node_statuses || {}

  // Extract scored candidates if present
  const allScored = results.results?.propose?.all_scored_candidates || []

  // Ordered node IDs from the statuses
  const nodeOrder = ['propose', 'fold', 'stability', 'interaction', 'brightness', 'generate', 'analyze', 'report']
  const activeNodes = nodeOrder.filter(n => n in nodeStatuses)
  // Add any extra nodes not in default order
  for (const n of Object.keys(nodeStatuses)) {
    if (!activeNodes.includes(n)) activeNodes.push(n)
  }

  return (
    <div className="space-y-3">
      {/* Node status badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {activeNodes.map(node => {
          const s = nodeStatuses[node]
          const meta = NODE_META[node]
          const Icon = meta?.icon || FlaskConical
          return (
            <div key={node} className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-medium',
              s === 'completed' ? 'border-status-green/30 text-status-green bg-status-green/5' :
              s === 'failed' ? 'border-status-red/30 text-status-red bg-status-red/5' :
              s === 'running' ? 'border-accent/30 text-accent bg-accent/5' :
              'border-border text-muted-foreground bg-muted/10'
            )}>
              <Icon size={10} />
              {meta?.label || node}
            </div>
          )
        })}
      </div>

      {/* Scored candidates table (score-all mode) */}
      {allScored.length > 0 && <ScoredCandidatesTable candidates={allScored} />}

      {/* Per-node result cards */}
      {activeNodes.map(nodeId => {
        const nodeData = results.results?.[nodeId] || null
        return (
          <NodeResultCard
            key={nodeId}
            nodeId={nodeId}
            data={nodeData as Record<string, unknown> | null}
            status={nodeStatuses[nodeId]}
          />
        )
      })}

      {/* Fallback: no results yet */}
      {!isDone && Object.keys(results).length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 gap-2">
          <Activity size={24} className="animate-pulse" />
          <span className="text-xs">Results will appear here when the pipeline finishes.</span>
        </div>
      )}
    </div>
  )
}

const MOCK_RUN_ID = 'gfp11-demo'

export function ExperimentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [experiments, setExperiments] = useState<DAGPipelineRun[]>([])
  const [selected, setSelected] = useState<DAGPipelineRun | null>(null)
  const [selectedMock, setSelectedMock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pipelineNames, setPipelineNames] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      const [data, templates, custom] = await Promise.all([
        api.listPipelineRuns(),
        api.listPipelineTemplates().catch(() => []),
        api.listCustomPipelines().catch(() => []),
      ])
      setExperiments(data)

      // Build pipeline_id → name lookup
      const names: Record<string, string> = {}
      for (const t of templates) names[t.template_id] = t.name
      for (const c of custom) names[c.template_id] = c.name
      setPipelineNames(names)

      // Deep-link: if ?run=<id> is in the URL, select that run
      const runParam = searchParams.get('run')
      if (runParam === MOCK_RUN_ID) {
        setSelectedMock(true)
        setSelected(null)
        return
      }
      if (runParam) {
        const match = data.find((r: DAGPipelineRun) => r.id === runParam)
        if (match) {
          setSelected(match)
          setSelectedMock(false)
          return
        }
      }
      if (data.length > 0 && !selected) setSelected(data[0])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    try {
      await api.deleteExperiment(id)
      if (selected?.id === id) setSelected(null)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const sidebar = (
    <PageSidebar
      title="Pipelines"
      actions={
        <Button variant="ghost" size="sm" onClick={load} className="h-6 w-6 p-0">
          <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
        </Button>
      }
    >
      <PipelineNav active="experiments" />
      <SidebarGroup className="flex-1 min-h-0 flex flex-col pt-2">
        <SidebarGroupLabel className="text-[10px]">Runs ({experiments.length})</SidebarGroupLabel>
        <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
          {error && <p className="text-xs text-status-red p-2">⚠ {error}</p>}
          {loading && (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-md border border-border p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          )}
          {!loading && experiments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <BarChart3 className="h-6 w-6 text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground">No experiments yet</p>
            </div>
          )}
          <div className="space-y-1">
            {/* Mock GFP11 demo run always shown at top */}
            <SidebarListItem
              active={selectedMock}
              title="GFP11 Optimization"
              trailing={
                <Badge variant="secondary" className="scale-90">demo</Badge>
              }
              meta={
                <div className="flex gap-3 text-[10px] font-mono text-muted-foreground truncate pr-6 mt-0.5">
                  <span>gfp11-de</span>
                  <span>3/3 R</span>
                </div>
              }
              onClick={() => { setSelectedMock(true); setSelected(null) }}
            />
            {experiments.map(exp => (
              <SidebarListItem
                key={exp.id}
                active={!selectedMock && selected?.id === exp.id}
                title={pipelineNames[exp.pipeline_id] || exp.pipeline_id}
                trailing={
                  <Badge variant={exp.status === 'completed' ? 'ok' : exp.status === 'failed' ? 'error' : 'secondary'} className="scale-90 capitalize">
                    {exp.status}
                  </Badge>
                }
                meta={
                  <div className="flex gap-3 text-[10px] font-mono text-muted-foreground truncate pr-6 mt-0.5">
                    <span>{exp.id.slice(0, 8)}</span>
                    {exp.round && exp.max_rounds && <span>{exp.round}/{exp.max_rounds} R</span>}
                    {exp.started_at && <span>{new Date(exp.started_at).toLocaleTimeString()}</span>}
                  </div>
                }
                onClick={() => { setSelected(exp); setSelectedMock(false) }}
                hoverActions={
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(e, exp.id) }}
                    className="p-1.5 text-muted-foreground/50 hover:text-status-red hover:bg-status-red/10 rounded transition-all"
                    title="Delete run"
                  >
                    <Trash2 size={13} />
                  </button>
                }
                hoverActionsAlign="bottom"
              />
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </PageSidebar>
  )

  return (
    <ModularPageLayout sidebar={sidebar}>
      {selectedMock ? (
        <Gfp11RunPage />
      ) : (
      <div className="flex-1 overflow-y-auto p-6">
        {!selected && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground/70 gap-2">
            <BarChart3 size={32} className="opacity-25" />
            <p className="font-medium text-muted-foreground">Select an experiment run</p>
          </div>
        )}
        {selected && (
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant={selected.status === 'completed' ? 'ok' : selected.status === 'failed' ? 'error' : 'secondary'} className="capitalize">{selected.status}</Badge>
              <span className="font-mono text-sm text-accent font-semibold">{selected.id}</span>
              <span className="text-[10.5px] font-mono text-muted-foreground/70 uppercase">Pipeline: {pipelineNames[selected.pipeline_id] || selected.pipeline_id}</span>
              {selected.status !== 'completed' && selected.status !== 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto gap-1.5 text-xs"
                  onClick={() => navigate(`/lab/pipelines?run=${selected.id}&template=${selected.pipeline_id}`)}
                >
                  <ExternalLink size={12} />
                  View Live
                </Button>
              )}
              {(selected.status === 'completed' || selected.status === 'failed') && selected.round && selected.max_rounds && (
                <span className="text-[10.5px] font-mono text-muted-foreground/70 ml-auto">Round {selected.round} of {selected.max_rounds}</span>
              )}
            </div>
            {selected.error && (
              <div className="mb-4 p-3 rounded border border-status-red/20 bg-status-red/5 text-status-red text-xs font-mono">
                {selected.error}
              </div>
            )}
            <ExperimentDetail exp={selected} />
          </div>
        )}
      </div>
      )}
    </ModularPageLayout>
  )
}
