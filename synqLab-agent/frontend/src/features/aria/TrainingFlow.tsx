import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Delta, fmt } from './Delta'
import { StatusChip } from './StatusChip'
import type { MetricDef } from './types'

// Replays a recorded run in a few seconds: generate, check, learn for each round. The chart gains a real recorded
// point per round and the numbers count up. Nothing is computed live.

const STAGES = ['Generate candidates', 'Check them', 'Learn from the results']
const STEP_MS = 650

function CountUp({ to, dec }: { to: number; dec: number }) {
  const [v, setV] = useState(to)
  const prev = useRef(to)
  useEffect(() => {
    const from = prev.current
    const t0 = performance.now()
    let raf = 0
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / 600)
      setV(from + (to - from) * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(step)
      else prev.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v.toFixed(dec)}</>
}

export function TrainingFlow({ data, from, to, metrics, onDone }: { data: Record<number, Record<string, number>>; from: number; to: number; metrics: MetricDef[]; onDone: () => void }) {
  const total = (to - from) * 3
  const [t, setT] = useState(0)
  useEffect(() => {
    if (t >= total) { const id = setTimeout(onDone, 800); return () => clearTimeout(id) }
    const id = setTimeout(() => setT((x) => x + 1), STEP_MS)
    return () => clearTimeout(id)
  }, [t, total, onDone])

  const finished = t >= total
  const shown = from + Math.floor(t / 3) // rounds completed so far
  const current = Math.min(shown + 1, to)
  const stage = finished ? 3 : t % 3
  const keys = metrics.filter((m) => data[0]?.[m.key] != null)
  const primary = keys[0]
  const base = data[0]

  const pts = Array.from({ length: to + 1 }, (_, r) => ({ r, v: data[r]?.[primary.key] }))
  const vals = pts.map((p) => p.v).filter((v): v is number => v != null)
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const W = 460, H = 180, px = 28, py = 18
  const X = (r: number) => px + (r / to) * (W - 2 * px)
  const Y = (v: number) => H - py - ((v - lo) / span) * (H - 2 * py)

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]" role="status" aria-live="polite">
      <ol className="space-y-3">
        {Array.from({ length: to - from }, (_, i) => from + i + 1).map((r) => (
          <li key={r} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">Round {r}<StatusChip kind={r <= shown ? 'done' : r === current && !finished ? 'progress' : 'queued'} /></div>
            {STAGES.map((s, si) => {
              const done = r <= shown || (r === current && stage > si)
              const active = r === current && !finished && stage === si
              return (
                <div key={s} className={cn('flex items-center gap-2 text-xs', done ? 'text-emerald-700 dark:text-emerald-300' : active ? 'font-medium text-sky-700 dark:text-sky-300' : 'text-muted-foreground/70')}>
                  <span className={cn('size-2 rounded-full', done ? 'bg-emerald-500' : active ? 'animate-pulse bg-sky-500' : 'bg-amber-400/70')} />{s}
                </div>
              )
            })}
          </li>
        ))}
        {finished && <li className="flex items-center gap-2 text-sm font-medium"><StatusChip kind="done" /> Version{to - from > 1 ? 's' : ''} saved.</li>}
      </ol>

      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-baseline justify-between"><span className="text-sm font-medium">{primary.label}</span><span className="text-xs text-muted-foreground">Aria base → round {shown}</span></div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${primary.label} by round`}>
            <line x1={px} x2={W - px} y1={Y(base[primary.key])} y2={Y(base[primary.key])} className="stroke-border" strokeDasharray="4 4" />
            <polyline fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round"
              points={pts.filter((p) => p.r <= shown && p.v != null).map((p) => `${X(p.r)},${Y(p.v!)}`).join(' ')} />
            {pts.map((p) => p.v != null && (
              <g key={p.r}>
                {p.r <= shown && <circle cx={X(p.r)} cy={Y(p.v)} r={5} className="fill-primary" />}
                <text x={X(p.r)} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>{p.r === 0 ? 'base' : `r${p.r}`}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {keys.map((m) => {
            const v = data[shown]?.[m.key] ?? base[m.key]
            return (
              <div key={m.key} className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-medium tabular-nums"><CountUp to={v} dec={m.dec} /></span>
                  <Delta value={v} base={base[m.key]} m={m} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { fmt }
