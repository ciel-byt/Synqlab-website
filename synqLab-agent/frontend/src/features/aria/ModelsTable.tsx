import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { postJson } from './api'
import { Delta, fmt } from './Delta'
import { MetricPicker } from './MetricPicker'
import { matches, parseQuery } from './query'
import { SelectBox } from './SelectBox'
import { StatusChip } from './StatusChip'
import type { Runs, VersionRow } from './types'

const th = 'whitespace-nowrap bg-primary px-3 py-2.5 text-left text-xs font-semibold text-primary-foreground'
const td = 'whitespace-nowrap px-3 py-1.5 text-[13px]'

export function ModelsTable({ rows, runs, selectedId, onOpen, onCompare, onNew, onChanged }: {
  rows: VersionRow[]; runs: Runs; selectedId: string | null; onOpen: (r: VersionRow) => void; onCompare: (a: VersionRow, b: VersionRow) => void; onNew: () => void; onChanged: () => void
}) {
  const [q, setQ] = useState('')
  const [data, setData] = useState('')
  const [status, setStatus] = useState('')
  const [used, setUsed] = useState('')
  // the table opens with the tuning metrics; the paper's base-model metrics can be added from the picker
  const [shown, setShown] = useState<Set<string>>(() => new Set(runs.metrics.filter((m) => m.group === 'Family tuning').map((m) => m.key)))
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'created', dir: -1 })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const allBox = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseQuery(q), [q])
  const visible = useMemo(() => {
    const f = rows.filter((r) => matches(r, parsed) && (!data || r.data_source === data) && (!status || r.status === status) && (!used || (r.usage ?? 'none') === used))
    const val = (r: VersionRow): number | string => {
      if (sort.key === 'created') return r.created_at ?? ''
      if (sort.key === 'model') return r.model.toLowerCase()
      if (sort.key === 'version') return r.version
      return r.metrics?.[sort.key] ?? Number.NEGATIVE_INFINITY
    }
    return [...f].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir)
  }, [rows, parsed, data, status, used, sort])

  // drop selections that no longer exist (after a delete or a filter change)
  useEffect(() => { setPicked((p) => new Set([...p].filter((id) => rows.some((r) => r.id === id)))) }, [rows])
  const nPicked = visible.filter((r) => picked.has(r.id)).length
  const allPicked = visible.length > 0 && nPicked === visible.length
  useEffect(() => { if (allBox.current) allBox.current.indeterminate = nPicked > 0 && !allPicked }, [nPicked, allPicked])
  useEffect(() => { if (!picked.size) setConfirm(false) }, [picked])

  const cols = runs.metrics.filter((m) => shown.has(m.key))
  const best = (key: string) => Math.max(...visible.map((r) => r.metrics?.[key] ?? Number.NEGATIVE_INFINITY))
  const sel = rows.filter((r) => picked.has(r.id))
  const canCompare = sel.length === 2 && sel.every((r) => r.status === 'ready')

  const toggle = (id: string) => setPicked((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setPicked((p) => { const s = new Set(p); allPicked ? visible.forEach((r) => s.delete(r.id)) : visible.forEach((r) => s.add(r.id)); return s })
  const sortBtn = (key: string, label: string) => (
    <button className="inline-flex items-center gap-1" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}>
      {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  )
  const setUse = async (r: VersionRow, usage: string) => {
    await postJson(`/api/aria/versions/${r.id}/use`, { usage: usage || null }).catch(() => {})
    onChanged()
  }
  const remove = async () => {
    setDeleting(true)
    try { await postJson('/api/aria/versions/delete', { ids: [...picked] }); setPicked(new Set()); setConfirm(false); onChanged() } finally { setDeleting(false) }
  }

  if (rows.length === 0) {
    return (
      <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-border p-10 text-center">
        <h3 className="font-serif text-xl font-medium">No models yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Design your first Aria model from our protein data or from a table of your own. Every version shows up here with its performance.</p>
        <Button className="mt-4" onClick={onNew}>New model</Button>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Query models" placeholder="Search or query, e.g.  family:PF00467 recovery>50"
          className="h-8 w-[360px] rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        <SelectBox value={data} onChange={(e) => setData(e.target.value)} aria-label="Data source"><option value="">All data</option><option value="our-data">Our data</option><option value="upload">Your data</option></SelectBox>
        <SelectBox value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option><option value="ready">Ready</option><option value="queued">Queued</option></SelectBox>
        <SelectBox value={used} onChange={(e) => setUsed(e.target.value)} aria-label="Used in"><option value="">Used anywhere</option><option value="standalone">Standalone</option><option value="agent">SynqLab agent</option><option value="none">Not used</option></SelectBox>
        <MetricPicker metrics={runs.metrics} selected={shown} onChange={setShown} />
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{picked.size} selected</span>
          <button className="text-primary underline" onClick={() => setPicked(new Set())}>Clear</button>
          <span className="flex-1" />
          <Button size="sm" variant="outline" disabled={!canCompare} onClick={() => canCompare && onCompare(sel[0], sel[1])} title={canCompare ? '' : 'Select two ready versions to compare'}>Compare</Button>
          {!confirm ? (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 className="mr-1.5 size-3.5" />Delete</Button>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="text-destructive">Delete {picked.size} version{picked.size > 1 ? 's' : ''}? This cannot be undone.</span>
              <Button size="sm" variant="destructive" disabled={deleting} onClick={remove}>{deleting ? 'Deleting…' : 'Yes, delete'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            </span>
          )}
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className={cn(th, 'sticky left-0 z-10')}>
                <span className="inline-flex items-center gap-2">
                  <input ref={allBox} type="checkbox" aria-label="Select all" checked={allPicked} onChange={toggleAll} />
                  {sortBtn('model', 'Model')}
                </span>
              </th>
              <th className={th}>{sortBtn('version', 'Version')}</th>
              <th className={th}>Data</th>
              <th className={th}>Used in</th>
              {cols.map((m) => <th key={m.key} title={`${m.group}: ${m.help}`} className={th}>{sortBtn(m.key, m.label)}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={cols.length + 4} className="px-3 py-8 text-center text-sm text-muted-foreground">No models match this query.</td></tr>}
            {visible.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className={cn('group cursor-pointer border-b border-border last:border-0 hover:bg-muted/40', selectedId === r.id && 'bg-primary/5', picked.has(r.id) && 'bg-primary/10')}>
                <td className={cn(td, 'sticky left-0 z-10 bg-card font-medium group-hover:bg-muted', picked.has(r.id) && 'bg-primary/10')}>
                  <span className="inline-flex items-center gap-2">
                    <input type="checkbox" aria-label={`Select ${r.model} v${r.version}`} checked={picked.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
                    {r.model}
                  </span>
                </td>
                <td className={td}>v{r.version}<span className="ml-1 text-xs text-muted-foreground">{r.rounds}r</span><StatusChip kind={r.status === 'queued' ? 'queued' : 'done'} className="ml-2" /></td>
                <td className={cn(td, 'text-xs text-muted-foreground')}>{r.data_source === 'our-data' ? `Our data · ${runs.families[r.family ?? '']?.short ?? r.family}` : `Your data · ${r.upload?.filename ?? ''}`}</td>
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  <SelectBox compact className="w-28" value={r.usage ?? ''} disabled={r.status !== 'ready'} aria-label={`Use ${r.model} v${r.version} in`} onChange={(e) => setUse(r, e.target.value)}>
                    <option value="">Not used</option><option value="standalone">Standalone</option><option value="agent">SynqLab agent</option>
                  </SelectBox>
                </td>
                {cols.map((m) => {
                  const v = r.metrics?.[m.key]
                  return (
                    <td key={m.key} className={td}>
                      {v == null ? <span className="text-muted-foreground">–</span> : (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className={cn('tabular-nums', v === best(m.key) && visible.length > 1 && 'font-semibold')}>{fmt(v, m)}</span>
                          <Delta value={v} base={r.base?.[m.key]} m={m} />
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
