/**
 * BatchProgress — live grid showing per-item status of a batch pipeline run.
 */

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { PipelineRun } from '@/features/lab/types'

interface BatchProgressProps {
  runId: string
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-muted-foreground/40', bg: 'bg-muted/20' },
  running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
} as const

export function BatchProgress({ runId }: BatchProgressProps) {
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    if (!polling) return

    const interval = setInterval(async () => {
      try {
        const status = await api.getDAGRun(runId)
        setRun(status as unknown as PipelineRun)

        if (status.status === 'completed' || status.status === 'failed') {
          setPolling(false)
        }
      } catch (err) {
        console.error('Failed to poll batch status:', err)
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [runId, polling])

  if (!run) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Starting batch...
      </div>
    )
  }

  const results = (run.results as any)?.results as any[] || []
  const total = (run.results as any)?.total || results.length
  const completed = (run.results as any)?.completed || results.filter((r: any) => r.status === 'completed').length
  const failed = (run.results as any)?.failed || results.filter((r: any) => r.status === 'failed').length
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0

  return (
    <div className="space-y-3 p-3">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold">Batch Progress</span>
          <span className="text-[10px] text-muted-foreground">
            {completed + failed} / {total} items
          </span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-emerald-500 border-emerald-500/20">
            ✓ {completed}
          </Badge>
          {failed > 0 && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-destructive border-destructive/20">
              ✕ {failed}
            </Badge>
          )}
          {run.status === 'running' && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-blue-500 border-blue-500/20">
              ⟳ Running
            </Badge>
          )}
        </div>
      </div>

      {/* Item grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-8 gap-1">
          {results.map((item: any, i: number) => {
            const status = item.status || 'pending'
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
            const Icon = cfg.icon

            return (
              <div
                key={i}
                className={`${cfg.bg} rounded-md p-1.5 flex flex-col items-center gap-0.5 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all`}
                title={item.error || `Item ${i + 1}: ${status}`}
              >
                <Icon className={`h-3 w-3 ${cfg.color} ${status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-[8px] text-muted-foreground">#{i + 1}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Overall status */}
      {run.status === 'completed' && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          ✓ Batch completed: {completed} successful, {failed} failed
        </div>
      )}
    </div>
  )
}
