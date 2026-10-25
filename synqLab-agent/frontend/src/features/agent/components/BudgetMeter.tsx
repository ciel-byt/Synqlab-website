/**
 * BudgetMeter — circular SVG gauge showing session token usage vs budget limit.
 */

import type { UsageSummary } from '@/features/agent/types'

interface BudgetMeterProps {
  usage: UsageSummary
  size?: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function BudgetMeter({ usage, size = 100 }: BudgetMeterProps) {
  const ratio = usage.budget_used_ratio ?? 0
  const clamped = Math.min(ratio, 1)
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)

  // Color transitions: green → amber → red.
  const color = ratio >= 0.9 ? 'stroke-red-500' :
                ratio >= 0.7 ? 'stroke-amber-500' :
                'stroke-emerald-500'

  const bgColor = ratio >= 0.9 ? 'text-red-500/10' :
                  ratio >= 0.7 ? 'text-amber-500/10' :
                  'text-emerald-500/10'

  const textColor = ratio >= 0.9 ? 'text-red-500' :
                    ratio >= 0.7 ? 'text-amber-500' :
                    'text-emerald-500'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={6}
            className="stroke-muted/20"
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={6}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${color} transition-all duration-700`}
          />
        </svg>

        {/* Inner text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-bold ${textColor}`}>
            {Math.round(ratio * 100)}%
          </span>
          <span className="text-[8px] text-muted-foreground">
            {formatTokens(usage.total_tokens)}
          </span>
        </div>

        {/* Pulse overlay for soft/hard limit */}
        {usage.status && usage.status !== 'ok' && (
          <div className={`absolute inset-0 rounded-full ${bgColor} animate-pulse`} />
        )}
      </div>

      {/* Cost */}
      <div className="text-center">
        <span className="text-[10px] text-muted-foreground">
          ${usage.estimated_cost_usd.toFixed(3)}
        </span>
        {usage.budget_limit && (
          <span className="text-[9px] text-muted-foreground/60 block">
            of {formatTokens(usage.budget_limit)} tokens
          </span>
        )}
      </div>
    </div>
  )
}
