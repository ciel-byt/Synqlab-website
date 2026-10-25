/**
 * UsageDashboard — token/cost/tool-call breakdown for an agent session.
 */

import { useState, useEffect } from 'react'
import { Loader2, Zap, DollarSign, Wrench, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { UsageSummary } from '@/features/agent/types'
import { BudgetMeter } from '@/features/agent/components/BudgetMeter'

interface UsageDashboardProps {
  sessionId: string
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function UsageDashboard({ sessionId }: UsageDashboardProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getSessionUsage(sessionId)
        if (!cancelled) setUsage(data)
      } catch (err) {
        console.error('Failed to load usage:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading usage...
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        No usage data available.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4">
      {/* Budget gauge + stats row */}
      <div className="flex items-center gap-4">
        <BudgetMeter usage={usage} size={80} />

        <div className="flex-1 space-y-2">
          {/* Token breakdown */}
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] text-muted-foreground w-12">Input</span>
            <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: usage.total_tokens > 0
                    ? `${(usage.input_tokens / usage.total_tokens) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <span className="text-[10px] font-mono w-14 text-right">
              {formatTokens(usage.input_tokens)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-3 w-3 text-violet-500" />
            <span className="text-[10px] text-muted-foreground w-12">Output</span>
            <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{
                  width: usage.total_tokens > 0
                    ? `${(usage.output_tokens / usage.total_tokens) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <span className="text-[10px] font-mono w-14 text-right">
              {formatTokens(usage.output_tokens)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/10 border border-border/20 px-2.5 py-2 text-center">
          <Zap className="h-3.5 w-3.5 mx-auto mb-1 text-amber-500" />
          <div className="text-sm font-bold">{formatTokens(usage.total_tokens)}</div>
          <div className="text-[8px] text-muted-foreground">Total Tokens</div>
        </div>
        <div className="rounded-lg bg-muted/10 border border-border/20 px-2.5 py-2 text-center">
          <DollarSign className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-500" />
          <div className="text-sm font-bold">${usage.estimated_cost_usd.toFixed(3)}</div>
          <div className="text-[8px] text-muted-foreground">Est. Cost</div>
        </div>
        <div className="rounded-lg bg-muted/10 border border-border/20 px-2.5 py-2 text-center">
          <Wrench className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
          <div className="text-sm font-bold">{usage.tool_calls}</div>
          <div className="text-[8px] text-muted-foreground">Tool Calls</div>
        </div>
      </div>

      {/* Model breakdown */}
      {usage.model_breakdown && Object.keys(usage.model_breakdown).length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase">
            Per Model
          </span>
          {Object.entries(usage.model_breakdown).map(([model, counts]) => (
            <div key={model} className="flex items-center gap-2 text-[10px]">
              <Badge variant="outline" className="text-[8px] h-3.5 px-1">{model}</Badge>
              <span className="text-muted-foreground flex-1">
                {formatTokens(counts.input)} in / {formatTokens(counts.output)} out
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status badge */}
      {usage.status && usage.status !== 'ok' && (
        <div className={`rounded-lg px-3 py-2 text-xs ${
          usage.status === 'hard_limit'
            ? 'bg-destructive/10 text-destructive border border-destructive/20'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
          {usage.status === 'hard_limit'
            ? '⛔ Budget limit reached — session paused'
            : '⚠️ Approaching token budget limit'
          }
        </div>
      )}
    </div>
  )
}
