import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusChip } from './StatusChip'
import { postJson } from './api'
import { Delta, fmt } from './Delta'
import type { Runs, VersionRow } from './types'

function Trend({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null
  const lo = Math.min(...values), hi = Math.max(...values), s = hi - lo || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${22 - ((v - lo) / s) * 18}`).join(' ')
  return (
    <svg viewBox="0 0 100 24" className="h-6 w-20" aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" className={up ? 'stroke-emerald-500' : 'stroke-red-500'} />
    </svg>
  )
}

const Shell = ({ title, sub, onClose, children }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) => (
  <aside className="w-full shrink-0 self-start rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:w-[380px]">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h3 className="font-serif text-xl font-medium leading-tight">{title}</h3>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</div>
      <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
    </div>
    {children}
  </aside>
)

/** Details of one model version, shown beside the table (no overlay). */
export function VersionPanel({ row, rows, runs, onClose, onChanged, onNewVersion, onChat }: {
  row: VersionRow; rows: VersionRow[]; runs: Runs; onClose: () => void; onChanged: () => void; onNewVersion: (r: VersionRow) => void; onChat: (r: VersionRow) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fam = row.family ? runs.families[row.family] : undefined
  const canMore = row.data_source === 'our-data' && !!fam

  const use = async (usage: 'standalone' | 'agent' | null) => {
    setBusy(true); setErr(null)
    try { await postJson(`/api/aria/versions/${row.id}/use`, { usage }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Failed.') } finally { setBusy(false) }
  }

  return (
    <Shell
      onClose={onClose}
      title={<>{row.model} <span className="text-muted-foreground">v{row.version}</span> <StatusChip kind={row.status === 'queued' ? 'queued' : 'done'} className="align-middle" /></>}
      sub={<>{row.data_source === 'our-data' ? `Our data: ${row.family}${fam ? `, ${fam.name}` : ''}` : `Your data: ${row.upload?.filename ?? 'upload'} (${row.upload?.rows ?? 0} rows)`} · {row.rounds} round{row.rounds > 1 ? 's' : ''}</>}
    >
      {row.status === 'queued' ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <StatusChip kind="queued" />
          <p className="mt-2">Your table is saved. A real tuning run needs a GPU job, so we will run this one for you and the results will appear here. Nothing is simulated on your data.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {runs.metrics.filter((m) => row.metrics?.[m.key] != null).map((m) => {
            const sib = rows.filter((r) => r.model_id === row.model_id && r.version <= row.version && r.metrics?.[m.key] != null).sort((a, b) => a.version - b.version)
            const series = [...(row.base?.[m.key] != null ? [row.base[m.key]] : []), ...sib.map((r) => r.metrics![m.key])]
            const v = row.metrics![m.key], b = row.base?.[m.key]
            return (
              <div key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5" title={m.help}>
                <div>
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-2"><span className="text-xl font-medium tabular-nums">{fmt(v, m)}</span><span className="text-[11px] text-muted-foreground">{m.unit}</span><Delta value={v} base={b} m={m} /></div>
                </div>
                <Trend values={series} up={b == null || v >= b} />
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={row.usage === 'standalone' ? 'default' : 'outline'} disabled={busy || row.status !== 'ready'} onClick={() => use(row.usage === 'standalone' ? null : 'standalone')}>
            {row.usage === 'standalone' ? 'Standalone ✓' : 'Use standalone'}
          </Button>
          <Button size="sm" variant={row.usage === 'agent' ? 'default' : 'outline'} disabled={busy || row.status !== 'ready'} onClick={() => use(row.usage === 'agent' ? null : 'agent')}>
            {row.usage === 'agent' ? 'In SynqLab agent ✓' : 'Assign to SynqLab agent'}
          </Button>
          {row.status === 'ready' && row.data_source === 'our-data' && ['PF00237', 'PF00467', 'PF03652'].includes(row.family ?? '') && <Button size="sm" variant="secondary" onClick={() => onChat(row)}>Use</Button>}
          {canMore && <Button size="sm" variant="secondary" onClick={() => onNewVersion(row)}>New version</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Assignment is saved now and takes effect once the SynqLab agent is connected to Aria. One version at a time.</p>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Shell>
  )
}

export function ComparePanel({ a, b, runs, onClose }: { a: VersionRow; b: VersionRow; runs: Runs; onClose: () => void }) {
  return (
    <Shell title="Compare versions" onClose={onClose}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Metric</th><th className="pb-2 font-medium">{a.model} v{a.version}</th><th className="pb-2 font-medium">{b.model} v{b.version}</th><th className="pb-2 font-medium">B vs A</th></tr></thead>
        <tbody>
          {runs.metrics.filter((m) => a.metrics?.[m.key] != null || b.metrics?.[m.key] != null).map((m) => (
            <tr key={m.key} className="border-t border-border">
              <td className="py-1.5 pr-2 text-xs">{m.label}</td>
              <td className="tabular-nums">{a.metrics?.[m.key] != null ? fmt(a.metrics[m.key], m) : '–'}</td>
              <td className="tabular-nums">{b.metrics?.[m.key] != null ? fmt(b.metrics[m.key], m) : '–'}</td>
              <td><Delta value={b.metrics?.[m.key]} base={a.metrics?.[m.key]} m={m} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}
