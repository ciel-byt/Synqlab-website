/**
 * OutputFields — structured output renderer for tool run results.
 * Renders number arrays as spark bar charts, confidence scores as progress bars,
 * file paths, booleans, and generic key/value pairs.
 * Uses shadcn Badge and Progress for consistency.
 */
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function OutputFields({ outputs }: { outputs: Record<string, unknown> }) {
  return (
    <div className="divide-y divide-border border border-border rounded-md overflow-hidden text-[12.5px]">
      {Object.entries(outputs).map(([key, val]) => {
        // ── number array → spark bar chart
        if (Array.isArray(val) && val.every(v => typeof v === 'number')) {
          const nums = val as number[]
          const min = Math.min(...nums)
          const max = Math.max(...nums)
          const range = max - min || 1
          const avg = nums.reduce((a, b) => a + b, 0) / nums.length
          return (
            <div key={key} className="px-3 py-2.5 bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-semibold text-muted-foreground">{key}</span>
                <span className="text-muted-foreground/70 text-[11px]">
                  avg <span className="font-semibold text-muted-foreground">{avg.toFixed(1)}</span>
                  &nbsp;·&nbsp;range {min.toFixed(1)}–{max.toFixed(1)}
                  &nbsp;·&nbsp;{nums.length} values
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-10">
                {nums.map((v, i) => {
                  const pct = ((v - min) / range) * 100
                  return (
                    <div
                      key={i}
                      title={`[${i}] ${v.toFixed(2)}`}
                      className={cn(
                        'flex-1 min-w-0 rounded-sm cursor-default transition-opacity hover:opacity-70',
                        pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400',
                      )}
                      style={{ height: `${Math.max(8, pct)}%` }}
                    />
                  )
                })}
              </div>
            </div>
          )
        }

        // ── file path
        if (typeof val === 'string' && (val.endsWith('.pdb') || val.endsWith('.json') || val.endsWith('.csv') || val.includes('/'))) {
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-2.5 bg-card min-w-0">
              <span className="font-mono font-semibold text-muted-foreground shrink-0">{key}</span>
              <Badge variant="secondary" className="font-mono text-[11px] truncate min-w-0 flex-1 justify-start" title={val}>{val}</Badge>
            </div>
          )
        }

        // ── number
        if (typeof val === 'number') {
          const isConfidence = key.toLowerCase().includes('confidence') || key.toLowerCase().includes('plddt') || key.toLowerCase().includes('score')
          const pct = isConfidence ? Math.max(0, Math.min(100, val)) : null
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-2.5 bg-card">
              <span className="font-mono font-semibold text-muted-foreground shrink-0 w-32 truncate">{key}</span>
              <span className="font-semibold text-foreground tabular-nums">{val.toFixed(2)}</span>
              {pct !== null && (
                <div className="flex-1">
                  <Progress value={pct} className="h-1.5" />
                </div>
              )}
              {pct !== null && (
                <Badge variant={pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error'}>
                  {pct.toFixed(0)}%
                </Badge>
              )}
            </div>
          )
        }

        // ── boolean
        if (typeof val === 'boolean') {
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-2.5 bg-card">
              <span className="font-mono font-semibold text-muted-foreground w-32 truncate">{key}</span>
              <Badge variant={val ? 'success' : 'error'}>
                {val ? 'true' : 'false'}
              </Badge>
            </div>
          )
        }

        // ── default: string or object
        return (
          <div key={key} className="flex items-start gap-3 px-3 py-2.5 bg-card">
            <span className="font-mono font-semibold text-muted-foreground shrink-0 w-32 truncate">{key}</span>
            <span className="text-foreground/80 break-all">
              {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
