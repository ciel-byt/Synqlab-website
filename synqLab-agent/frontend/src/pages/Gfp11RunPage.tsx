/**
 * Gfp11RunPage — a fully integrated mock pipeline run for the GFP11
 * brightness optimisation demo.
 *
 * Route: /lab/pipelines/gfp11/run
 *
 * Everything is scripted/simulated. No backend calls are made.
 * The page uses the same UI primitives as PipelinePage so it looks
 * completely native.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { load3Dmol } from '@/lib/load3dmol'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, StopCircle, CheckCircle2, XCircle,
  FlaskConical, Dna, Cpu, Activity, Trophy,
  ChevronRight, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import mockRunPdb from '../assets/4KF5.pdb?raw'

// ─────────────────────────────────────────────────────────────────────────────
// Static mock data
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_NODES = [
  { id: 'vae',        label: 'Brightness VAE',     desc: 'Generate candidate variants from bright latent regions' },
  { id: 'fold',       label: 'AlphaFold-Multimer', desc: 'Predict complex structure and confidence metrics' },
  { id: 'stability',  label: 'Stability Gate',     desc: 'ΔΔG < 2 kcal/mol threshold' },
  { id: 'interact',   label: 'Interaction Gate',   desc: 'GFP1-10 binding compatibility' },
  { id: 'rank',       label: 'Ranker',             desc: 'Sort by predicted brightness × stability' },
  { id: 'update',     label: 'Model Update',       desc: 'Fine-tune model after each round' },
]

type NodeStatus = 'pending' | 'running' | 'done' | 'failed'

interface RunNode { id: string; status: NodeStatus }

// Script of log lines emitted during a 60-second run
const LOG_SCRIPT: { t: number; line: string }[] = [
  { t: 500,  line: '[Research Director] Parsed objective: maximize GFP11 fluorescence, preserve GFP1-10 interface' },
  { t: 1200, line: '[Data Agent] Loaded 113 labelled sequences — brightness range 0.12×–1.00×' },
  { t: 2000, line: '[Data Agent] Detected 2 duplicates, 0 missing labels. Dataset quality: Ready' },
  { t: 3000, line: '[Model Agent] Starting brightness model training (round 0 prior)' },
  { t: 4500, line: '[Model Agent] Cross-validation R²: 0.71 — model ready' },
  { t: 5500, line: '────────────── Round 1 / 3 ──────────────' },
  { t: 6000, line: '[Sequence Worker] Generating 50 GFP11 variant candidates via ProtGPT2…' },
  { t: 8000, line: '[Sequence Worker] 50 candidates generated — diversity score: 0.84' },
  { t: 9000, line: '[Folding Worker] Predicting structures with AlphaFold-Multimer (50 sequences)…' },
  { t: 12000,line: '[Folding Worker] All structures predicted — mean pLDDT: 74.3' },
  { t: 13000,line: '[Brightness Worker] Scoring candidates with brightness model…' },
  { t: 14500,line: '[Brightness Worker] Top candidate: GFP11-V37 → predicted 1.42×' },
  { t: 15000,line: '[Stability Gate] Running ΔΔG evaluation on AlphaFold structures…' },
  { t: 16500,line: '[Stability Gate] Rejected 18 candidates (ΔΔG > 2.0 kcal/mol)' },
  { t: 17500,line: '[Interaction Gate] Evaluating GFP1-10 interface compatibility…' },
  { t: 19000,line: '[Interaction Gate] Rejected 11 candidates (low interface score)' },
  { t: 20000,line: '[Ranker] Ranked 21 survivors — top 5 selected for round shortlist' },
  { t: 21000,line: '[Learning Worker] Round 1 complete — retraining brightness model with 21 new labels' },
  { t: 22500,line: '[Learning Worker] Updated model R²: 0.76 (+0.05)' },
  { t: 23500,line: '────────────── Round 2 / 3 ──────────────' },
  { t: 24000,line: '[Sequence Worker] Biasing generator toward high-brightness regions…' },
  { t: 26000,line: '[Sequence Worker] 50 candidates generated — diversity score: 0.79' },
  { t: 27500,line: '[Folding Worker] AlphaFold-Multimer complete — mean pLDDT: 77.1 (+2.8)' },
  { t: 29000,line: '[Brightness Worker] Top candidate: GFP11-V51 → predicted 1.63×' },
  { t: 30500,line: '[Stability Gate] Rejected 14 candidates' },
  { t: 32000,line: '[Interaction Gate] Rejected 8 candidates' },
  { t: 33000,line: '[Ranker] 28 survivors — round 2 top 5 selected' },
  { t: 34500,line: '[Learning Worker] Updated model R²: 0.81 (+0.05)' },
  { t: 35500,line: '────────────── Round 3 / 3 ──────────────' },
  { t: 36500,line: '[Sequence Worker] Generator converging on high-confidence region…' },
  { t: 38500,line: '[Sequence Worker] 50 candidates generated — diversity score: 0.71' },
  { t: 40000,line: '[Folding Worker] AlphaFold-Multimer complete — mean pLDDT: 79.4 (+2.3)' },
  { t: 41500,line: '[Brightness Worker] Top candidate: GFP11-V62 → predicted 1.87×' },
  { t: 43000,line: '[Stability Gate] Rejected 12 candidates' },
  { t: 44500,line: '[Interaction Gate] Rejected 9 candidates' },
  { t: 46000,line: '[Ranker] 29 survivors — final top 5 selected' },
  { t: 47500,line: '[Learning Worker] Final model R²: 0.84 — improvement: +0.13 over baseline' },
  { t: 49000,line: '────────────── Results ──────────────' },
  { t: 50000,line: '[Research Director] Hit rate improved: 12% → 24% → 38%' },
  { t: 51500,line: '[Research Director] Compute saved by gated evaluation: 68%' },
  { t: 53000,line: '[Research Director] 5 candidates ready for wet-lab validation' },
  { t: 54500,line: '[Artifact Agent] Generating candidate FASTA file…' },
  { t: 55500,line: '[Artifact Agent] Generating round report PDF…' },
  { t: 57000,line: '[Artifact Agent] All artifacts saved' },
  { t: 58000,line: '✓ Pipeline completed successfully' },
]

// Node timing — which node is active at which ms
const NODE_TIMELINE: { start: number; end: number; nodeId: string }[] = [
  { start: 1200,  end: 8500,  nodeId: 'vae' },
  { start: 9000,  end: 12500, nodeId: 'fold' },
  { start: 15000, end: 16500, nodeId: 'stability' },
  { start: 17500, end: 19500, nodeId: 'interact' },
  { start: 20000, end: 21000, nodeId: 'rank' },
  { start: 21000, end: 22500, nodeId: 'update' },
]

// KPI snapshots at t=0, t=22s (after round 1), t=35s (after round 2), t=58s (done)
const KPI_SNAPSHOTS = [
  { t: 0,     brightness: '—',     hitRate: '—',   cost: '—',   candidates: 0, picks: 0 },
  { t: 22500, brightness: '1.42×', hitRate: '12%', cost: '31%', candidates: 50, picks: 0 },
  { t: 34500, brightness: '1.63×', hitRate: '24%', cost: '52%', candidates: 100, picks: 0 },
  { t: 57000, brightness: '1.87×', hitRate: '38%', cost: '68%', candidates: 150, picks: 5 },
]

const FUNNEL_SNAPSHOTS = [
  { t: 0,     generated: 0,   folded: 0,  stable: 0,  binding: 0,  picks: 0 },
  { t: 20000, generated: 50,  folded: 50, stable: 32, binding: 21, picks: 0 },
  { t: 33000, generated: 100, folded: 100,stable: 64, binding: 49, picks: 0 },
  { t: 57000, generated: 150, folded: 150,stable: 96, binding: 58, picks: 5 },
]

const TOP_CANDIDATES = [
  { rank: 1, id: 'GFP11-V62', seq: 'MSLIAKRLAVDRVIGMENAMPWNL', brightness: '1.87×', stability: 'Pass', binding: '94%' },
  { rank: 2, id: 'GFP11-V51', seq: 'MSLIAALAVERVIGMENAMPWNL',  brightness: '1.63×', stability: 'Pass', binding: '91%' },
  { rank: 3, id: 'GFP11-V37', seq: 'MSLIAALAVDRVIGMKNAMPWNL', brightness: '1.42×', stability: 'Pass', binding: '89%' },
  { rank: 4, id: 'GFP11-V44', seq: 'MSLIAALAVDRVIGMENAMPFNL', brightness: '1.31×', stability: 'Pass', binding: '86%' },
  { rank: 5, id: 'GFP11-V19', seq: 'MSLIAALAVDRVIGMENAMPWDL', brightness: '1.19×', stability: 'Pass', binding: '83%' },
]

const MOCK_PDB = mockRunPdb

// ─────────────────────────────────────────────────────────────────────────────
// Inline 3D viewer using 3Dmol (same as PdbViewer.tsx but with inline PDB)
// ─────────────────────────────────────────────────────────────────────────────

declare global { interface Window { $3Dmol: unknown } }

function MockPdbViewer({ visible }: { visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null

    async function init() {
      await load3Dmol()
      if (cancelled || !containerRef.current) return

      await new Promise<void>((resolve) => {
        const check = () => {
          if (!containerRef.current) { resolve(); return }
          const { width, height } = containerRef.current.getBoundingClientRect()
          if (width > 0 && height > 0) resolve()
          else requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      })
      if (cancelled || !containerRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      viewer = (window.$3Dmol as any).createViewer(containerRef.current, {
        backgroundColor: 'white',
        antialias: true,
      })
      viewer.addModel(MOCK_PDB, 'pdb')
      // Render the real PDB in a clean style without mock overlays.
      viewer.setStyle({}, { cartoon: { colorscheme: 'chain' } })
      viewer.addStyle({ hetflag: true }, { stick: { radius: 0.15, colorscheme: 'greenCarbon' } })
      viewer.zoomTo()
      viewer.zoom(1.1)
      viewer.render()

      // Auto-rotate slowly for visual effect
      const rotate = () => {
        if (cancelled) return
        try { viewer?.rotate(0.5, { x: 0, y: 1, z: 0 }); viewer?.render() } catch { /* ignore */ }
        requestAnimationFrame(rotate)
      }
      rotate()

      if (!cancelled) setStatus('ready')
    }

    init().catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      try { viewer?.clear() } catch { /* ignore */ }
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm" style={{ height: 500 }}>
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Dna size={12} className="text-primary/70" />
        <span className="text-[13px] font-semibold whitespace-nowrap">Best candidate — GFP11-V62 · AlphaFold-Multimer</span>
        <span className="ml-auto text-[11px] font-mono text-teal-600">pLDDT 79.4 · 1.87×</span>
      </div>
      <div className="px-4 py-2 border-b border-border/40 text-[11px] text-muted-foreground/70 bg-muted/15">
        Rendered from `4KF5.pdb` (cartoon by chain + ligand sticks)
      </div>
      <div className="relative w-full bg-white" style={{ height: 440 }}>
        <div ref={containerRef} className="w-full h-full" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-500 bg-white z-10">
            <Loader2 size={14} className="animate-spin" /> Loading structure…
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 bg-white z-10">
            Structure preview unavailable in this environment
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function lerp<T extends Record<string, number>>(snaps: ({ t: number } & T)[], now: number): T {
  const clipped = Math.min(now, snaps[snaps.length - 1].t)
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (clipped >= snaps[i].t) return snaps[i] as unknown as T
  }
  return snaps[0] as unknown as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_MS = 58500
const RUN_STATE_KEY = 'gfp11-demo-run-state-v1'

type PersistedRunState = {
  phase: 'idle' | 'running' | 'stopped' | 'done'
  elapsed: number
  logs: string[]
  startedAt: number | null
}

export function Gfp11RunPage() {
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'idle' | 'running' | 'stopped' | 'done'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number>(0) // absolute unix ms when run started/resumed
  const rafRef = useRef<number>(0)
  const [logs, setLogs] = useState<string[]>([])
  const logSetRef = useRef<Set<number>>(new Set())
  const logScrollRef = useRef<HTMLDivElement>(null)

  const hydrateLogsToElapsed = useCallback((ms: number) => {
    const logTimes = LOG_SCRIPT.filter(e => e.t <= ms).map(e => e.t)
    logSetRef.current = new Set(logTimes)
    setLogs(LOG_SCRIPT.filter(e => e.t <= ms).map(e => e.line))
  }, [])

  // Drive the timer with requestAnimationFrame for smooth progress
  const tick = useCallback(() => {
    const now = Math.max(0, Date.now() - startRef.current)
    setElapsed(now)

    // Emit scripted log lines
    for (const entry of LOG_SCRIPT) {
      if (now >= entry.t && !logSetRef.current.has(entry.t)) {
        logSetRef.current.add(entry.t)
        setLogs((prev) => [...prev, entry.line])
      }
    }

    if (now >= TOTAL_MS) {
      setPhase('done')
      setElapsed(TOTAL_MS)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  function start() {
    setPhase('running')
    // Resume if previously stopped with partial progress; otherwise fresh run.
    if (elapsed > 0 && elapsed < TOTAL_MS) {
      startRef.current = Date.now() - elapsed
    } else {
      setLogs([])
      setElapsed(0)
      logSetRef.current = new Set()
      startRef.current = Date.now()
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function stop() {
    cancelAnimationFrame(rafRef.current)
    setPhase('stopped')
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Restore run state after remount (e.g. switching tabs/views)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RUN_STATE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as PersistedRunState
      if (!saved) return

      const clampedElapsed = Math.min(Math.max(saved.elapsed ?? 0, 0), TOTAL_MS)
      if (saved.phase === 'running' && saved.startedAt) {
        const resumedElapsed = Math.min(Math.max(Date.now() - saved.startedAt, 0), TOTAL_MS)
        setElapsed(resumedElapsed)
        hydrateLogsToElapsed(resumedElapsed)
        if (resumedElapsed >= TOTAL_MS) {
          setPhase('done')
        } else {
          setPhase('running')
          startRef.current = saved.startedAt
          rafRef.current = requestAnimationFrame(tick)
        }
      } else {
        setPhase(saved.phase || 'idle')
        setElapsed(clampedElapsed)
        setLogs(saved.logs || [])
        logSetRef.current = new Set(LOG_SCRIPT.filter(e => e.t <= clampedElapsed).map(e => e.t))
      }
    } catch {
      // ignore malformed local state
    }
  }, [hydrateLogsToElapsed, tick])

  // Persist run state so moving between tabs doesn't restart.
  useEffect(() => {
    const payload: PersistedRunState = {
      phase,
      elapsed,
      logs,
      startedAt: phase === 'running' ? startRef.current : null,
    }
    try { localStorage.setItem(RUN_STATE_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
  }, [phase, elapsed, logs])

  // Auto-scroll logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
    }
  }, [logs])

  // Compute node statuses from timeline
  const nodeStatuses: RunNode[] = PIPELINE_NODES.map((n) => {
    const entry = NODE_TIMELINE.find((e) => e.nodeId === n.id)
    if (!entry) return { id: n.id, status: 'pending' }
    if (elapsed < entry.start) return { id: n.id, status: 'pending' }
    if (elapsed >= entry.end) return { id: n.id, status: 'done' }
    return { id: n.id, status: 'running' }
  })

  // For "done" phase — mark all nodes done
  const finalNodes: RunNode[] = phase === 'done'
    ? PIPELINE_NODES.map((n) => ({ id: n.id, status: 'done' }))
    : nodeStatuses

  const kpi = lerp(KPI_SNAPSHOTS, elapsed)
  const funnel = lerp(FUNNEL_SNAPSHOTS, elapsed)
  const progress = Math.min((elapsed / TOTAL_MS) * 100, 100)
  const isDone = phase === 'done'
  const isRunning = phase === 'running'
  const showPdb = isDone || elapsed > 41000

  return (
    <div className="h-full min-h-0 overflow-auto bg-background">
      <div className="w-full p-4 md:p-6 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/lab/pipelines')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-slate-500" />
            <h1 className="text-base font-semibold">GFP11 Brightness Redesign</h1>
            <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700">
              3 rounds · 50 candidates each
            </Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {phase === 'idle' && (
              <Button onClick={start} className="gap-2">
                <Activity size={14} /> Start run
              </Button>
            )}
            {isRunning && (
              <Button variant="destructive" onClick={stop} className="gap-2">
                <StopCircle size={14} /> Stop
              </Button>
            )}
            {phase === 'stopped' && (
              <>
                <span className="text-xs text-orange-400">Run stopped — showing partial results</span>
                <Button variant="outline" onClick={start} className="gap-2">
                  <Activity size={14} /> Restart
                </Button>
              </>
            )}
            {isDone && (
              <span className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                <CheckCircle2 size={14} /> Run complete
              </span>
            )}
          </div>
        </div>

        {/* ── Progress bar ── */}
        {(isRunning || isDone || phase === 'stopped') && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isDone ? 'Pipeline complete — 3 / 3 rounds' :
                 phase === 'stopped' ? 'Stopped mid-run — partial results below' :
                 elapsed < 22500 ? 'Round 1 / 3' : elapsed < 35000 ? 'Round 2 / 3' : 'Round 3 / 3'}
              </span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isDone ? 'bg-slate-700 dark:bg-slate-300' : phase === 'stopped' ? 'bg-orange-500' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Pipeline DAG nodes ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3">Pipeline nodes</div>
          <div className="flex flex-wrap gap-2 items-center">
            {PIPELINE_NODES.map((n, i) => {
              const ns = finalNodes.find((fn) => fn.id === n.id)
              const status = ns?.status ?? 'pending'
              return (
                <div key={n.id} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition-all duration-300',
                      status === 'done'    && 'border-slate-400/40 bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200',
                      status === 'running' && 'border-primary/60 bg-primary/10 text-primary shadow-[0_0_14px_rgba(99,102,241,0.35)]',
                      status === 'failed'  && 'border-red-500/40 bg-red-500/10 text-red-300',
                      status === 'pending' && 'border-border bg-muted/20 text-muted-foreground',
                    )}
                  >
                    {status === 'running' && <Loader2 size={11} className="animate-spin flex-shrink-0" />}
                  {status === 'done'    && <CheckCircle2 size={11} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    {status === 'failed'  && <XCircle size={11} className="flex-shrink-0" />}
                    {status === 'pending' && <div className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />}
                    <span>{n.label}</span>
                  </div>
                  {i < PIPELINE_NODES.length - 1 && (
                    <ChevronRight size={12} className="text-muted-foreground/30 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Log stream */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] font-semibold text-muted-foreground/70 mb-2">Agent execution log</div>
            <div
              ref={logScrollRef}
              className="h-[280px] overflow-auto rounded-md border border-border/50 bg-muted/20 p-3 space-y-0.5 font-mono text-[11px]"
            >
              {logs.length === 0 && (
                <span className="text-muted-foreground/50">Press "Start run" to begin…</span>
              )}
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'leading-relaxed',
                    line.startsWith('✓') && 'text-emerald-400 font-semibold',
                    line.startsWith('──') && 'text-primary/70 font-semibold',
                    line.includes('Rejected') && 'text-orange-400',
                    !line.startsWith('✓') && !line.startsWith('──') && !line.includes('Rejected') && 'text-muted-foreground/80',
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* KPIs + funnel */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3">Key metrics</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Best Brightness', value: kpi.brightness },
                  { label: 'Hit Rate', value: typeof kpi.hitRate === 'string' ? kpi.hitRate : `${kpi.hitRate}%` },
                  { label: 'Cost Saved', value: typeof kpi.cost === 'string' ? kpi.cost : `${kpi.cost}%` },
                  { label: 'Candidates', value: String(kpi.candidates) },
                  { label: 'Wet-lab Picks', value: String(kpi.picks) },
                  { label: 'Model R²', value: elapsed > 47000 ? '0.84' : elapsed > 34500 ? '0.81' : elapsed > 22000 ? '0.76' : '0.71' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                    <div className="text-[10px] text-muted-foreground/70">{label}</div>
                    <div className="text-base font-semibold font-mono mt-0.5">{value === '0' || value === '' ? '—' : value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Candidate funnel */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3">Candidate funnel</div>
              <div className="space-y-2">
                {[
                  { label: 'Generated', value: funnel.generated, color: 'bg-sky-500/70' },
                  { label: 'Folded',    value: funnel.folded,    color: 'bg-blue-500/70' },
                  { label: 'Stable',    value: funnel.stable,    color: 'bg-violet-500/70' },
                  { label: 'Binding+',  value: funnel.binding,   color: 'bg-emerald-500/70' },
                  { label: 'Top picks', value: funnel.picks,     color: 'bg-amber-500/90' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-20 text-muted-foreground shrink-0">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', color)}
                        style={{ width: funnel.generated > 0 ? `${Math.max(4, (value / 150) * 100)}%` : '0%' }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Round improvement bars ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3">Round-over-round improvement</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Hit rate', rounds: [12, 24, 38], active: elapsed > 22000 ? (elapsed > 34500 ? 3 : 2) : (elapsed > 5000 ? 1 : 0) },
              { label: 'Best brightness ×', rounds: [1.42, 1.63, 1.87], active: elapsed > 22000 ? (elapsed > 34500 ? 3 : 2) : (elapsed > 5000 ? 1 : 0) },
              { label: 'Model R²', rounds: [0.76, 0.81, 0.84], active: elapsed > 22000 ? (elapsed > 34500 ? 3 : 2) : (elapsed > 5000 ? 1 : 0) },
            ].map(({ label, rounds, active }) => (
              <div key={label}>
                <div className="text-[10px] text-muted-foreground/70 mb-2">{label}</div>
                <div className="space-y-1.5">
                  {rounds.map((v, i) => {
                    const pct = Math.min((v / (Math.max(...rounds) * 1.05)) * 100, 100)
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="w-14 text-muted-foreground shrink-0">Round {i + 1}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-1000"
                            style={{ width: active > i ? `${pct}%` : '0%' }}
                          />
                        </div>
                        <span className="font-mono w-8 text-right">{active > i ? v : '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3D structure + candidates (appear when available) ── */}
        {showPdb && (
          <div className="space-y-4">
            <MockPdbViewer visible={showPdb} />

            <div className="rounded-lg border border-border bg-card">
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Trophy size={13} className="text-amber-400" />
                <span className="text-[12px] font-semibold">Top candidates</span>
                {isDone && <Badge className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">5 / 150 survived</Badge>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground/70">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground/70">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground/70">Sequence</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground/70">Brightness</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground/70">Binding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_CANDIDATES.map((c) => (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2">
                          <span className={cn(
                            'inline-flex w-4 h-4 rounded-full items-center justify-center text-[9px] font-bold',
                            c.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-muted text-muted-foreground'
                          )}>{c.rank}</span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-primary">{c.id}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground max-w-[140px] truncate">{c.seq}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">{c.brightness}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{c.binding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Artifacts ── */}
        {isDone && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3">Generated artifacts</div>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'top5_candidates.fasta', size: '2.1 KB', icon: '🧬' },
                { name: 'round_report.md',        size: '8.4 KB', icon: '📄' },
                { name: 'brightness_model.pkl',   size: '124 KB', icon: '🧠' },
                { name: 'gfp11_v62_structure.pdb',size: '48 KB',  icon: '🔬' },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">
                  <span>{a.icon}</span>
                  <span className="font-mono">{a.name}</span>
                  <span className="text-muted-foreground/60">{a.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Spacer so stop button is never obscured ── */}
        <div className="h-6" />
      </div>
    </div>
  )
}
