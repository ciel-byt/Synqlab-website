/**
 * MockGfp11Chat — multi-turn scripted agent demo for GFP11 brightness
 * optimization. Looks and feels exactly like a real AgentChat session.
 *
 * Scripted turn sequence:
 *   1. User sends goal message
 *   2. Agent asks for dataset file
 *   3. User "uploads" gfp11_brightness.xlsx (simulated file chip)
 *   4. Agent reads & analyzes — inline stats + sparkline charts
 *   5. Agent proposes VAE architecture with reasoning
 *   6. Agent trains — live animated loss curve
 *   7. Agent confirms model ready, drops pipeline card
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, GitBranch, ArrowRight, FileSpreadsheet,
  Upload, CheckCircle2, Brain, Loader2, Terminal,
  Search, Wrench, Cpu, FlaskConical, ScanSearch,
  BookOpen, Layers, Zap, ChevronDown, ChevronRight as ChevronRightIcon,
  ArrowLeft, X, Maximize2,
} from 'lucide-react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Handle, Position, MarkerType,
  type Node as RFNode, type Edge as RFEdge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/blocks/MarkdownContent'
import { InitialsAvatar } from '@/components/blocks/InitialsAvatar'
import { useAuth } from '@/contexts/AuthContext'

// ─── Timing constants (ms from demo start) ───────────────────────────────────

const T = {
  // Turn 1: user goal
  USER_GOAL: 0,
  // Turn 2: agent asks for file
  AGENT_ASK_START: 800,
  AGENT_ASK_DONE: 3500,
  // Turn 3: user uploads file (simulated button click at a natural pause)
  USER_UPLOAD: 5200,
  // Turn 4: agent reads file — analysis phase
  AGENT_READ_START: 6000,
  AGENT_READ_DONE: 9500,
  SHOW_DATASET_CARD: 10000,
  // Turn 5: agent proposes model
  AGENT_MODEL_START: 11000,
  AGENT_MODEL_DONE: 16000,
  // Turn 6: training animation
  SHOW_TRAINING: 16800,
  TRAINING_DONE: 24000,
  // Turn 7: agent wraps up + pipeline card
  AGENT_WRAP_START: 24500,
  AGENT_WRAP_DONE: 28500,
  SHOW_PIPELINE_CARD: 29000,
}

// ─── Scripted text ────────────────────────────────────────────────────────────

const GOAL_MSG =
  'I have split-GFP assay brightness data for 113 GFP11 variants in an Excel file. I want to design a closed-loop workflow that finds brighter variants while keeping GFP1-10 binding and thermal stability intact. Three rounds, 50 candidates each, top five for wet-lab.'

const ASK_MSG = `Got it — this is a closed-loop peptide optimisation problem with a task-specific fitness function.

Before I design the pipeline, I need your experimental dataset. Please upload your brightness measurements so I can:

- Inspect sequence diversity and coverage
- Fit the brightness distribution
- Choose the right generative model architecture

**Upload your data** (a spreadsheet with sequences and measured values).`

const READ_MSG = `Reading \`gfp11_brightness.xlsx\`…

Parsing columns: \`sequence\`, \`brightness_normalised\`, \`replicate_1\`, \`replicate_2\`, \`replicate_3\`

Running quality checks — deduplication, missing values, replicate consistency…`

const MODEL_MSG = `Dataset looks clean. Here's what I found and how it shapes the architecture decision:

**Key observations**
- Sequences cluster into 4 mutational neighbourhoods around the wild-type core
- Brightness is bimodal: 61% of variants score below 0.35× (dark), 39% above 0.65× (bright) — the valley is sparse
- Replicates agree well (Pearson r = 0.94), so labels are reliable
- Median sequence length: 16 aa · no insertions/deletions

**Model selection: Variational Autoencoder (VAE)**

A VAE is the right choice here because:
1. The latent space captures continuous sequence–fitness topology — we can *interpolate* toward high-brightness regions rather than sampling blindly
2. The bimodal label distribution maps cleanly onto a structured latent manifold
3. The encoder learns a compressed representation of sequence context (critical for 16-aa peptides where every residue matters)
4. At inference time we condition the decoder on the bright cluster centroid and sample diverse neighbours

Architecture: encoder → 2-layer MLP → **z ∈ ℝ⁸** → decoder → sequence logits + predicted brightness head

Based on this analysis, here's the closed-loop pipeline I'd recommend. Please review and approve before I start building.`

const WRAP_MSG = `Model trained — VAE converged cleanly (reconstruction loss 0.021 · KL 0.18 · brightness RMSE 0.09).

The latent space shows a clear gradient from dark → bright variants. I'll use the bright-cluster centroid as the generation seed for Round 1.

**Pipeline is ready.** Here's what runs next:

1. **VAE Sampler** — draws 50 novel sequences per round from bright latent region
2. **AlphaFold-Multimer** — predicts GFP11:GFP1-10 complex structure
3. **Stability Gate** — ΔΔG < 2.0 kcal/mol threshold
4. **Interaction Gate** — interface score filter
5. **Ranker** — composite brightness × stability score
6. **VAE Fine-tune** — retrains on each round's wet-lab labels (closed loop)

→ Expected hit rate: 12% (R1) → 24% (R2) → 38% (R3)`

// ─── CollapsibleCard — works for both streaming and finished states ──────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconType = any

interface CollapsibleCardProps {
  icon: IconType
  title: string
  subtitle?: string
  running?: boolean
  done?: boolean
  /** When true, card auto-collapses once done. Default true. */
  autoCollapse?: boolean
  /** Optional action button to the right (e.g. "Open" link) */
  rightAction?: React.ReactNode
  /** Optional container width override (e.g. max-w-[680px]) */
  containerClassName?: string
  children: React.ReactNode
}

function CollapsibleCard({
  icon: Icon, title, subtitle, running, done,
  autoCollapse = true, rightAction, containerClassName, children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(true)
  const collapsedRef = useRef(false)

  // Auto-collapse once done, but only once
  useEffect(() => {
    if (done && autoCollapse && !collapsedRef.current) {
      collapsedRef.current = true
      const t = setTimeout(() => setOpen(false), 1100)
      return () => clearTimeout(t)
    }
  }, [done, autoCollapse])

  return (
    <div className={cn(
      'rounded-lg border border-border/60 bg-card/40 overflow-hidden max-w-[520px] group',
      containerClassName
    )}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={open ? 'Click to collapse' : 'Click to expand'}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left cursor-pointer"
      >
        <Icon size={12} className="text-muted-foreground/70 flex-shrink-0" />
        <span className="text-[11.5px] font-medium text-foreground/85">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground/55 truncate">· {subtitle}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {running && <Loader2 size={10} className="animate-spin text-primary/50" />}
          {done    && <CheckCircle2 size={10} className="text-emerald-500/80" />}
          {rightAction}
          {/* Chevron in a circular pill for clear click affordance */}
          <span className={cn(
            'flex items-center justify-center w-5 h-5 rounded-full border transition-all',
            open
              ? 'border-border/60 bg-muted/30 text-muted-foreground/70'
              : 'border-primary/30 bg-primary/8 text-primary/85 group-hover:bg-primary/15',
          )}>
            {open
              ? <ChevronDown      size={11} />
              : <ChevronRightIcon size={11} />
            }
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Streaming terminal lines ─────────────────────────────────────────────────

type TermLine =
  | { kind: 'cmd';     text: string }   // $ command line
  | { kind: 'out';     text: string }   // plain output
  | { kind: 'code';    text: string }   // syntax-highlighted snippet
  | { kind: 'ok';      text: string }   // green success line
  | { kind: 'dim';     text: string }   // grey info

// Each entry: [delay_from_prev_ms, line]
const TERM_SCRIPT: [number, TermLine][] = [
  [0,    { kind: 'cmd',  text: 'python synqlab/models/build_vae.py --data gfp11_brightness.xlsx' }],
  [350,  { kind: 'dim',  text: '→ loading dataset (113 sequences, 16 aa each)' }],
  [500,  { kind: 'dim',  text: '→ one-hot encoding: vocab size 20, dim 16×20=320' }],
  [500,  { kind: 'code', text: 'class BrightnessVAE(nn.Module):' }],
  [300,  { kind: 'code', text: '    # Encoder: seq → μ, σ in ℝ⁸' }],
  [250,  { kind: 'code', text: '    self.enc = nn.Sequential(Linear(320,128), GELU(), Linear(128,128))' }],
  [300,  { kind: 'code', text: '    self.mu_head  = Linear(128, Z_DIM)   # Z_DIM = 8' }],
  [250,  { kind: 'code', text: '    self.logv_head = Linear(128, Z_DIM)' }],
  [350,  { kind: 'code', text: '    # Decoder: z → seq logits + brightness ∈ [0,1]' }],
  [250,  { kind: 'code', text: '    self.dec        = nn.Sequential(Linear(8,128), GELU(), Linear(128,128))' }],
  [250,  { kind: 'code', text: '    self.bright_head = nn.Sequential(Linear(128,32), GELU(), Linear(32,1), Sigmoid())' }],
  [400,  { kind: 'dim',  text: '→ model parameters: 214,304' }],
  [300,  { kind: 'dim',  text: '→ optimiser: AdamW lr=3e-4 · cosine schedule 30 epochs' }],
  [350,  { kind: 'cmd',  text: '# starting training loop…' }],
  [400,  { kind: 'out',  text: 'epoch 00 | loss 0.421 | recon 0.38 | kl 0.41 | brightness rmse 0.31' }],
  [600,  { kind: 'out',  text: 'epoch 05 | loss 0.241 | recon 0.21 | kl 0.23 | brightness rmse 0.19' }],
  [600,  { kind: 'out',  text: 'epoch 10 | loss 0.158 | recon 0.13 | kl 0.19 | brightness rmse 0.14' }],
  [600,  { kind: 'out',  text: 'epoch 15 | loss 0.113 | recon 0.09 | kl 0.15 | brightness rmse 0.11' }],
  [600,  { kind: 'out',  text: 'epoch 20 | loss 0.089 | recon 0.07 | kl 0.13 | brightness rmse 0.09' }],
  [600,  { kind: 'out',  text: 'epoch 25 | loss 0.083 | recon 0.06 | kl 0.12 | brightness rmse 0.09' }],
  [500,  { kind: 'ok',   text: '✓  epoch 29 | loss 0.021 — converged (Δloss < 1e-3 for 4 epochs)' }],
  [300,  { kind: 'ok',   text: '✓  model saved → artifacts/brightness_vae.pt' }],
  [250,  { kind: 'dim',  text: '→ bright-cluster centroid computed in latent space (z̄_bright)' }],
  [250,  { kind: 'ok',   text: '✓  VAE ready · generation seeded from z̄_bright' }],
]

function StreamingCode({
  visibleCount,
  onOpenTab,
}: {
  visibleCount: number
  onOpenTab?: () => void
}) {
  const codeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight
  }, [visibleCount])

  const done = visibleCount >= TERM_SCRIPT.length

  return (
    <CollapsibleCard
      icon={Terminal}
      title="build_vae.py"
      subtitle={done ? `${TERM_SCRIPT.length} lines · trained` : 'training brightness model'}
      running={!done}
      done={done}
      containerClassName="max-w-[760px]"
      rightAction={onOpenTab ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onOpenTab() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenTab() } }}
          title="Open code in tab"
          className="flex items-center justify-center w-5 h-5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer"
        >
          <Maximize2 size={9} />
        </span>
      ) : undefined}
    >
      <div ref={codeRef} className="px-3.5 py-3 bg-[#0d1117] font-mono text-[11px] leading-relaxed space-y-0.5 max-h-[290px] overflow-y-auto">
        {TERM_SCRIPT.slice(0, visibleCount).map(([, line], i) => {
          const isLast = i === visibleCount - 1 && !done
          return (
            <div key={i} className="flex items-start gap-2">
              {line.kind === 'cmd'  && <span className="text-emerald-400 select-none shrink-0">$</span>}
              {line.kind === 'code' && <span className="text-primary/40 select-none shrink-0">·</span>}
              {(line.kind === 'out' || line.kind === 'dim' || line.kind === 'ok') && (
                <span className="select-none shrink-0 w-3" />
              )}
              <span className={cn(
                'whitespace-pre-wrap break-all',
                line.kind === 'cmd'  && 'text-white/90',
                line.kind === 'out'  && 'text-white/55',
                line.kind === 'dim'  && 'text-white/35',
                line.kind === 'ok'   && 'text-emerald-400',
                line.kind === 'code' && 'text-sky-300/80',
              )}>
                {line.text}
                {isLast && (
                  <span className="inline-block w-1.5 h-3 bg-white/70 ml-0.5 animate-pulse align-text-bottom rounded-sm" />
                )}
              </span>
            </div>
          )
        })}
      </div>
    </CollapsibleCard>
  )
}

// ─── Dataset mock stats ───────────────────────────────────────────────────────

const STATS = [
  { label: 'Sequences',      value: '113' },
  { label: 'Unique',         value: '111' },
  { label: 'Bright (≥0.65×)', value: '44' },
  { label: 'Dark (<0.35×)',   value: '69' },
  { label: 'Replicate r',    value: '0.94' },
  { label: 'Median length',  value: '16 aa' },
]

// Brightness histogram bins [0–1] split into 10 buckets
const HIST_BINS = [4, 11, 18, 16, 8, 6, 9, 14, 12, 15]
const SEQ_LENGTHS = [2, 8, 76, 22, 5] // distribution around 16aa

// ─── Helper: streaming hook ───────────────────────────────────────────────────

function useStream(text: string, startAt: number, charIntervalMs = 14) {
  const [streamed, setStreamed] = useState('')
  const [done, setDone] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const outer = setTimeout(() => {
      if (started.current) return
      started.current = true
      let idx = 0
      const iv = setInterval(() => {
        idx += 2
        setStreamed(text.slice(0, idx))
        if (idx >= text.length) {
          clearInterval(iv)
          setDone(true)
        }
      }, charIntervalMs)
      return () => clearInterval(iv)
    }, startAt)
    return () => clearTimeout(outer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { streamed, done }
}

// ─── Dataset detail tab (full chat-width view) ────────────────────────────────

const SAMPLE_ROWS = [
  ['MSKGEELFTGVVPILVELDG', 0.94, 0.91, 0.96, 0.95],
  ['MSKGEELFTAVVPILVELDG', 0.88, 0.86, 0.89, 0.89],
  ['MSKGEELFTGVVPILIELDG', 0.73, 0.71, 0.74, 0.74],
  ['MSKGEELFTGVAPILVELDG', 0.69, 0.67, 0.70, 0.70],
  ['MSKGEELFTGVVPIWVELDG', 0.21, 0.19, 0.22, 0.22],
  ['MSKGEELFTGVVPILVALDG', 0.15, 0.14, 0.16, 0.15],
  ['MSKGEELFTGVVPILVELDR', 0.11, 0.10, 0.12, 0.11],
  ['MSKGEELFTGVVPILVELHG', 0.98, 0.97, 0.99, 0.98],
]

// Full 113-row dataset — deterministically generated so it's stable across runs.
// Mimics the real distribution: 61% dark (< 0.35×), 39% bright (≥ 0.65×),
// inter-replicate noise ≈ ±0.03.
const FULL_DATASET: Array<{ id: number; sequence: string; brightness: number; rep_1: number; rep_2: number; rep_3: number }> = (() => {
  const WT = 'MSKGEELFTGVVPILVELDG'
  // Hot-spot positions for bright variants (substitutions known to enhance brightness)
  const BRIGHT_POS: Array<[number, string]> = [
    [8,  'A'], [8,  'V'], [9,  'A'], [9,  'I'],
    [10, 'A'], [10, 'I'], [13, 'I'], [13, 'M'],
    [16, 'A'], [16, 'I'], [19, 'A'], [19, 'H'],
  ]
  // Disruptive substitutions known to reduce brightness
  const DARK_POS: Array<[number, string]> = [
    [4,  'P'], [5,  'D'], [6,  'P'], [13, 'W'],
    [13, 'P'], [14, 'D'], [15, 'P'], [17, 'D'],
    [18, 'P'], [19, 'D'], [19, 'R'], [11, 'R'],
  ]

  // Simple deterministic PRNG (mulberry32)
  let seed = 0x9E3779B9
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const mutate = (pos: number, aa: string): string =>
    WT.substring(0, pos) + aa + WT.substring(pos + 1)

  const rows: Array<{ id: number; sequence: string; brightness: number; rep_1: number; rep_2: number; rep_3: number }> = []
  const seen = new Set<string>()

  // 69 dark variants (61%)
  for (let i = 0; rows.length < 69; i++) {
    const [pos, aa] = DARK_POS[i % DARK_POS.length]
    // Add a secondary mutation for diversity beyond simple list
    const pos2 = 2 + ((i * 7) % 17)
    const aa2 = 'AVLISTGN'[(i * 3) % 8]
    let seq = mutate(pos, aa)
    if (i >= DARK_POS.length) seq = mutate(pos2, aa2).substring(0, pos) + aa + mutate(pos2, aa2).substring(pos + 1)
    if (seen.has(seq)) seq += '' // duplicates are realistic in the dataset
    seen.add(seq)
    const b = 0.04 + rand() * 0.30
    rows.push({
      id: rows.length + 1, sequence: seq,
      brightness: +b.toFixed(2),
      rep_1: +(b + (rand() - 0.5) * 0.05).toFixed(2),
      rep_2: +(b + (rand() - 0.5) * 0.05).toFixed(2),
      rep_3: +(b + (rand() - 0.5) * 0.05).toFixed(2),
    })
  }

  // 44 bright variants (39%)
  for (let i = 0; rows.length < 113; i++) {
    const [pos, aa] = BRIGHT_POS[i % BRIGHT_POS.length]
    let seq = mutate(pos, aa)
    if (i >= BRIGHT_POS.length) {
      const pos2 = 2 + ((i * 5) % 17)
      const aa2 = 'AVLISTG'[(i * 4) % 7]
      seq = mutate(pos, aa).substring(0, pos2) + aa2 + mutate(pos, aa).substring(pos2 + 1)
    }
    seen.add(seq)
    const b = 0.65 + rand() * 0.34
    rows.push({
      id: rows.length + 1, sequence: seq,
      brightness: +b.toFixed(2),
      rep_1: +(b + (rand() - 0.5) * 0.05).toFixed(2),
      rep_2: +(b + (rand() - 0.5) * 0.05).toFixed(2),
      rep_3: +(b + (rand() - 0.5) * 0.05).toFixed(2),
    })
  }

  // Sort by brightness descending so the top of the sheet shows the best hits
  rows.sort((a, b) => b.brightness - a.brightness)
  // Renumber ids
  return rows.map((r, i) => ({ ...r, id: i + 1 }))
})()

function DatasetDetailTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Tab header */}
      <div className="flex-shrink-0 border-b border-border/40 px-4 py-2.5 flex items-center gap-2">
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Back to chat"
        >
          <ArrowLeft size={14} />
        </button>
        <FileSpreadsheet size={13} className="text-muted-foreground/70" />
        <div className="flex flex-col -space-y-0.5">
          <span className="text-[12px] font-semibold leading-tight">gfp11_brightness.xlsx</span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">113 rows · 5 columns · 18 KB</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded-md hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-5 space-y-5">

          {/* Header */}
          <div className="flex items-start gap-3 pb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
              <FlaskConical size={16} className="text-sky-600 dark:text-sky-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold">Dataset summary</h2>
                <span className="text-[9.5px] font-mono text-sky-600 dark:text-sky-400/90 bg-sky-500/10 border border-sky-500/25 rounded-full px-1.5 py-0.5">
                  gfp11_brightness.xlsx
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground/75 mt-0.5">
                Split-GFP complementation brightness assay · 113 GFP11 sequence variants
                measured across three replicates with the GFP1-10 detector strand.
              </p>
            </div>
          </div>

          {/* Stat grid — first 4 muted, last 2 highlighted */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STATS.map((s) => {
              // Highlight quality indicators
              const isQuality = s.label === 'Replicate r'
              const isBright  = s.label === 'Bright (≥0.65×)'
              const isDark    = s.label === 'Dark (<0.35×)'
              return (
                <div
                  key={s.label}
                  className={cn(
                    'rounded-md border px-2.5 py-2 transition-colors',
                    isQuality && 'border-emerald-500/30 bg-emerald-500/8',
                    isBright  && 'border-emerald-500/25 bg-emerald-500/5',
                    isDark    && 'border-amber-500/25 bg-amber-500/5',
                    !isQuality && !isBright && !isDark && 'border-border/50 bg-card/40',
                  )}
                >
                  <div className={cn(
                    'text-[9.5px] uppercase tracking-wider',
                    isQuality ? 'text-emerald-600 dark:text-emerald-400/80' :
                    isBright  ? 'text-emerald-600 dark:text-emerald-400/80' :
                    isDark    ? 'text-amber-600 dark:text-amber-400/80' :
                    'text-muted-foreground/60'
                  )}>{s.label}</div>
                  <div className={cn(
                    'text-[14px] font-mono font-semibold mt-0.5',
                    isQuality && 'text-emerald-600 dark:text-emerald-400',
                    isBright  && 'text-emerald-600 dark:text-emerald-400',
                    isDark    && 'text-amber-600 dark:text-amber-400',
                  )}>{s.value}</div>
                </div>
              )
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border border-border/50 bg-card/40 p-3.5">
              <Histogram bins={HIST_BINS} label="Brightness distribution (113 variants)" />
              <p className="text-[10.5px] text-muted-foreground/70 mt-2.5 leading-relaxed">
                Bimodal — a <span className="text-amber-600 dark:text-amber-400 font-medium">dark cluster</span> (61%, brightness &lt; 0.35×) and a <span className="text-emerald-600 dark:text-emerald-400 font-medium">bright cluster</span> (39%, brightness ≥ 0.65×) with a sparse intermediate region.
              </p>
            </div>
            <div className="rounded-md border border-border/50 bg-card/40 p-3.5">
              <BarChart
                bins={SEQ_LENGTHS}
                labels={['14', '15', '16', '17', '18']}
                label="Sequence length distribution"
              />
              <p className="text-[10.5px] text-muted-foreground/70 mt-2.5 leading-relaxed">
                Dataset is length-controlled — <span className="text-sky-600 dark:text-sky-400 font-medium">67% of variants are exactly 16 aa</span>, matching the wild-type GFP11 strand.
              </p>
            </div>
          </div>

          {/* QC checks */}
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-foreground/90">Quality checks</span>
              <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">5 / 5 passed</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
              {[
                'No missing values across all columns',
                'Inter-replicate Pearson r = 0.94 (high)',
                '2 exact-duplicate sequences detected (merged)',
                'All sequences within canonical 20-aa alphabet',
                'Length variance acceptable for VAE training',
              ].map((label, i) => (
                <div key={i} className="flex items-center gap-2 text-foreground/85">
                  <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample rows table */}
          <div className="rounded-md border border-border/50 bg-card/40 overflow-hidden">
            <div className="px-3.5 py-2 border-b border-border/40 flex items-center gap-2 bg-muted/20">
              <span className="text-[11px] font-semibold text-foreground/85">Sample rows</span>
              <span className="text-[10px] text-muted-foreground/60">first 8 of 113</span>
              <div className="ml-auto flex items-center gap-3 text-[9.5px] font-mono">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400/85"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> bright</span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400/85"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> dark</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/15 text-muted-foreground/70">
                  <tr>
                    {['sequence', 'brightness', 'rep_1', 'rep_2', 'rep_3'].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 font-medium font-mono text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((row, i) => {
                    const bright = (row[1] as number) >= 0.65
                    const dark   = (row[1] as number) <= 0.35
                    return (
                      <tr key={i} className={cn(
                        'border-t border-border/30 transition-colors',
                        bright ? 'hover:bg-emerald-500/[0.04]' :
                        dark   ? 'hover:bg-amber-500/[0.04]'   :
                        'hover:bg-muted/15'
                      )}>
                        <td className="px-3 py-1.5 font-mono text-foreground/80">{row[0]}</td>
                        {row.slice(1).map((v, j) => (
                          <td key={j} className={cn(
                            'px-3 py-1.5 font-mono',
                            (v as number) >= 0.65 ? 'text-emerald-600 dark:text-emerald-400 font-medium' :
                            (v as number) <= 0.35 ? 'text-amber-600 dark:text-amber-400/85' :
                            'text-foreground/70'
                          )}>{(v as number).toFixed(2)}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendation footer */}
          <div className="rounded-md border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.04] to-sky-500/[0.04] p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                <Brain size={14} className="text-violet-500 dark:text-violet-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11.5px] font-semibold">Ready for modelling</span>
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400/85 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-1.5 py-0.5">recommended: VAE</span>
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Dataset size (n=113), label reliability (<span className="font-mono text-emerald-600 dark:text-emerald-400">r=0.94</span>), and the clean
                  bimodal brightness distribution all support a <span className="text-violet-600 dark:text-violet-400 font-medium">VAE-based latent
                  generative model</span> with a brightness regression head.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Excel file viewer tab ───────────────────────────────────────────────────
// Looks like a real spreadsheet — column letters, row numbers, header row,
// sticky first column, sheet tabs at the bottom. Read-only.

function ExcelDetailTab({ onClose }: { onClose: () => void }) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [activeSheet, setActiveSheet] = useState<'variants' | 'metadata' | 'readme'>('variants')

  const COLS: Array<{ letter: string; key: string; label: string; width: string; align?: string }> = [
    { letter: 'A', key: 'id',         label: 'id',         width: '60px',  align: 'text-right' },
    { letter: 'B', key: 'sequence',   label: 'sequence',   width: '240px' },
    { letter: 'C', key: 'brightness', label: 'brightness', width: '110px', align: 'text-right' },
    { letter: 'D', key: 'rep_1',      label: 'rep_1',      width: '90px',  align: 'text-right' },
    { letter: 'E', key: 'rep_2',      label: 'rep_2',      width: '90px',  align: 'text-right' },
    { letter: 'F', key: 'rep_3',      label: 'rep_3',      width: '90px',  align: 'text-right' },
  ]

  const cellClassFor = (b: number) =>
    b >= 0.65 ? 'text-emerald-700 dark:text-emerald-400 font-medium' :
    b <= 0.35 ? 'text-amber-700 dark:text-amber-400'                  :
    'text-foreground/75'

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 flex-shrink-0 bg-background/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={12} /> Back to chat
        </button>
        <span className="text-muted-foreground/30 mx-1">/</span>
        <FileSpreadsheet size={12} className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-[12px] font-semibold">gfp11_brightness.xlsx</span>
        <span className="text-[10px] font-mono text-muted-foreground/55 ml-1">{FULL_DATASET.length} rows · 18 KB · read-only</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-border/60 hover:bg-muted/40 transition-colors"
            title="Download (mock)"
          >
            <Upload size={11} className="rotate-180" /> Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Formula bar (decorative) */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/15 text-[11px] font-mono">
        <span className="text-muted-foreground/55 w-12 text-center">
          {selectedRow !== null ? `B${selectedRow + 1}` : 'A1'}
        </span>
        <span className="text-muted-foreground/30">|</span>
        <span className="text-foreground/80 truncate">
          {selectedRow !== null
            ? FULL_DATASET[selectedRow].sequence
            : 'id'
          }
        </span>
      </div>

      {/* Sheet body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeSheet === 'variants' && (
          <table className="border-collapse text-[11.5px] font-mono w-full">
            {/* Column letters row */}
            <thead>
              <tr className="bg-muted/40 sticky top-0 z-20">
                <th className="w-10 h-6 border-r border-b border-border/50 text-[10px] text-muted-foreground/50 sticky left-0 bg-muted/40 z-10" />
                {COLS.map(c => (
                  <th
                    key={c.letter}
                    style={{ width: c.width, minWidth: c.width }}
                    className="h-6 border-r border-b border-border/50 text-[10px] font-semibold text-muted-foreground/65 text-center"
                  >
                    {c.letter}
                  </th>
                ))}
              </tr>
              {/* Header (row 1) */}
              <tr className="bg-card sticky top-6 z-20">
                <th className="w-10 h-7 border-r border-b border-border/50 text-[10px] text-muted-foreground/50 text-center sticky left-0 bg-muted/40 z-10">
                  1
                </th>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    style={{ width: c.width, minWidth: c.width }}
                    className="h-7 border-r border-b border-border/50 px-2 text-[10.5px] font-semibold text-foreground/85 text-left bg-slate-100 dark:bg-slate-800/40"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FULL_DATASET.map((row, i) => {
                const isSelected = selectedRow === i
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(i)}
                    className={cn(
                      'cursor-cell transition-colors',
                      isSelected ? 'bg-primary/8' : i % 2 === 0 ? 'hover:bg-muted/30' : 'bg-muted/15 hover:bg-muted/35'
                    )}
                  >
                    <td className="w-10 h-6 border-r border-b border-border/40 text-[10px] text-muted-foreground/55 text-center sticky left-0 bg-muted/40 z-10">
                      {i + 2}
                    </td>
                    <td className={cn('h-6 border-r border-b border-border/30 px-2 text-right text-muted-foreground/70', isSelected && 'ring-1 ring-primary/40')}>
                      {row.id}
                    </td>
                    <td className="h-6 border-r border-b border-border/30 px-2 text-foreground/85 truncate">
                      {row.sequence}
                    </td>
                    <td className={cn('h-6 border-r border-b border-border/30 px-2 text-right', cellClassFor(row.brightness))}>
                      {row.brightness.toFixed(2)}
                    </td>
                    <td className={cn('h-6 border-r border-b border-border/30 px-2 text-right text-foreground/65')}>
                      {row.rep_1.toFixed(2)}
                    </td>
                    <td className={cn('h-6 border-r border-b border-border/30 px-2 text-right text-foreground/65')}>
                      {row.rep_2.toFixed(2)}
                    </td>
                    <td className={cn('h-6 border-r border-b border-border/30 px-2 text-right text-foreground/65')}>
                      {row.rep_3.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {activeSheet === 'metadata' && (
          <div className="p-6 space-y-3 text-[12px] font-mono">
            <div className="text-[13px] font-semibold font-sans">Sheet metadata</div>
            {[
              ['Project',       'GFP11 brightness optimisation (round 0)'],
              ['Assay',         'Split-GFP complementation, detector strand GFP1-10'],
              ['Wild-type',     'MSKGEELFTGVVPILVELDG'],
              ['Replicates',    '3 (rep_1, rep_2, rep_3)'],
              ['Units',         'normalised brightness, wild-type = 1.0×'],
              ['Captured',      '2026-05-12 14:22 UTC'],
              ['Instrument',    'BioTek Synergy H1, ex 488 nm / em 525 nm'],
              ['Operator',      'Sepehr Bayat'],
              ['Pearson r',     '0.94 (inter-replicate)'],
              ['QC',            'PASS (5/5 checks)'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-3 border-b border-border/30 pb-2">
                <span className="text-muted-foreground/65">{k}</span>
                <span className="text-foreground/85">{v}</span>
              </div>
            ))}
          </div>
        )}

        {activeSheet === 'readme' && (
          <div className="p-6 text-[12px] leading-relaxed space-y-3 max-w-2xl">
            <div className="text-[13px] font-semibold">README</div>
            <p>
              This workbook contains brightness measurements for 113 GFP11 peptide variants
              assayed against the GFP1-10 detector strand using split-GFP complementation.
            </p>
            <p>
              <code className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">variants</code> — primary
              data: one row per sequence with normalised brightness (column C) and three
              technical replicates (D–F). Sequences are 20 amino acids; the wild-type is
              <code className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded ml-1">MSKGEELFTGVVPILVELDG</code>.
            </p>
            <p>
              <code className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">metadata</code> — assay
              setup, instrument, operator, and inter-replicate Pearson correlation.
            </p>
            <p className="text-muted-foreground/70">
              Brightness ≥ 0.65× wild-type is highlighted green (bright cluster), ≤ 0.35×
              is amber (dark cluster). Intermediate values are deliberately under-represented
              due to the bimodal nature of the assay.
            </p>
          </div>
        )}
      </div>

      {/* Sheet tab bar (Excel-style, bottom) */}
      <div className="flex items-center gap-0 border-t border-border/40 bg-muted/25 px-2 py-1 flex-shrink-0 text-[11px]">
        {[
          { id: 'variants' as const, label: 'variants', count: FULL_DATASET.length },
          { id: 'metadata' as const, label: 'metadata' },
          { id: 'readme'   as const, label: 'README'   },
        ].map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSheet(s.id)}
            className={cn(
              'px-3 py-1 rounded-t-md border border-b-0 transition-colors flex items-center gap-1.5 -mb-px',
              activeSheet === s.id
                ? 'bg-background border-border/60 text-foreground font-medium shadow-[0_1px_0_0_var(--background)]'
                : 'bg-muted/30 border-transparent text-muted-foreground/65 hover:text-foreground/85 hover:bg-muted/50'
            )}
          >
            {s.label}
            {s.count !== undefined && (
              <span className="text-[9.5px] font-mono text-muted-foreground/55">{s.count}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/45">
          Ready · 113 rows · Pearson r = 0.94
        </span>
      </div>
    </div>
  )
}

// ─── Mini chart components ────────────────────────────────────────────────────

function Histogram({ bins, label }: { bins: number[]; label: string }) {
  const max = Math.max(...bins)
  return (
    <div>
      <div className="text-[10px] text-muted-foreground/70 mb-3 font-medium uppercase tracking-wider">{label}</div>
      <div className="flex items-end gap-0.5 h-14">
        {bins.map((v, i) => {
          // Bimodal — colour dark cluster amber/orange, bright cluster emerald
          const isDark = i < 3
          const isBright = i >= 6
          const colorClass = isDark
            ? 'bg-amber-500/70 hover:bg-amber-500'
            : isBright
              ? 'bg-emerald-500/70 hover:bg-emerald-500'
              : 'bg-slate-400/40 hover:bg-slate-400/60'
          return (
            <div
              key={i}
              className={cn('flex-1 rounded-t-sm transition-colors', colorClass)}
              style={{ height: `${(v / max) * 100}%`, minHeight: 2 }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/55 mt-1.5 font-mono">
        <span><span className="text-amber-500">●</span> dark</span>
        <span className="text-muted-foreground/40">0.5×</span>
        <span><span className="text-emerald-500">●</span> bright</span>
      </div>
    </div>
  )
}

function BarChart({ bins, labels, label }: { bins: number[]; labels: string[]; label: string }) {
  const max = Math.max(...bins)
  const MAX_BAR_H = 40
  return (
    <div>
      <div className="text-[10px] text-muted-foreground/70 mb-3 font-medium uppercase tracking-wider">{label}</div>
      <div className="flex items-end gap-1" style={{ height: MAX_BAR_H + 14 }}>
        {bins.map((v, i) => {
          // Highlight the dominant bin (16 aa)
          const isMode = i === 2
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  isMode ? 'bg-sky-500/80 hover:bg-sky-500' : 'bg-sky-400/35 hover:bg-sky-400/55'
                )}
                style={{ height: `${(v / max) * MAX_BAR_H}px`, minHeight: 2 }}
              />
              <span className={cn(
                'text-[9px] font-mono',
                isMode ? 'text-sky-500 font-semibold' : 'text-muted-foreground/50'
              )}>{labels[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Training loss chart (animated) ──────────────────────────────────────────

const FINAL_LOSSES = [
  0.421, 0.368, 0.312, 0.271, 0.241, 0.218, 0.198, 0.182,
  0.169, 0.158, 0.148, 0.140, 0.133, 0.127, 0.122, 0.118,
  0.113, 0.109, 0.106, 0.103, 0.100, 0.097, 0.094, 0.092,
  0.089, 0.087, 0.085, 0.083, 0.082, 0.021,
]

function TrainingCard({
  visible,
  epoch,
  onOpenTab,
}: {
  visible: boolean
  epoch: number
  onOpenTab?: () => void
}) {

  if (!visible) return null

  const displayedLosses = FINAL_LOSSES.slice(0, epoch + 1)
  const maxLoss = FINAL_LOSSES[0]
  const currentLoss = FINAL_LOSSES[epoch]
  const done = epoch >= FINAL_LOSSES.length - 1

  // SVG polyline
  const W = 240, H = 56
  const pts = displayedLosses
    .map((v, i) => {
      const x = (i / (FINAL_LOSSES.length - 1)) * W
      const y = H - ((maxLoss - v) / (maxLoss - FINAL_LOSSES[FINAL_LOSSES.length - 1])) * H * 0.85 - 4
      return `${x},${y}`
    })
    .join(' ')

  return (
    <CollapsibleCard
      icon={Brain}
      title="Brightness VAE training"
      subtitle={done
        ? `converged · loss 0.021 · RMSE 0.09`
        : `epoch ${epoch + 1}/${FINAL_LOSSES.length} · loss ${currentLoss.toFixed(3)}`
      }
      running={!done}
      done={done}
      containerClassName="max-w-[760px]"
      rightAction={onOpenTab ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onOpenTab() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenTab() } }}
          title="Open metrics in tab"
          className="flex items-center justify-center w-5 h-5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer"
        >
          <Maximize2 size={9} />
        </span>
      ) : undefined}
    >
      <div className="p-3 space-y-2.5">
        {/* Loss curve */}
        <div className="rounded-md bg-muted/20 border border-border/40 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground/55 font-medium uppercase tracking-wider">Reconstruction + KL loss</span>
            <span className="text-[9px] font-mono text-muted-foreground/50">{FINAL_LOSSES.length} epochs</span>
          </div>
          <svg width={W} height={H} className="overflow-visible">
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={0} y1={H * f} x2={W} y2={H * f}
                stroke="currentColor" strokeOpacity={0.05} strokeWidth={1} />
            ))}
            {displayedLosses.length > 1 && (
              <polyline
                points={pts}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {displayedLosses.length > 0 && (() => {
              const last = displayedLosses.length - 1
              const x = (last / (FINAL_LOSSES.length - 1)) * W
              const y = H - ((maxLoss - currentLoss) / (maxLoss - FINAL_LOSSES[FINAL_LOSSES.length - 1])) * H * 0.85 - 4
              return <circle cx={x} cy={y} r={2.5} fill="hsl(var(--primary))" />
            })()}
          </svg>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Epoch', value: `${epoch + 1}/${FINAL_LOSSES.length}` },
            { label: 'Loss',  value: currentLoss.toFixed(3) },
            { label: 'RMSE',  value: done ? '0.09' : (0.09 + (1 - epoch / FINAL_LOSSES.length) * 0.28).toFixed(2) },
          ].map(m => (
            <div key={m.label} className="rounded bg-muted/25 px-2 py-1">
              <div className="text-[9px] text-muted-foreground/55 uppercase tracking-wider">{m.label}</div>
              <div className="text-[11px] font-mono font-semibold mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleCard>
  )
}

// ─── Pipeline preview card (approval gate) ────────────────────────────────────
// Matches the real DagPreview style: small horizontal nodes with a coloured left
// accent bar, tool icon, label, on a dotted background with dashed connectors.

type NodeKind = 'model' | 'tool' | 'gate' | 'logic'

interface PipelineNodeParam {
  key: string
  label: string
  /** stringified value (mocked — purely display) */
  value: string
  /** UI hint for the input */
  kind: 'number' | 'text' | 'select'
  /** options for select */
  options?: string[]
  /** unit suffix shown after the input */
  unit?: string
}

interface PipelineNodePreview {
  id: string
  label: string
  kind: NodeKind
  /** Short description shown in the side panel */
  description: string
  /** Tool / framework backing this node */
  source: string
  icon: IconType
  /** Tailwind classes for the left accent bar */
  barClass: string
  /** Tailwind classes for the icon background tile */
  iconBgClass: string
  /** Tailwind classes for the icon colour */
  iconTextClass: string
  /** Editable parameters (mocked) */
  params: PipelineNodeParam[]
}

const PIPELINE_PREVIEW_NODES: PipelineNodePreview[] = [
  {
    id: 'vae', label: 'Brightness VAE', kind: 'model', icon: Brain,
    description: 'Variational autoencoder trained on n=113 GFP11 brightness measurements. Latent z ∈ ℝ⁸. Decoder samples diverse sequences near the bright-cluster centroid.',
    source: 'synqlab.models.brightness_vae',
    barClass:       'bg-gradient-to-b from-violet-400 via-fuchsia-400 to-pink-400',
    iconBgClass:    'bg-violet-500/15',
    iconTextClass:  'text-violet-500 dark:text-violet-300',
    params: [
      { key: 'latent_dim', label: 'Latent dim',      value: '8',     kind: 'number' },
      { key: 'samples',    label: 'Samples / round', value: '256',   kind: 'number' },
      { key: 'temp',       label: 'Sampling temp',   value: '0.85',  kind: 'number' },
      { key: 'init',       label: 'Init checkpoint', value: 'gfp11_v1.pt', kind: 'text' },
    ],
  },
  {
    id: 'fold', label: 'AlphaFold-Multimer', kind: 'tool', icon: Layers,
    description: 'Predicts the GFP11:GFP1-10 heterodimer structure for each generated variant. Outputs confidence (pLDDT) and interface metrics.',
    source: 'tools/structure/alphafold-multimer',
    barClass:       'bg-gradient-to-b from-sky-400 via-cyan-400 to-teal-400',
    iconBgClass:    'bg-sky-500/15',
    iconTextClass:  'text-sky-500 dark:text-sky-300',
    params: [
      { key: 'model',     label: 'Model version', value: 'multimer-v3', kind: 'select', options: ['multimer-v2', 'multimer-v3'] },
      { key: 'n_recycle', label: 'Recycles',      value: '3',  kind: 'number' },
      { key: 'n_models',  label: 'Models',        value: '5',  kind: 'number' },
    ],
  },
  {
    id: 'stab', label: 'Stability Gate', kind: 'gate', icon: FlaskConical,
    description: 'Rejects variants whose predicted ΔΔG (vs wild-type GFP11) exceeds the threshold. Keeps only thermodynamically plausible candidates.',
    source: 'tools/scoring/foldx-ddg',
    barClass:       'bg-gradient-to-b from-amber-400 via-orange-400 to-rose-400',
    iconBgClass:    'bg-amber-500/15',
    iconTextClass:  'text-amber-500 dark:text-amber-300',
    params: [
      { key: 'ddg_max', label: 'ΔΔG max',  value: '2.0',  kind: 'number', unit: 'kcal/mol' },
      { key: 'mode',    label: 'Aggregation', value: 'mean', kind: 'select', options: ['mean', 'median', 'max'] },
    ],
  },
  {
    id: 'inter', label: 'Interaction Gate', kind: 'gate', icon: Zap,
    description: 'Filters variants by interface contact area, hydrogen-bond count, and predicted brightness ≥ 0.85× wild-type.',
    source: 'synqlab.gates.interaction',
    barClass:       'bg-gradient-to-b from-amber-400 via-orange-400 to-rose-400',
    iconBgClass:    'bg-amber-500/15',
    iconTextClass:  'text-amber-500 dark:text-amber-300',
    params: [
      { key: 'bright_min', label: 'Brightness ≥', value: '0.85', kind: 'number', unit: '× wt' },
      { key: 'iface_min',  label: 'Interface ≥',  value: '450',  kind: 'number', unit: 'Å²' },
      { key: 'hbonds_min', label: 'H-bonds ≥',    value: '6',    kind: 'number' },
    ],
  },
  {
    id: 'rank', label: 'Ranker', kind: 'logic', icon: GitBranch,
    description: 'Composite score = 0.6 × predicted brightness − 0.3 × ΔΔG + 0.1 × interface score. Returns top-K candidates for wet-lab synthesis.',
    source: 'synqlab.rank.composite',
    barClass:       'bg-gradient-to-b from-emerald-400 via-teal-400 to-cyan-400',
    iconBgClass:    'bg-emerald-500/15',
    iconTextClass:  'text-emerald-500 dark:text-emerald-300',
    params: [
      { key: 'top_k', label: 'Top-K',           value: '24',  kind: 'number' },
      { key: 'w_b',   label: 'Brightness wt.',  value: '0.6', kind: 'number' },
      { key: 'w_s',   label: 'Stability wt.',   value: '0.3', kind: 'number' },
      { key: 'w_i',   label: 'Interface wt.',   value: '0.1', kind: 'number' },
    ],
  },
  {
    id: 'update', label: 'Model Update', kind: 'model', icon: Brain,
    description: 'After each wet-lab round, the VAE is fine-tuned on new (sequence, brightness) labels. Closes the design-build-test-learn loop.',
    source: 'synqlab.train.online_update',
    barClass:       'bg-gradient-to-b from-violet-400 via-fuchsia-400 to-pink-400',
    iconBgClass:    'bg-violet-500/15',
    iconTextClass:  'text-violet-500 dark:text-violet-300',
    params: [
      { key: 'lr',      label: 'Learning rate', value: '1e-4',  kind: 'number' },
      { key: 'epochs',  label: 'Epochs',        value: '15',    kind: 'number' },
      { key: 'freeze',  label: 'Freeze encoder', value: 'true', kind: 'select', options: ['true', 'false'] },
    ],
  },
]

const NODE_KIND_LABELS: Record<NodeKind, string> = {
  model: 'Model',
  tool:  'Tool',
  gate:  'Gate',
  logic: 'Logic',
}

const NODE_KIND_BADGE: Record<NodeKind, string> = {
  model: 'bg-violet-500/15  border-violet-500/30  text-violet-600  dark:text-violet-300',
  tool:  'bg-sky-500/15     border-sky-500/30     text-sky-600     dark:text-sky-300',
  gate:  'bg-amber-500/15   border-amber-500/30   text-amber-600   dark:text-amber-300',
  logic: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300',
}

function DagPreviewNode({ node }: { node: PipelineNodePreview }) {
  const Icon = node.icon
  return (
    <div className="relative bg-card rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] overflow-visible min-w-[170px]">
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[2px] rounded-l-md', node.barClass)} />
      <div className="pl-2.5 pr-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
        <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0', node.iconBgClass)}>
          <Icon size={9} className={node.iconTextClass} />
        </div>
        <span className="text-[10px] font-semibold text-foreground truncate leading-none">
          {node.label}
        </span>
      </div>
    </div>
  )
}

function PipelinePreviewCard({
  onApprove,
  onModify,
  approved,
  onOpenEditor,
}: {
  onApprove: () => void
  onModify?: () => void
  approved: boolean
  onOpenEditor?: () => void
}) {
  // Group nodes into rows (alternating snake-style like real ReactFlow layout)
  // Row 1: vae → fold → stab    Row 2: update ← rank ← inter
  const row1 = PIPELINE_PREVIEW_NODES.slice(0, 3)
  const row2 = PIPELINE_PREVIEW_NODES.slice(3, 6).reverse()

  // Build the right-side action cluster: open-in-editor button + approved pill
  const rightAction = (
    <div className="flex items-center gap-1.5">
      {approved && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-500/85 font-medium bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
          <CheckCircle2 size={9} /> Approved
        </div>
      )}
      {onOpenEditor && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onOpenEditor() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenEditor() } }}
          title="Open in pipeline editor"
          className="flex items-center justify-center w-5 h-5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer"
        >
          <Maximize2 size={9} />
        </span>
      )}
    </div>
  )

  return (
    <CollapsibleCard
      icon={GitBranch}
      title="Recommended pipeline"
      subtitle={approved
        ? '6 nodes · 3 rounds · approved'
        : '6 nodes · 3 rounds · closed loop'
      }
      done={approved}
      autoCollapse={false}
      containerClassName="max-w-[700px]"
      rightAction={rightAction}
    >
      {/* DAG visual — dotted background, two rows, snake connectors */}
      <div
        className="relative p-5"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(148 163 184 / 0.25) 0.8px, transparent 0.8px)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0',
        }}
      >
        {/* Row 1 (left → right) */}
        <div className="flex items-center justify-between gap-3 relative">
          {row1.map((n, i) => (
            <div key={n.id} className="flex items-center gap-3 flex-1 min-w-0">
              <DagPreviewNode node={n} />
              {i < row1.length - 1 && (
                <div className="flex-1 h-px border-t border-dashed border-slate-400/50 dark:border-slate-500/40" />
              )}
            </div>
          ))}
        </div>

        {/* Bend connector going down on the right */}
        <div className="flex justify-end pr-3 py-0.5">
          <div className="w-px h-5 border-l border-dashed border-slate-400/50 dark:border-slate-500/40" />
        </div>

        {/* Row 2 (right → left, snake) */}
        <div className="flex items-center justify-between gap-3 relative">
          {row2.map((n, i) => (
            <div key={n.id} className="flex items-center gap-3 flex-1 min-w-0 flex-row-reverse">
              <DagPreviewNode node={n} />
              {i < row2.length - 1 && (
                <div className="flex-1 h-px border-t border-dashed border-slate-400/50 dark:border-slate-500/40" />
              )}
            </div>
          ))}
        </div>

        {/* Loop-back arrow on the left (closes the loop) */}
        <div className="absolute left-2 top-[42%] bottom-[42%] w-px border-l border-dashed border-emerald-500/40" />
      </div>

      {/* Legend */}
      <div className="px-3.5 py-2 border-t border-border/40 flex items-center gap-3 text-[10px] text-muted-foreground/65 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Model
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Tool
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Gate
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Logic
        </div>
        <span className="ml-auto font-mono text-muted-foreground/50">closed loop</span>
      </div>

      {/* Action buttons (only before approval) */}
      {!approved && (
        <div className="px-3.5 py-2.5 border-t border-border/40 bg-muted/15 flex items-center gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-[11px] font-semibold hover:opacity-90 transition-opacity"
          >
            <CheckCircle2 size={12} /> Approve & build
          </button>
          {onModify && (
            <button
              type="button"
              onClick={onModify}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border/60 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Modify
            </button>
          )}
        </div>
      )}
    </CollapsibleCard>
  )
}

// ─── Pipeline detail tab (full-width editor) ─────────────────────────────────
// Mirrors the DatasetDetailTab pattern. Shows the recommended pipeline at full
// size with a node-selection side panel and editable (mocked) parameters.

function PipelineDetailTab({
  onClose,
  onRun,
  canRun,
}: {
  onClose: () => void
  onRun?: () => void
  canRun: boolean
}) {
  const [selectedId, setSelectedId] = useState<string>(PIPELINE_PREVIEW_NODES[0].id)
  // Track local edits — purely visual; values display in inputs
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const selected = PIPELINE_PREVIEW_NODES.find(n => n.id === selectedId)!

  const getVal = (nodeId: string, key: string, fallback: string) =>
    edits[nodeId]?.[key] ?? fallback

  const setVal = (nodeId: string, key: string, value: string) =>
    setEdits(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], [key]: value } }))

  // ── Build ReactFlow nodes & edges ──────────────────────────────────────────
  // Staggered layout (not perfectly flat rows) so the flow reads more naturally.
  const { flowNodes, flowEdges } = useMemo(() => {
    const NODE_W = 200
    const GAP_X  = 80
    const GAP_Y  = 92
    const X = (col: number) => col * (NODE_W + GAP_X)
    // Top path: vae -> fold -> stab
    // Bottom path: inter -> rank -> update (staggered vertically for readability)
    const positions: Record<string, { x: number; y: number }> = {
      vae:    { x: X(0), y: 0 },
      fold:   { x: X(1), y: 20 },
      stab:   { x: X(2), y: 0 },
      inter:  { x: X(2), y: GAP_Y + 54 },
      rank:   { x: X(1), y: GAP_Y + 74 },
      update: { x: X(0), y: GAP_Y + 42 },
    }

    const fNodes: RFNode[] = PIPELINE_PREVIEW_NODES.map(n => ({
      id: n.id,
      type: 'editor',
      position: positions[n.id],
      data: { node: n, selected: n.id === selectedId },
      selectable: false,
    }))

    const fEdges: RFEdge[] = [
      // Row 1 → row 2 → wrap
      { id: 'e-vae-fold',    source: 'vae',   target: 'fold',   sourceHandle: 'r-out', targetHandle: 'l-in' },
      { id: 'e-fold-stab',   source: 'fold',  target: 'stab',   sourceHandle: 'r-out', targetHandle: 'l-in' },
      { id: 'e-stab-inter',  source: 'stab',  target: 'inter',  sourceHandle: 'b-out', targetHandle: 't-in' },
      { id: 'e-inter-rank',  source: 'inter', target: 'rank',   sourceHandle: 'l-out', targetHandle: 'r-in' },
      // Explicit edge requested: Model Update <-> Ranker connectivity
      { id: 'e-rank-update', source: 'rank',  target: 'update', sourceHandle: 'l-out', targetHandle: 'r-in' },
      // Loop-back: update → vae (emerald)
      {
        id: 'e-update-vae', source: 'update', target: 'vae',
        sourceHandle: 't-out', targetHandle: 'b-in',
        type: 'default',
        animated: true,
        style: { stroke: 'rgb(16 185 129 / 0.7)', strokeWidth: 1.6, strokeDasharray: '6 4' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'rgb(16 185 129 / 0.85)' },
        label: '↺ loop',
        labelStyle: { fill: 'rgb(16 185 129)', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 },
        labelBgStyle: { fill: 'rgb(255 255 255 / 0.9)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      },
    ].map(e =>
      e.id === 'e-update-vae'
        ? (e as RFEdge)
        : ({
            ...e,
            type: 'smoothstep',
            style: { stroke: '#94a3b8', strokeWidth: 1.4, strokeDasharray: '5 3' },
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#94a3b8' },
          } as RFEdge),
    )

    return { flowNodes: fNodes, flowEdges: fEdges }
  }, [selectedId])

  const onNodeClick = useCallback((_e: React.MouseEvent, node: RFNode) => {
    setSelectedId(node.id)
  }, [])

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 flex-shrink-0 bg-background/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={12} /> Back to chat
        </button>
        <span className="text-muted-foreground/30 mx-1">/</span>
        <GitBranch size={12} className="text-muted-foreground/60" />
        <span className="text-[12px] font-semibold">GFP11 brightness pipeline</span>
        <span className="text-[10px] font-mono text-muted-foreground/55 ml-1">v0.1 · draft</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all',
              canRun
                ? 'bg-foreground text-background hover:opacity-90'
                : 'bg-muted/40 text-muted-foreground/50 cursor-not-allowed'
            )}
            title={canRun ? 'Run pipeline' : 'Approve pipeline first to enable run'}
          >
            <Zap size={11} /> Run pipeline
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body — DAG on the left, side panel on the right */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* ReactFlow canvas — needs explicit dimensions */}
        <div className="relative min-h-0 w-full h-full bg-muted/10">
          <ReactFlowProvider>
            <ReactFlow
              style={{ width: '100%', height: '100%' }}
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={EDITOR_NODE_TYPES}
              onNodeClick={onNodeClick}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
              minZoom={0.4}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Floating legend overlay */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 text-[10.5px] text-muted-foreground/75 bg-background/85 backdrop-blur-sm border border-border/40 rounded-md px-2.5 py-1.5 flex-wrap shadow-sm">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> Model</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400" /> Tool</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Gate</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Logic</div>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] font-mono text-muted-foreground/55 bg-background/85 backdrop-blur-sm border border-border/40 rounded-md px-2 py-1 shadow-sm">
            click any node to edit
          </div>
        </div>

        {/* Side panel — selected node properties */}
        <div className="border-l border-border/40 bg-card/30 flex flex-col min-h-0 max-h-full overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/40 flex items-start gap-2.5">
            <div className={cn('w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0', selected.iconBgClass)}>
              <selected.icon size={15} className={selected.iconTextClass} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-semibold">{selected.label}</span>
                <span className={cn(
                  'text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                  NODE_KIND_BADGE[selected.kind]
                )}>
                  {NODE_KIND_LABELS[selected.kind]}
                </span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/55 truncate mt-0.5">
                {selected.source}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="px-4 py-3 border-b border-border/40">
            <div className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              Description
            </div>
            <p className="text-[11.5px] text-foreground/80 leading-relaxed">
              {selected.description}
            </p>
          </div>

          {/* Parameters */}
          <div className="px-4 py-3 border-b border-border/40">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Parameters
              </div>
              <span className="text-[9.5px] font-mono text-muted-foreground/45">{selected.params.length}</span>
            </div>
            <div className="space-y-2.5">
              {selected.params.map(p => {
                const v = getVal(selected.id, p.key, p.value)
                const edited = v !== p.value
                return (
                  <div key={p.key}>
                    <label className="flex items-baseline gap-2 mb-1">
                      <span className="text-[10.5px] text-foreground/80 font-medium">{p.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground/45">{p.key}</span>
                      {edited && (
                        <span className="ml-auto text-[8.5px] font-mono text-amber-600 dark:text-amber-400/85 bg-amber-500/10 border border-amber-500/25 rounded-sm px-1 py-0.5">
                          edited
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {p.kind === 'select' ? (
                        <select
                          value={v}
                          onChange={e => setVal(selected.id, p.key, e.target.value)}
                          className="flex-1 text-[11px] font-mono px-2 py-1 rounded border border-border/60 bg-background/80 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                        >
                          {p.options?.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={v}
                          onChange={e => setVal(selected.id, p.key, e.target.value)}
                          className="flex-1 text-[11px] font-mono px-2 py-1 rounded border border-border/60 bg-background/80 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                        />
                      )}
                      {p.unit && (
                        <span className="text-[10px] font-mono text-muted-foreground/55 whitespace-nowrap">{p.unit}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Connections */}
          <div className="px-4 py-3 border-b border-border/40">
            <div className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              Connections
            </div>
            <div className="space-y-1 text-[11px] font-mono text-muted-foreground/75">
              <div className="flex items-center gap-1.5">
                <ArrowLeft size={10} className="text-muted-foreground/45" />
                <span>{getPrev(selected.id)?.label ?? '— start of pipeline'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowRight size={10} className="text-muted-foreground/45" />
                <span>{getNext(selected.id)?.label ?? '— end of pipeline'}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 text-[10px] text-muted-foreground/55 mt-auto">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={10} className="text-emerald-500/70" />
              Changes are local — click <span className="font-mono text-foreground/70">Run pipeline</span> to apply.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getPrev(id: string): PipelineNodePreview | undefined {
  const idx = PIPELINE_PREVIEW_NODES.findIndex(n => n.id === id)
  return idx > 0 ? PIPELINE_PREVIEW_NODES[idx - 1] : undefined
}
function getNext(id: string): PipelineNodePreview | undefined {
  const idx = PIPELINE_PREVIEW_NODES.findIndex(n => n.id === id)
  return idx >= 0 && idx < PIPELINE_PREVIEW_NODES.length - 1 ? PIPELINE_PREVIEW_NODES[idx + 1] : undefined
}

// ReactFlow custom node for the editor canvas
interface EditorNodeData {
  node: PipelineNodePreview
  selected: boolean
}

function EditorFlowNode({ data }: NodeProps) {
  const { node, selected } = data as unknown as EditorNodeData
  const Icon = node.icon

  // Handle styling — neutral coloured dots
  const handleStyle = {
    width: 8, height: 8,
    background: '#94a3b8',
    border: '1.5px solid white',
    borderRadius: 2,
  }

  return (
    <div
      className={cn(
        'relative bg-card rounded-lg overflow-visible transition-all',
        selected
          ? 'ring-2 ring-primary/85 shadow-lg'
          : 'ring-1 ring-border/60 hover:ring-border shadow-sm'
      )}
      style={{ width: 200 }}
    >
      {/* Coloured accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg', node.barClass)} />

      {/* ReactFlow handles — in+out per side so edges can go either direction */}
      <Handle id="l-in"  type="target" position={Position.Left}   style={{ ...handleStyle, left: -4, top: '48%' }} />
      <Handle id="l-out" type="source" position={Position.Left}   style={{ ...handleStyle, left: -4, top: '58%' }} />
      <Handle id="t-in"  type="target" position={Position.Top}    style={{ ...handleStyle, top: -4, left: '45%' }} />
      <Handle id="t-out" type="source" position={Position.Top}    style={{ ...handleStyle, top: -4, left: '55%' }} />
      <Handle id="r-in"  type="target" position={Position.Right}  style={{ ...handleStyle, right: -4, top: '48%' }} />
      <Handle id="r-out" type="source" position={Position.Right}  style={{ ...handleStyle, right: -4, top: '58%' }} />
      <Handle id="b-in"  type="target" position={Position.Bottom} style={{ ...handleStyle, bottom: -4, left: '45%' }} />
      <Handle id="b-out" type="source" position={Position.Bottom} style={{ ...handleStyle, bottom: -4, left: '55%' }} />

      <div className="pl-3 pr-3.5 py-2.5 flex items-center gap-2 min-w-0">
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', node.iconBgClass)}>
          <Icon size={14} className={node.iconTextClass} />
        </div>
        <div className="flex flex-col -space-y-0.5 min-w-0">
          <span className="text-[12px] font-semibold text-foreground leading-tight truncate">{node.label}</span>
          <span className="text-[9.5px] font-mono text-muted-foreground/60 leading-tight">{NODE_KIND_LABELS[node.kind].toLowerCase()}</span>
        </div>
      </div>
    </div>
  )
}

const EDITOR_NODE_TYPES = { editor: EditorFlowNode }

// ─── Shared sub-components ────────────────────────────────────────────────────

// ─── Agent working indicator — cycles through labelled phases ─────────────────

interface WorkStep { icon: IconType; label: string; durationMs: number }

function AgentWorkingBadges({ steps, onDone }: { steps: WorkStep[]; onDone: () => void }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    let cumDelay = 0
    const timeouts: ReturnType<typeof setTimeout>[] = []

    steps.forEach((_s, i) => {
      cumDelay += i === 0 ? 0 : steps[i - 1].durationMs
      const t = setTimeout(() => setStepIdx(i), cumDelay)
      timeouts.push(t)
    })

    const total = steps.reduce((acc, step) => acc + step.durationMs, 0)
    const fin = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; setDone(true); onDone() }
    }, total)
    timeouts.push(fin)

    return () => timeouts.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Colour palette per step index — cycles for visual variety
  // Restrained, more "engineering-tool" palette — darker tones, neutral base.
  // Each pill: slate/zinc body with a subtle accent for the icon only.
  const STEP_PALETTE = [
    { bg: 'bg-slate-100 dark:bg-slate-800/60',  border: 'border-slate-300 dark:border-slate-700',  text: 'text-slate-700 dark:text-slate-200',  icon: 'text-indigo-700 dark:text-indigo-300' },
    { bg: 'bg-slate-100 dark:bg-slate-800/60',  border: 'border-slate-300 dark:border-slate-700',  text: 'text-slate-700 dark:text-slate-200',  icon: 'text-cyan-700  dark:text-cyan-300'   },
    { bg: 'bg-slate-100 dark:bg-slate-800/60',  border: 'border-slate-300 dark:border-slate-700',  text: 'text-slate-700 dark:text-slate-200',  icon: 'text-orange-700 dark:text-orange-300' },
    { bg: 'bg-slate-100 dark:bg-slate-800/60',  border: 'border-slate-300 dark:border-slate-700',  text: 'text-slate-700 dark:text-slate-200',  icon: 'text-teal-700  dark:text-teal-300'   },
  ]
  const paletteFor = (i: number) => STEP_PALETTE[i % STEP_PALETTE.length]

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex flex-wrap gap-1.5">
        {/* All shown steps — completed get a green check */}
        {steps.slice(0, stepIdx).map((s, i) => {
          const S = s.icon
          const p = paletteFor(i)
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium',
                p.bg, p.border, p.text
              )}
            >
              <S size={10} className={p.icon} />
              <span>{s.label}</span>
              <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400 ml-0.5" />
            </div>
          )
        })}

        {/* Active step — same restrained shell, accent icon + spinner */}
        {!done && (() => {
          const current = steps[stepIdx]
          const Icon = current.icon
          const p = paletteFor(stepIdx)
          return (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium shadow-sm',
                p.bg, p.border, p.text
              )}
            >
              <Icon size={11} className={cn('animate-pulse', p.icon)} />
              <span>{current.label}</span>
              <Loader2 size={10} className={cn('animate-spin ml-0.5', p.icon)} />
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// Pre-defined step sequences for each thinking phase
// Tuned so each step is clearly readable on screen (~1.3s each)
const STEPS_FIRST_REPLY: WorkStep[] = [
  { icon: Brain,      label: 'Reasoning about goal',   durationMs: 1500 },
  { icon: BookOpen,   label: 'Checking literature',    durationMs: 1400 },
  { icon: ScanSearch, label: 'Scanning tool registry', durationMs: 1300 },
  { icon: Layers,     label: 'Planning pipeline',      durationMs: 1100 },
]

const STEPS_READING_DATA: WorkStep[] = [
  { icon: FileSpreadsheet, label: 'Parsing Excel file',      durationMs: 1300 },
  { icon: Search,          label: 'Detecting columns',       durationMs: 1100 },
  { icon: FlaskConical,    label: 'Running quality checks',  durationMs: 1400 },
  { icon: Cpu,             label: 'Computing statistics',    durationMs: 1200 },
]

const STEPS_MODEL_DESIGN: WorkStep[] = [
  { icon: Brain,    label: 'Analysing data distribution', durationMs: 1500 },
  { icon: Search,   label: 'Selecting architecture',      durationMs: 1300 },
  { icon: Layers,   label: 'Configuring VAE layers',      durationMs: 1200 },
  { icon: Wrench,   label: 'Setting hyperparameters',     durationMs: 1100 },
]

const STEPS_BUILDING_PIPELINE: WorkStep[] = [
  { icon: ScanSearch,   label: 'Searching tool registry',  durationMs: 1400 },
  { icon: Wrench,       label: 'Selecting tools',          durationMs: 1200 },
  { icon: Zap,          label: 'Wiring pipeline nodes',    durationMs: 1300 },
  { icon: CheckCircle2, label: 'Validating graph',         durationMs: 1100 },
]

// AgentTurn: shows working badges first, then renders children once all steps done.
// Once done, the badges stay visible above the streamed response (like real
// AI-assistant "tool call" traces).
function AgentTurn({
  steps, children, visible,
}: {
  steps: WorkStep[]
  children: React.ReactNode
  visible: boolean
}) {
  const [working, setWorking] = useState(true)
  if (!visible) return null
  return (
    <BotRow>
      <div className="space-y-2">
        <AgentWorkingBadges steps={steps} onDone={() => setWorking(false)} />
        {!working && children}
      </div>
    </BotRow>
  )
}


function BotRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={13} className="text-primary/80" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function UserRow({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="flex gap-3 justify-end">
      <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-slate-100 dark:bg-slate-900/65 border border-black/70 dark:border-white/70 shadow-[0_2px_6px_rgba(0,0,0,0.14)] px-4 py-3 text-[13px] text-foreground/90 leading-relaxed">
        {children}
      </div>
      <InitialsAvatar
        name={user?.full_name ?? user?.email ?? null}
        imageUrl={user?.avatar_url}
        size={28}
        className="mt-0.5 ring-1 ring-border"
      />
    </div>
  )
}

function StreamBlock({ text, startAt, onDone }: { text: string; startAt: number; onDone?: () => void }) {
  const { streamed, done } = useStream(text, startAt)
  const prevDone = useRef(false)
  useEffect(() => {
    if (done && !prevDone.current) { prevDone.current = true; onDone?.() }
  }, [done, onDone])
  return (
    <div className="text-[13px] leading-relaxed text-foreground/90">
      <MarkdownContent content={streamed} />
      {!done && <span className="inline-block w-0.5 h-4 bg-primary/70 ml-0.5 animate-pulse align-text-bottom" />}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase =
  | 'user_goal'         // t=0   user message visible
  | 'agent_asking'      // streaming "upload your file"
  | 'wait_upload'       // idle — upload button available
  | 'uploading'         // brief animation
  | 'agent_reading'     // streaming "reading file…"
  | 'show_dataset'      // dataset stats card visible
  | 'agent_model'       // streaming model proposal
  | 'pipeline_preview'  // recommended pipeline shown, waiting approval
  | 'pipeline_approved' // user clicked approve
  | 'coding'            // streaming VAE Python code
  | 'training'          // VAE training animation
  | 'agent_wrapping'    // streaming final summary
  | 'done'              // pipeline card visible

// Tiny helper component that triggers a phase advance when the parent phase matches.
// Lets us call an effect-based timer without putting setTimeout in JSX.
function DatasetAutoAdvance({ phase, onAdvance }: { phase: Phase; onAdvance: () => void }) {
  const fired = useRef(false)
  useEffect(() => {
    if (phase === 'show_dataset' && !fired.current) {
      fired.current = true
      const t = setTimeout(onAdvance, 1500)
      return () => clearTimeout(t)
    }
  }, [phase, onAdvance])
  return null
}

// Once user approves the pipeline, briefly pause then start coding
function ApprovalAutoAdvance({ phase, onAdvance }: { phase: Phase; onAdvance: () => void }) {
  const fired = useRef(false)
  useEffect(() => {
    if (phase === 'pipeline_approved' && !fired.current) {
      fired.current = true
      const t = setTimeout(onAdvance, 900)
      return () => clearTimeout(t)
    }
  }, [phase, onAdvance])
  return null
}

// Full-tab code viewer (same content as the inline card)
function CodeDetailTab({ onClose, visibleCount }: { onClose: () => void; visibleCount: number }) {
  const done = visibleCount >= TERM_SCRIPT.length
  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 flex-shrink-0 bg-background/80 backdrop-blur-sm">
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft size={12} /> Back to chat
        </button>
        <span className="text-muted-foreground/30 mx-1">/</span>
        <Terminal size={12} className="text-sky-600 dark:text-sky-400" />
        <span className="text-[12px] font-semibold">build_vae.py</span>
        <span className="text-[10px] font-mono text-muted-foreground/55 ml-1">
          {done ? `${TERM_SCRIPT.length} lines · complete` : `${visibleCount}/${TERM_SCRIPT.length} lines · streaming`}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-[#0d1117] px-4 py-3 font-mono text-[12px] leading-relaxed space-y-0.5">
        {TERM_SCRIPT.slice(0, visibleCount).map(([, line], i) => {
          const isLast = i === visibleCount - 1 && !done
          return (
          <div key={i} className="flex items-start gap-2">
            {line.kind === 'cmd'  && <span className="text-emerald-400 select-none shrink-0">$</span>}
            {line.kind === 'code' && <span className="text-primary/40 select-none shrink-0">·</span>}
            {(line.kind === 'out' || line.kind === 'dim' || line.kind === 'ok') && <span className="select-none shrink-0 w-3" />}
            <span className={cn(
              'whitespace-pre-wrap break-all',
              line.kind === 'cmd'  && 'text-white/90',
              line.kind === 'out'  && 'text-white/55',
              line.kind === 'dim'  && 'text-white/35',
              line.kind === 'ok'   && 'text-emerald-400',
              line.kind === 'code' && 'text-sky-300/80',
            )}>
              {line.text}
              {isLast && (
                <span className="inline-block w-1.5 h-3 bg-white/70 ml-0.5 animate-pulse align-text-bottom rounded-sm" />
              )}
            </span>
          </div>
        )})}
      </div>
    </div>
  )
}

// Full-tab metrics viewer (bigger chart and epoch table)
function MetricsDetailTab({ onClose, epoch }: { onClose: () => void; epoch: number }) {
  const clampedEpoch = Math.min(Math.max(epoch, 0), FINAL_LOSSES.length - 1)
  const done = clampedEpoch >= FINAL_LOSSES.length - 1
  const shownLosses = FINAL_LOSSES.slice(0, clampedEpoch + 1)
  const W = 760
  const H = 170
  const maxLoss = FINAL_LOSSES[0]
  const minLoss = FINAL_LOSSES[FINAL_LOSSES.length - 1]
  const pts = shownLosses
    .map((v, i) => {
      const x = (i / (FINAL_LOSSES.length - 1)) * W
      const y = H - ((maxLoss - v) / (maxLoss - minLoss)) * H * 0.9 - 6
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 flex-shrink-0 bg-background/80 backdrop-blur-sm">
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft size={12} /> Back to chat
        </button>
        <span className="text-muted-foreground/30 mx-1">/</span>
        <Brain size={12} className="text-violet-600 dark:text-violet-400" />
        <span className="text-[12px] font-semibold">Brightness VAE metrics</span>
        <span className="text-[10px] font-mono text-muted-foreground/55 ml-1">
          {done ? '30 epochs · converged' : `epoch ${clampedEpoch + 1}/30 · training`}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold">Loss curve</span>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {done ? 'final loss 0.021 · RMSE 0.09' : `current loss ${shownLosses[shownLosses.length - 1].toFixed(3)}`}
            </span>
          </div>
          <svg width={W} height={H} className="max-w-full h-auto overflow-visible">
            {[0.2, 0.4, 0.6, 0.8].map(f => (
              <line key={f} x1={0} y1={H * f} x2={W} y2={H * f} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            ))}
            {shownLosses.length > 1 && (
              <polyline points={pts} fill="none" stroke="rgb(45 212 191)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </div>

        <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 text-[11px] font-semibold">Epoch log</div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-muted/25 text-muted-foreground/70 sticky top-0">
                <tr>
                  {['epoch', 'loss'].map(h => (
                    <th key={h} className="text-left px-3 py-1.5 font-medium uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownLosses.map((loss, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="px-3 py-1.5">{String(i).padStart(2, '0')}</td>
                    <td className={cn('px-3 py-1.5', done && i === FINAL_LOSSES.length - 1 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground/80')}>
                      {loss.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MockGfp11Chat({ sessionId }: { sessionId: string }) {
  const STORAGE_PREFIX = 'mock-gfp11-chat-state-v1:'
  const navigate = useNavigate()
  const storageKey = `${STORAGE_PREFIX}${sessionId}`
  const restoredRef = useRef(false)

  const [phase, setPhase] = useState<Phase>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 'user_goal'
      const parsed = JSON.parse(raw) as { phase?: Phase }
      return parsed.phase ?? 'user_goal'
    } catch {
      return 'user_goal'
    }
  })
  const [activeTab, setActiveTab] = useState<'chat' | 'excel' | 'dataset' | 'pipeline' | 'code' | 'metrics'>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 'chat'
      const parsed = JSON.parse(raw) as { activeTab?: 'chat' | 'excel' | 'dataset' | 'pipeline' | 'code' | 'metrics' }
      return parsed.activeTab ?? 'chat'
    } catch {
      return 'chat'
    }
  })
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedUploadName, setSelectedUploadName] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 'gfp11_brightness.xlsx'
      const parsed = JSON.parse(raw) as { selectedUploadName?: string }
      return parsed.selectedUploadName ?? 'gfp11_brightness.xlsx'
    } catch {
      return 'gfp11_brightness.xlsx'
    }
  })
  const [codeVisibleCount, setCodeVisibleCount] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 0
      const parsed = JSON.parse(raw) as { codeVisibleCount?: number }
      return parsed.codeVisibleCount ?? 0
    } catch {
      return 0
    }
  })
  const [trainingEpoch, setTrainingEpoch] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 0
      const parsed = JSON.parse(raw) as { trainingEpoch?: number }
      return parsed.trainingEpoch ?? 0
    } catch {
      return 0
    }
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const codeStartedRef = useRef(false)
  const codeAdvanceFiredRef = useRef(false)
  const trainingStartedRef = useRef(false)
  const trainingAdvanceFiredRef = useRef(false)

  const advance = useCallback((to: Phase, delay = 0) => {
    timerRef.current = setTimeout(() => setPhase(to), delay)
  }, [])

  const phaseIdx: Record<Phase, number> = useMemo(() => ({
    user_goal: 0, agent_asking: 1, wait_upload: 2, uploading: 3,
    agent_reading: 4, show_dataset: 5, agent_model: 6,
    pipeline_preview: 7, pipeline_approved: 8,
    coding: 9, training: 10, agent_wrapping: 11, done: 12,
  }), [])
  const at = (p: Phase) => phaseIdx[phase] >= phaseIdx[p]

  // Rehydrate progression refs so resumed sessions don't restart internal timers.
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (phaseIdx[phase] >= phaseIdx.coding || codeVisibleCount > 0) codeStartedRef.current = true
    if (phaseIdx[phase] > phaseIdx.coding || codeVisibleCount >= TERM_SCRIPT.length) codeAdvanceFiredRef.current = true
    if (phaseIdx[phase] >= phaseIdx.training || trainingEpoch > 0) trainingStartedRef.current = true
    if (phaseIdx[phase] > phaseIdx.training || trainingEpoch >= FINAL_LOSSES.length - 1) trainingAdvanceFiredRef.current = true
  }, [phase, phaseIdx, codeVisibleCount, trainingEpoch])

  // Kick off the scripted sequence
  useEffect(() => {
    if (phase !== 'user_goal') return
    advance('agent_asking', T.AGENT_ASK_START)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [advance, phase])

  // Auto-scroll on every phase change
  useEffect(() => {
    const el = scrollRef.current
    if (el) setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 50)
  }, [phase])

  const startUploadFlow = useCallback(() => {
    setShowUploadDialog(false)
    setPhase('uploading')
    setTimeout(() => {
      setPhase('agent_reading')
    }, 1400)
  }, [])

  // Shared code streaming timeline (source of truth for both chat card and Code tab)
  useEffect(() => {
    if (phaseIdx[phase] < phaseIdx.coding || codeStartedRef.current) return
    codeStartedRef.current = true
    let cumDelay = 0
    const timeouts: ReturnType<typeof setTimeout>[] = []
    TERM_SCRIPT.forEach(([delay], i) => {
      cumDelay += delay
      const t = setTimeout(() => setCodeVisibleCount(i + 1), cumDelay)
      timeouts.push(t)
    })
    return () => timeouts.forEach(clearTimeout)
  }, [phase, phaseIdx])

  // Advance to training once code stream is fully shown
  useEffect(() => {
    if (phase === 'coding' && codeVisibleCount >= TERM_SCRIPT.length && !codeAdvanceFiredRef.current) {
      codeAdvanceFiredRef.current = true
      const t = setTimeout(() => advance('training', 400), 350)
      return () => clearTimeout(t)
    }
  }, [phase, codeVisibleCount, advance])

  // Shared training timeline (source of truth for card + Metrics tab)
  useEffect(() => {
    if (phaseIdx[phase] < phaseIdx.training || trainingStartedRef.current) return
    trainingStartedRef.current = true
    const iv = setInterval(() => {
      setTrainingEpoch(e => Math.min(e + 1, FINAL_LOSSES.length - 1))
    }, 230)
    return () => clearInterval(iv)
  }, [phase, phaseIdx])

  // Advance to wrap-up once training converges
  useEffect(() => {
    if (phase === 'training' && trainingEpoch >= FINAL_LOSSES.length - 1 && !trainingAdvanceFiredRef.current) {
      trainingAdvanceFiredRef.current = true
      const t = setTimeout(() => advance('agent_wrapping', 300), 600)
      return () => clearTimeout(t)
    }
  }, [phase, trainingEpoch, advance])

  // Persist mock session state across tab switches/refresh.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        phase,
        activeTab,
        selectedUploadName,
        codeVisibleCount,
        trainingEpoch,
      }))
    } catch {
      // ignore storage write failures
    }
  }, [storageKey, phase, activeTab, selectedUploadName, codeVisibleCount, trainingEpoch])

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Tab bar — appears once the file has been uploaded */}
      {at('agent_reading') && (
        <div className="flex-shrink-0 border-b border-border/30 px-3 flex items-center gap-0 bg-background/50">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
              activeTab === 'chat'
                ? 'text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground/80'
            )}
          >
            <Bot size={11} /> Chat
            {activeTab === 'chat' && (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={cn(
              'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
              activeTab === 'excel'
                ? 'text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground/80'
            )}
            title="View source spreadsheet"
          >
            <FileSpreadsheet size={11} className="text-emerald-600 dark:text-emerald-400" />
            gfp11_brightness.xlsx
            {activeTab === 'excel' && (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
            )}
          </button>
          {at('show_dataset') && (
            <button
              onClick={() => setActiveTab('dataset')}
              className={cn(
                'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
                activeTab === 'dataset'
                  ? 'text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground/80'
              )}
            >
              <Search size={11} /> Dataset
              {activeTab === 'dataset' && (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
              )}
            </button>
          )}
          {at('pipeline_preview') && (
            <button
              onClick={() => setActiveTab('pipeline')}
              className={cn(
                'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
                activeTab === 'pipeline'
                  ? 'text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground/80'
              )}
            >
              <GitBranch size={11} /> Pipeline
              {at('pipeline_approved') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" title="Approved" />
              )}
              {activeTab === 'pipeline' && (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
              )}
            </button>
          )}
          {at('coding') && (
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
                activeTab === 'code'
                  ? 'text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground/80'
              )}
            >
              <Terminal size={11} /> Code
              {activeTab === 'code' && (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
              )}
            </button>
          )}
          {at('training') && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={cn(
                'relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5',
                activeTab === 'metrics'
                  ? 'text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground/80'
              )}
            >
              <Brain size={11} /> Metrics
              {activeTab === 'metrics' && (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Excel raw-file tab — full spreadsheet view */}
      {activeTab === 'excel' && (
        <div className="flex-1 min-h-0">
          <ExcelDetailTab onClose={() => setActiveTab('chat')} />
        </div>
      )}

      {/* Dataset tab content — overlay, but only renders when active */}
      {activeTab === 'dataset' && (
        <div className="flex-1 min-h-0">
          <DatasetDetailTab onClose={() => setActiveTab('chat')} />
        </div>
      )}

      {/* Pipeline tab content — full editor view */}
      {activeTab === 'pipeline' && (
        <div className="flex-1 min-h-0">
          <PipelineDetailTab
            onClose={() => setActiveTab('chat')}
            canRun={at('pipeline_approved')}
            onRun={() => {
              setActiveTab('chat')
              if (!at('pipeline_approved')) advance('pipeline_approved', 0)
            }}
          />
        </div>
      )}
      {activeTab === 'code' && (
        <div className="flex-1 min-h-0">
          <CodeDetailTab onClose={() => setActiveTab('chat')} visibleCount={codeVisibleCount} />
        </div>
      )}
      {activeTab === 'metrics' && (
        <div className="flex-1 min-h-0">
          <MetricsDetailTab onClose={() => setActiveTab('chat')} epoch={trainingEpoch} />
        </div>
      )}

      {/* Chat content — always mounted (so timers keep running); just hidden when on dataset tab */}
      <div className={cn(
        'flex flex-col flex-1 min-h-0',
        activeTab !== 'chat' && 'hidden'
      )}>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-5">

        {/* ── Turn 1: User goal ── */}
        <UserRow>{GOAL_MSG}</UserRow>

        {/* ── Turn 2: Agent asks for file ── */}
        <AgentTurn steps={STEPS_FIRST_REPLY} visible={at('agent_asking')}>
          <StreamBlock
            text={ASK_MSG}
            startAt={0}
            onDone={() => advance('wait_upload', 400)}
          />
        </AgentTurn>

        {/* ── Turn 3: Upload button / uploaded chip ── */}
        {at('wait_upload') && (
          <div className="flex justify-end">
            {phase === 'wait_upload' && (
              <button
                type="button"
                onClick={() => setShowUploadDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-[12px] text-primary/70 hover:text-primary font-medium transition-all group"
              >
                <Upload size={14} className="group-hover:translate-y-[-1px] transition-transform" />
                Upload your data
              </button>
            )}
            {phase === 'uploading' && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-[12px] text-muted-foreground">
                <Loader2 size={13} className="animate-spin text-primary/60" />
                Uploading {selectedUploadName}…
              </div>
            )}
            {at('agent_reading') && (
              <button
                type="button"
                onClick={() => setActiveTab('excel')}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 hover:border-emerald-500/50 text-[12px] transition-all"
                title="Open spreadsheet"
              >
                <FileSpreadsheet size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span className="text-foreground/80 font-medium">{selectedUploadName}</span>
                <span className="text-muted-foreground/60">· 113 rows · 18 KB</span>
                <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400 ml-1" />
                <Maximize2 size={10} className="text-muted-foreground/40 group-hover:text-foreground/80 transition-colors ml-1" />
              </button>
            )}
          </div>
        )}

        {/* ── Turn 4: Agent reads file ── */}
        <AgentTurn steps={STEPS_READING_DATA} visible={at('agent_reading')}>
          <StreamBlock
            text={READ_MSG}
            startAt={0}
            onDone={() => advance('show_dataset', 600)}
          />
        </AgentTurn>

        {/* ── Dataset stats card — opens detail tab ── */}
        {at('show_dataset') && (
          <BotRow>
            <button
              type="button"
              onClick={() => setActiveTab('dataset')}
              className="group w-full max-w-[420px] text-left rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border transition-all overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border/40">
                <FileSpreadsheet size={13} className="text-muted-foreground/70" />
                <div className="flex flex-col -space-y-0.5 min-w-0 flex-1">
                  <span className="text-[12px] font-semibold truncate">Dataset summary</span>
                  <span className="text-[10px] font-mono text-muted-foreground/55">gfp11_brightness.xlsx · 113 rows</span>
                </div>
                <Maximize2 size={11} className="text-muted-foreground/40 group-hover:text-foreground/70 transition-colors flex-shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-px bg-border/30">
                {STATS.slice(0, 3).map(s => (
                  <div key={s.label} className="bg-card/40 px-2.5 py-2">
                    <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{s.label}</div>
                    <div className="text-[12px] font-mono font-semibold mt-0.5">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="px-3.5 py-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground/70 border-t border-border/40">
                <CheckCircle2 size={10} className="text-emerald-500/70 flex-shrink-0" />
                Quality check passed
                <span className="ml-auto text-muted-foreground/50 group-hover:text-foreground/80 transition-colors">Open full report →</span>
              </div>
            </button>
          </BotRow>
        )}

        {/* Auto-advance from show_dataset to agent_model */}
        <DatasetAutoAdvance phase={phase} onAdvance={() => advance('agent_model', 0)} />

        {/* ── Turn 5: Agent proposes model ── */}
        <AgentTurn steps={STEPS_MODEL_DESIGN} visible={at('agent_model')}>
          <StreamBlock
            text={MODEL_MSG}
            startAt={0}
            onDone={() => advance('pipeline_preview', 500)}
          />
        </AgentTurn>

        {/* ── Turn 5b: Pipeline preview + approval gate ── */}
        {at('pipeline_preview') && (
          <BotRow>
            <PipelinePreviewCard
              approved={at('pipeline_approved')}
              onApprove={() => advance('pipeline_approved', 0)}
              onOpenEditor={() => setActiveTab('pipeline')}
            />
          </BotRow>
        )}

        {/* User "approval" message bubble */}
        {at('pipeline_approved') && (
          <UserRow>Looks good — go ahead and build it.</UserRow>
        )}

        {/* Auto-advance from approval to coding */}
        <ApprovalAutoAdvance phase={phase} onAdvance={() => advance('coding', 0)} />

        {/* ── Turn 5c: Live code streaming ── */}
        {at('coding') && (
          <BotRow>
            <div className="space-y-1.5">
              <div className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-1.5">
                <Terminal size={11} />
                Writing model implementation…
              </div>
              <StreamingCode
                visibleCount={codeVisibleCount}
                onOpenTab={() => setActiveTab('code')}
              />
            </div>
          </BotRow>
        )}

        {/* ── Turn 6: Training animation ── */}
        {at('training') && (
          <BotRow>
            <TrainingCard
              visible={at('training')}
              epoch={trainingEpoch}
              onOpenTab={() => setActiveTab('metrics')}
            />
          </BotRow>
        )}

        {/* ── Turn 7: Agent wrap-up + pipeline card ── */}
        <AgentTurn steps={STEPS_BUILDING_PIPELINE} visible={at('agent_wrapping')}>
          <div className="space-y-3">
                <StreamBlock
                  text={WRAP_MSG}
                  startAt={0}
                  onDone={() => advance('done', 500)}
                />

                {/* Pipeline card */}
                {at('done') && (
                  <button
                    type="button"
                    onClick={() => navigate('/lab/pipelines?pipeline=gfp11')}
                    className="group w-full max-w-[440px] text-left rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border transition-all overflow-hidden mt-1"
                  >
                    {/* Header strip */}
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border/40">
                      <div className="w-7 h-7 rounded-md bg-muted/60 border border-border/50 flex items-center justify-center flex-shrink-0">
                        <GitBranch size={12} className="text-foreground/70" />
                      </div>
                      <div className="flex flex-col -space-y-0.5 min-w-0 flex-1">
                        <span className="text-[12px] font-semibold truncate">GFP11 Optimization</span>
                        <span className="text-[10px] text-muted-foreground/60">Pipeline · ready to run</span>
                      </div>
                      <span className="text-[9.5px] font-mono text-muted-foreground/60 bg-muted/60 border border-border/40 rounded-full px-2 py-0.5">
                        6 nodes
                      </span>
                    </div>

                    {/* Node chain */}
                    <div className="px-3.5 py-2.5 flex items-center flex-wrap gap-1 text-[10px] font-mono text-muted-foreground/75">
                      {['VAE', 'AlphaFold', 'Stability', 'Interaction', 'Ranker', 'Update'].map((n, i, arr) => (
                        <span key={n} className="flex items-center gap-1">
                          <span className="text-foreground/80">{n}</span>
                          {i < arr.length - 1 && <ChevronRightIcon size={9} className="text-muted-foreground/40" />}
                        </span>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="px-3.5 py-2 border-t border-border/40 flex items-center justify-between text-[10.5px]">
                      <span className="text-muted-foreground/70">3 rounds · 150 candidates · closed loop</span>
                      <span className="flex items-center gap-1 text-foreground/80 font-medium group-hover:gap-1.5 transition-all">
                        Open pipeline <ArrowRight size={10} />
                      </span>
                    </div>
                  </button>
                )}
          </div>
        </AgentTurn>

        <div className="h-4" />
      </div>

      {/* Input bar — frozen during demo */}
      <div className="flex-shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center rounded-2xl border border-black/70 dark:border-white/75 bg-background/95 px-4 py-2.5 text-[13px] text-muted-foreground/40 select-none cursor-default gap-2">
            {at('wait_upload') && !at('agent_reading')
              ? <><Upload size={13} className="text-muted-foreground/30" /> Drop a file or type a message…</>
              : <>Ask a follow-up…</>
            }
          </div>
        </div>
      </div>

      {/* Upload dialog (mocked) */}
      {showUploadDialog && (
        <div className="absolute inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border/60 bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <Upload size={14} className="text-primary/70" />
              <span className="text-[13px] font-semibold">Upload Excel file</span>
              <button
                type="button"
                onClick={() => setShowUploadDialog(false)}
                className="ml-auto p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-[12px] text-muted-foreground/75">
                Select your assay spreadsheet (.xlsx/.xls). We will parse sequence and brightness columns.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all px-4 py-6 text-center group"
              >
                <div className="inline-flex items-center gap-2 text-[12px] font-medium text-primary/80 group-hover:text-primary">
                  <FileSpreadsheet size={14} />
                  {selectedUploadName ? `Selected: ${selectedUploadName}` : 'Choose Excel file…'}
                </div>
                <div className="text-[10.5px] text-muted-foreground/60 mt-1">
                  Drag & drop (mock) or click to browse
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setSelectedUploadName(file.name)
                }}
              />
            </div>

            <div className="px-4 py-3 border-t border-border/40 bg-muted/15 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadDialog(false)}
                className="px-3 py-1.5 rounded-md border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startUploadFlow}
                className="px-3 py-1.5 rounded-md bg-foreground text-background text-[11px] font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
              >
                <Upload size={11} /> Upload
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
