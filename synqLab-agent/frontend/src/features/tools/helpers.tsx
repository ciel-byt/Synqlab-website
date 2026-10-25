/**
 * Tools feature — shared helpers.
 *
 * Extracted from ToolsPage.tsx. Category accents, tag palettes, and resource
 * formatting utilities used by tool cards and detail views.
 */
import React from 'react'
import { Atom, Cpu, Database, Dna, FileSpreadsheet, FlaskConical, BarChart2, ListOrdered, Rotate3d, Zap } from 'lucide-react'

// ── Per-tool-id icons (domain-specific) ──────────────────────────────────────

const TOOL_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  protgpt2:                  Dna,
  omegafold:                 Rotate3d,
  esmfold:                   Rotate3d,
  foldx:                     Atom,
  reranker:                  ListOrdered,
  experiment_store:          Database,
  fluorescence_label_ingest: FileSpreadsheet,
}

// ── Category icons (fallback) ────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  sequence_generation:  FlaskConical,
  structure_prediction: Cpu,
  scoring:              BarChart2,
  data:                 Database,
}

export function CatIcon({ cat, size = 14 }: { cat: string; size?: number }) {
  const Icon = CAT_ICON[cat] ?? Zap
  return <Icon size={size} />
}

/**
 * ToolIcon — resolves a specific icon for a tool by ID, falling back to
 * category icon if no per-tool mapping exists.
 */
export function ToolIcon({ toolId, category, size = 14, className }: {
  toolId: string
  category?: string
  size?: number
  className?: string
}) {
  const Icon = TOOL_ICON[toolId] ?? (category ? CAT_ICON[category] : null) ?? Zap
  return <Icon size={size} className={className} />
}

// ── Category accent palettes ─────────────────────────────────────────────────

const CAT_ACCENT: Record<string, { bar: string; chip: string; ring: string; titleColor: string; iconBg: string; iconText: string }> = {
  sequence_generation: {
    bar: 'from-violet-400 via-fuchsia-400 to-pink-400',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    ring: 'ring-violet-200',
    titleColor: 'text-rose-600 dark:text-rose-300/80',
    iconBg: 'bg-violet-100',
    iconText: 'text-rose-600 dark:text-rose-300/80',
  },
  structure_prediction: {
    bar: 'from-sky-400 via-cyan-400 to-teal-400',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    ring: 'ring-sky-200',
    titleColor: 'text-sky-600 dark:text-sky-300/80',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600 dark:text-sky-300/80',
  },
  scoring: {
    bar: 'from-amber-400 via-orange-400 to-rose-400',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    ring: 'ring-amber-200',
    titleColor: 'text-amber-600 dark:text-amber-300/80',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600 dark:text-amber-300/80',
  },
  data: {
    bar: 'from-emerald-400 via-teal-400 to-cyan-400',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ring: 'ring-emerald-200',
    titleColor: 'text-emerald-600 dark:text-emerald-300/80',
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600 dark:text-teal-300/80',
  },
}

export function catAccent(cat: string) {
  return CAT_ACCENT[cat] ?? { bar: 'from-slate-400 to-slate-500', chip: 'bg-surface text-muted-foreground border-border', ring: 'ring-border', titleColor: 'text-muted-foreground', iconBg: 'bg-muted', iconText: 'text-muted-foreground' }
}

// ── Tag palettes — use entity color system for theme alignment ───────────────

const ENTITY_TAG_COUNT = 6

function tagColorIndex(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return h % ENTITY_TAG_COUNT
}

export function tagColor(tag: string) {
  return tagColorIndex(tag)
}

export function ToolTagChip({ tag }: { tag: string }) {
  const idx = tagColorIndex(tag)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border"
      style={{
        backgroundColor: `hsl(var(--entity-${idx}) / 0.1)`,
        borderColor: `hsl(var(--entity-${idx}) / 0.2)`,
        color: `hsl(var(--entity-${idx}))`,
      }}
    >
      {tag}
    </span>
  )
}

// ── Resource formatting ──────────────────────────────────────────────────────

export function fmtDisk(gb: number | undefined): string {
  if (gb == null) return '—'
  if (gb === 0) return 'n/a'
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb} GB`
}

export function fmtRam(gb: number | undefined): string {
  if (gb == null) return '—'
  if (gb === 0) return 'n/a'
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`
  return `${gb} GB`
}

// ── Compute style maps ───────────────────────────────────────────────────────

export const COMPUTE_STYLE: Record<string, string> = {
  gpu:      'bg-violet-100 text-violet-700 border-violet-300',
  cpu:      'bg-sky-100 text-sky-700 border-sky-300',
  external: 'bg-muted text-muted-foreground border-border',
}

export const COMPUTE_LABEL: Record<string, string> = {
  gpu: 'GPU', cpu: 'CPU', external: 'API',
}

/* ── Minimal animated category avatars ── */

export function AnimatedAvatar({ category }: { category: string }) {
  const patterns: Record<string, React.ReactNode> = {
    sequence_generation: (
      <svg viewBox="0 0 28 28" className="w-full h-full text-violet-500">
        <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="15 45">
          <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="14" cy="14" r="4" fill="currentColor" opacity="0.4" className="animate-pulse" />
      </svg>
    ),
    structure_prediction: (
      <svg viewBox="0 0 28 28" className="w-full h-full text-sky-500">
        <rect x="7" y="7" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="4s" repeatCount="indefinite" />
        </rect>
        <circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    scoring: (
      <svg viewBox="0 0 28 28" className="w-full h-full text-amber-500">
        <polygon points="14,6 22,19 6,19" fill="none" stroke="currentColor" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="3.5s" repeatCount="indefinite" />
        </polygon>
        <circle cx="14" cy="15" r="2.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    data: (
      <svg viewBox="0 0 28 28" className="w-full h-full text-emerald-500">
        <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="30 30">
          <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.6" className="animate-ping" style={{ animationDuration: '2s' }} />
      </svg>
    ),
  }
  
  return (
    <div className="w-full h-full bg-muted/40 rounded-md flex items-center justify-center relative overflow-hidden">
      {patterns[category] ?? patterns.sequence_generation}
    </div>
  )
}
// ── Link metadata ────────────────────────────────────────────────────────────

export const LINK_LABELS: Record<string, string> = {
  paper: 'Paper', model: 'Model', code: 'Code', website: 'Website', docs: 'Docs', demo: 'Demo',
}

// ── Availability sort ────────────────────────────────────────────────────────

/** Sort items so available ones float to the top. */
export function sortByAvailability<T extends { id: string }>(
  items: T[],
  health: Record<string, { available: boolean }>,
): T[] {
  return [...items].sort((a, b) => {
    const aUp = health[a.id]?.available ? 1 : 0
    const bUp = health[b.id]?.available ? 1 : 0
    return bUp - aUp
  })
}
