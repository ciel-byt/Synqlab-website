import { cn } from '@/lib/utils'
import type { MetricDef } from './types'

export const fmt = (v: number, m: MetricDef) => v.toFixed(m.dec)

/** Green up / red down change chip, e.g. "▲ +8.2". Neutral when there is no change. */
export function Delta({ value, base, m, className }: { value?: number; base?: number; m: MetricDef; className?: string }) {
  if (value == null || base == null) return null
  const d = value - base
  const zero = Math.abs(d) < 0.5 * 10 ** -m.dec
  const up = d > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
      zero ? 'bg-muted text-muted-foreground' : up ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400', className)}>
      {zero ? '0' : <>{up ? '▲' : '▼'} {up ? '+' : '−'}{Math.abs(d).toFixed(m.dec)}</>}
    </span>
  )
}
