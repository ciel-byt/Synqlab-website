/**
 * ToolDetail — split-panel detail view for a tool inside the Lab Console.
 *
 * Layout:
 *   LEFT  — Description, metadata strip, inputs form + run button, output schema
 *   RIGHT — Results panel (sticky on desktop, stacks below on small screens)
 *
 * All UI uses shadcn primitives: Card, Badge, Input, Label, Button, Alert, Separator.
 */
import { useRef, useMemo, useState } from 'react'
import {
  AlertTriangle, ChevronRight, Clock, ExternalLink, Info, Loader2, Play,
} from 'lucide-react'
import { api, pollJob } from '@/api/client'
import type { Tool, ComputeInfo } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  LINK_LABELS,
  fmtDisk, fmtRam, AnimatedAvatar,
} from '../helpers'
import { OutputFields } from './OutputFields'
import { PdbViewer } from './PdbViewer'
import { getLinkIcon } from './LinkIcons'
import type { ResultEntry, JobResult } from '../hooks/useToolsData'

interface ToolDetailProps {
  tool: Tool
  health?: { available: boolean; reason: string; install_hint?: string }
  compute?: ComputeInfo | null
  inputs: Record<string, string>
  onInputsChange: (inputs: Record<string, string>) => void
  results: ResultEntry[]
  onAddResult: (entry: ResultEntry) => void
  onUpdateResult: (jobId: string, result: JobResult) => void
}

export function ToolDetail({
  tool, health, compute, inputs, onInputsChange, results, onAddResult, onUpdateResult,
}: ToolDetailProps) {
  const pollingJobs = useRef<Set<string>>(new Set())

  function setInput(name: string, value: string) {
    onInputsChange({ ...inputs, [name]: value })
  }



  async function run() {
    const parsed: Record<string, unknown> = {}
    for (const inp of tool.inputs || []) {
      const raw = inputs[inp.name] ?? ''
      if (raw === '') continue
      if (inp.type === 'int') parsed[inp.name] = parseInt(raw)
      else if (inp.type === 'float') parsed[inp.name] = parseFloat(raw)
      else if (inp.type.startsWith('list')) {
        try { parsed[inp.name] = JSON.parse(raw) }
        catch { parsed[inp.name] = raw.split(',').map(s => s.trim()) }
      } else if (inp.type === 'dict') {
        try { parsed[inp.name] = JSON.parse(raw) }
        catch { parsed[inp.name] = {} }
      } else {
        parsed[inp.name] = raw
      }
    }

    let jobId: string
    try {
      const res = await api.runTool(tool.id, parsed)
      jobId = res.job_id
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onAddResult({
        id: String(Date.now()), jobId: '',
        result: { status: 'failed', success: false, error_message: msg, outputs: {} },
        ts: new Date().toLocaleTimeString(),
      })
      return
    }

    const entry: ResultEntry = { id: jobId, jobId, result: null, ts: new Date().toLocaleTimeString() }
    onAddResult(entry)
    pollingJobs.current.add(jobId)

    try {
      const job = await pollJob(jobId)
      onUpdateResult(jobId, job as unknown as JobResult)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onUpdateResult(jobId, { status: 'failed', success: false, error_message: msg, outputs: {} })
    } finally {
      pollingJobs.current.delete(jobId)
    }
  }

  const runningCount = results.filter(r => r.result === null).length
  const rp = tool.resource_profile
  const links = tool.links ?? {}
  const linkEntries = Object.entries(links).filter(([, url]) => url)
  const tags = (tool.tags ?? []).filter(t => t !== 'v1' && t !== 'v2')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header bar ── */}
      <div className="border-b border-border bg-background/50 px-6 py-5 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 shrink-0">
              <AnimatedAvatar category={tool.category} />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-foreground tracking-tight">{tool.name}</h1>
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="uppercase tracking-wider font-semibold text-muted-foreground/60">{tool.category_label}</span>
                {tags.map(tag => (
                  <span key={tag} className="flex items-center">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mr-1.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          {health && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest shrink-0 ${health.available ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health.available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {health.available ? 'READY' : 'SETUP REQUIRED'}
            </div>
          )}
        </div>
      </div>

      {/* ── Split layout: left (config) + right (results) ── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

        {/* ═══ LEFT PANEL — scrollable ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-w-0">

          {/* Setup alert */}
          {health && !health.available && (
            <Alert variant="warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertTitle className="text-[12px]">Setup required</AlertTitle>
              <AlertDescription className="text-[11px]">
                {health.reason}
                {health.install_hint && (
                  <pre className="mt-1.5 text-[9px] font-mono bg-muted/50 border border-border rounded p-2 whitespace-pre-wrap break-all">{health.install_hint}</pre>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          {tool.description && (
            <p className="text-[12px] text-foreground/80 leading-relaxed">{tool.description}</p>
          )}

          {/* ── Metadata strip (requirements, links) ── */}
          {(rp || linkEntries.length > 0 || (tool.meta && Object.keys(tool.meta).length > 0)) && (
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
              {rp && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Badge variant={rp.gpu && rp.gpu !== 'none' ? 'info' : 'secondary'} className="text-[8px]">
                      {rp.gpu && rp.gpu !== 'none' ? 'GPU' : 'CPU'}
                      {rp.gpu && rp.gpu !== 'none' && ` · ${rp.gpu.toUpperCase()}`}
                    </Badge>
                  </span>
                  {rp.estimated_time_per_call && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={9} className="text-muted-foreground/40" />
                      <span className="font-medium text-foreground/70">{rp.estimated_time_per_call}</span>
                    </span>
                  )}
                  {rp.disk_gb != null && (
                    <span className="inline-flex items-center gap-1">Disk <span className="font-medium text-foreground/70">{fmtDisk(rp.disk_gb)}</span></span>
                  )}
                  {rp.ram_gb != null && (
                    <span className="inline-flex items-center gap-1">RAM <span className="font-medium text-foreground/70">{fmtRam(rp.ram_gb)}</span></span>
                  )}
                  {compute && (
                    <span className="inline-flex items-center gap-1">
                      Device <span className="font-medium text-foreground/70">{compute.type === 'gpu' ? 'GPU' : 'CPU'}{compute.name && compute.name.toLowerCase() !== compute.type ? ` (${compute.name})` : ''}</span>
                    </span>
                  )}
                </>
              )}
              {linkEntries.length > 0 && (
                <>
                  {rp && <Separator orientation="vertical" className="h-3" />}
                  {linkEntries.map(([type, url]) => (
                    <a key={type} href={url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary/80 hover:text-primary transition-colors"
                    >
                      <span className="text-muted-foreground/40">{getLinkIcon(type, url)}</span>
                      {LINK_LABELS[type] ?? type}
                      <ExternalLink size={7} className="text-muted-foreground/30" />
                    </a>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Inputs form ── */}
          <ParametersCard
            tool={tool}
            inputs={inputs}
            setInput={setInput}
            onInputsChange={onInputsChange}
            health={health}
            runningCount={runningCount}
            onRun={run}
          />

          {/* ── Output schema (collapsible) ── */}
          {tool.outputs?.length > 0 && (
            <OutputSchemaCollapsible outputs={tool.outputs} />
          )}

          {/* ── Results on small screens (below inputs) ── */}
          <div className="lg:hidden">
            <ResultsPanel results={results} />
          </div>
        </div>

        {/* ═══ RIGHT PANEL — results (desktop only) ═══ */}
        <div className="hidden lg:flex lg:flex-col lg:w-[340px] lg:shrink-0 border-l border-border bg-muted/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 shrink-0">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Results {results.length > 0 && `(${results.length})`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <ResultsPanel results={results} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Results panel (shared between mobile/desktop) ── */

function ResultsPanel({ results }: { results: ResultEntry[] }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mb-2">
          <Play size={12} className="text-muted-foreground/30" />
        </div>
        <p className="text-[10px] text-muted-foreground/40">Run the tool to see results here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {results.map(entry => {
        const isPending = entry.result === null
        const res = entry.result
        return (
          <Card key={entry.id} className={cn(
            'shadow-none',
            isPending ? '' : res!.success ? 'border-emerald-500/20' : 'border-rose-500/20',
          )}>
            <CardHeader className={cn(
              'p-2.5 pb-1.5 flex-row items-center justify-between',
              isPending ? 'bg-muted/20' : res!.success ? 'bg-emerald-500/5' : 'bg-rose-500/5',
            )}>
              <span className="flex items-center gap-1.5">
                {isPending ? (
                  <><Loader2 size={9} className="animate-spin" /> <span className="text-[10px] text-muted-foreground">Running…</span></>
                ) : res!.success ? (
                  <Badge variant="success" className="text-[8px]">✓ Success</Badge>
                ) : (
                  <Badge variant="error" className="text-[8px]">✗ Failed</Badge>
                )}
              </span>
              <span className="text-[8px] text-muted-foreground/40 font-mono">{entry.ts}</span>
            </CardHeader>
            <CardContent className="p-2.5 pt-0">
              {isPending && (
                <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 pt-1">
                  <Loader2 size={9} className="animate-spin" /> Running…
                </div>
              )}
              {!isPending && (
                <div className="space-y-2 pt-1">
                  {res!.error_message && <p className="text-[10px] text-destructive font-medium break-all">{res!.error_message}</p>}
                  {res!.outputs && Object.keys(res!.outputs).length > 0 && <OutputFields outputs={res!.outputs} />}
                  {res!.success && typeof res!.outputs?.pdb_path === 'string' && (
                    <PdbViewer pdbPath={res!.outputs.pdb_path as string} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ── Collapsible output schema ── */

function OutputSchemaCollapsible({ outputs }: { outputs: Array<{ name: string; type: string; description?: string }> }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors group cursor-pointer">
        <ChevronRight size={11} className={cn('transition-transform duration-150', open && 'rotate-90')} />
        Outputs ({outputs.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-wrap gap-2 pt-1.5 pl-4">
          {outputs.map(out => (
            <span key={out.name} className="inline-flex items-center gap-1.5 text-[10px]">
              <span className="font-mono font-medium text-foreground/70">{out.name}</span>
              <Badge variant="secondary" className="text-[8px]">{out.type}</Badge>
            </span>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ── Parameters card with template dropdown ── */

function ParametersCard({
  tool, inputs, setInput, onInputsChange, health, runningCount, onRun,
}: {
  tool: Tool
  inputs: Record<string, string>
  setInput: (name: string, value: string) => void
  onInputsChange: (inputs: Record<string, string>) => void
  health?: { available: boolean; reason: string; install_hint?: string }
  runningCount: number
  onRun: () => void
}) {
  // Build template presets: Defaults + custom examples
  const templates = useMemo(() => {
    const list: Array<{ id: string; name: string; description?: string; values: Record<string, unknown> }> = []

    // "Defaults" template from input default values
    const hasDefaults = (tool.inputs || []).some(inp => inp.default !== undefined)
    if (hasDefaults) {
      const defaults: Record<string, unknown> = {}
      for (const inp of tool.inputs || []) {
        if (inp.default !== undefined) defaults[inp.name] = inp.default
      }
      list.push({ id: '__defaults__', name: 'Defaults', description: 'Use default values', values: defaults })
    }

    // Custom examples from tool definition
    for (const [i, ex] of (tool.examples || []).entries()) {
      list.push({ id: `ex_${i}`, name: ex.name, description: ex.description, values: ex.inputs })
    }

    return list
  }, [tool])

  function applyTemplate(templateId: string) {
    const merged: Record<string, string> = { ...inputs }

    if (templateId === '__clear__') {
      for (const key of Object.keys(merged)) merged[key] = ''
      onInputsChange(merged)
      return
    }

    const tmpl = templates.find(t => t.id === templateId)
    if (!tmpl) return

    for (const [k, v] of Object.entries(tmpl.values)) {
      merged[k] = typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
    onInputsChange(merged)
  }

  const hasTemplates = templates.length > 0

  return (
    <Card>
      <CardHeader className="px-5 py-3 pb-0">
        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {tool.inputs?.length > 0 ? 'Parameters' : 'Run'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {tool.inputs?.length > 0 ? (
          <div className="space-y-5">
            {tool.inputs.map(inp => (
              <div key={inp.name} className="space-y-2">
                {/* Label row */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`param-${inp.name}`} className="font-mono font-semibold text-sm text-foreground">
                    {inp.name}
                  </Label>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 h-4 border-border/60">
                    {inp.type}
                  </Badge>
                  {inp.default !== undefined && (
                    <span className="text-[10px] text-muted-foreground/50 ml-auto font-mono">
                      default: {String(inp.default)}
                    </span>
                  )}
                </div>
                {inp.description && (
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">{inp.description}</p>
                )}
                {/* Input */}
                <Input
                  id={`param-${inp.name}`}
                  value={inputs[inp.name] ?? ''}
                  onChange={e => setInput(inp.name, e.target.value)}
                  placeholder={inp.default !== undefined ? String(inp.default) : `Enter ${inp.type}…`}
                  className="font-mono text-sm h-10"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 py-2">
            <Info size={12} /> No inputs required — click Run below.
          </div>
        )}

        {/* Run footer */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/40">
          {health && !health.available && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
              <AlertTriangle size={10} /> Unavailable
            </span>
          )}
          {runningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              {runningCount} running
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {hasTemplates && tool.inputs?.length > 0 && (
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs gap-1 px-2.5 border-dashed">
                  <SelectValue placeholder="Load template…" />
                </SelectTrigger>
                <SelectContent align="end">
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      <span className="font-medium">{t.name}</span>
                      {t.description && <span className="text-muted-foreground ml-1.5">— {t.description}</span>}
                    </SelectItem>
                  ))}
                  <SelectItem value="__clear__" className="text-xs text-muted-foreground">
                    Clear all
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={onRun} size="sm" className="h-8 px-4 text-xs">
              <Play size={10} className="mr-1.5" /> Run
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
