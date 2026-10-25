import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * StatCard — a small bordered card for headline counts.
 *
 * Used by org overview tiles. For inline label/value display inside a busy
 * row (no surrounding chrome) prefer `StatPill` with `variant="block"`.
 */
interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  className?: string
}

export function StatCard({ label, value, icon, hint, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-3', className)}>
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
