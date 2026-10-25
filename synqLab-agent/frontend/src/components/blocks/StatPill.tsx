import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * StatPill — compact label/value display.
 *
 * Two visual flavours:
 *   - `block` (default): stacked label-on-top / value-on-bottom block with no
 *     surrounding chrome. Used in dense lists like ExperimentRow.
 *   - `pill`: rounded pill with optional icon and tone background. Used in
 *     ToolsPage and similar header strips.
 */
export type StatTone = 'emerald' | 'amber' | 'slate' | 'sky' | 'rose' | 'teal'

const TONE_PILL: Record<StatTone, string> = {
  emerald: 'bg-status-ok-bg text-status-ok-text border-status-ok/30',
  amber:   'bg-status-warn-bg text-status-warn-text border-status-warn/30',
  slate:   'bg-card text-muted-foreground border-border',
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  teal:    'bg-status-info-bg text-teal-800 border-teal-200',
}

interface StatPillProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: StatTone
  icon?: ReactNode
  variant?: 'block' | 'pill'
  className?: string
}

export function StatPill({
  label,
  value,
  hint,
  tone = 'slate',
  icon,
  variant = 'block',
  className,
}: StatPillProps) {
  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
          TONE_PILL[tone],
          className,
        )}
      >
        {icon}
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </span>
    )
  }
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[13px] font-bold text-foreground">{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  )
}
