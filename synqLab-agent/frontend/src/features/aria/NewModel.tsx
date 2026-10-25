import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RequestForm } from '@/features/requests/RequestForm'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { getJson, postJson } from './api'
import { FamilyMap } from './FamilyMap'
import { SelectBox } from './SelectBox'
import { StatusChip } from './StatusChip'
import { FamilyStatsView, UploadStatsView } from './DataStats'
import { TrainingFlow } from './TrainingFlow'
import type { FamilyData, FamilyStats, Runs, UploadStats, VersionRow } from './types'

interface UploadInfo { upload_id: string; filename: string; rows: number; columns: string[]; preview: string[][] }
const input = 'w-full rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
const label = 'block space-y-1.5 text-sm font-medium'

/** One-page configuration for a new Aria model (or a new version of an existing one). */
export function NewModel({ runs, continueFrom, haveRounds, modelRows, onDone }: { runs: Runs; continueFrom: VersionRow | null; haveRounds: number; modelRows: VersionRow[]; onDone: () => void }) {
  const cont = continueFrom
  const [source, setSource] = useState<'our-data' | 'upload'>('our-data')
  const [fam, setFam] = useState(cont?.family ?? 'PF00467')
  const [q, setQ] = useState('')
  const [famData, setFamData] = useState<FamilyData | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [up, setUp] = useState<UploadInfo | null>(null)
  const [upErr, setUpErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [seqCol, setSeqCol] = useState('')
  const [labelCol, setLabelCol] = useState('')
  const [name, setName] = useState(cont?.model ?? '')
  const [problem, setProblem] = useState('')
  const [rounds, setRounds] = useState(cont ? 1 : 3)
  const clampRounds = (n: number) => Math.min(20, Math.max(1, Math.round(n) || 1))
  const [phase, setPhase] = useState<'idle' | 'saving' | 'running' | 'done' | 'queued' | 'error'>('idle')
  const [series, setSeries] = useState<Record<number, Record<string, number>>>({})
  const [fStats, setFStats] = useState<FamilyStats | null>(null)
  const [uStats, setUStats] = useState<UploadStats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const result = useRef<HTMLDivElement>(null)

  const effSource = cont ? 'our-data' : source
  useEffect(() => { getJson<FamilyData>('/api/aria/families').then(setFamData).catch(() => {}) }, [])
  useEffect(() => { if (effSource === 'our-data') { setFStats(null); getJson<FamilyStats>(`/api/aria/stats/${fam}`).then(setFStats).catch(() => {}) } }, [fam, effSource]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (effSource !== 'upload' || !up || !seqCol) { setUStats(null); return }
    getJson<UploadStats>(`/api/aria/uploads/${up.upload_id}/stats?seq=${encodeURIComponent(seqCol)}${labelCol ? `&label=${encodeURIComponent(labelCol)}` : ''}`).then(setUStats).catch(() => setUStats(null))
  }, [up, seqCol, labelCol, effSource])
  const tuned = useMemo(() => new Set(famData?.tuned ?? []), [famData])
  const shortNames = useMemo(() => Object.fromEntries(Object.entries(runs.families).map(([k, v]) => [k, v.short])), [runs])
  const fams = famData?.families ?? []
  const f = fams.find((x) => x[0] === fam)
  const run = runs.families[fam]
  const startAt = cont ? haveRounds : 0
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? fams.filter((x) => x[0].toLowerCase().includes(s) || x[1].toLowerCase().includes(s)).slice(0, 7) : []
  }, [q, fams])
  const busy = phase === 'saving' || phase === 'running'

  // a new model starts at all the recorded rounds for the family; the number stays editable
  useEffect(() => { if (!cont && run) setRounds(run.max_rounds) }, [fam]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (effSource === 'our-data' && !cont && run && !name) setName(`${run.short} tuner`) }, [fam, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true); setUpErr(null); setUp(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await apiFetch('/api/aria/uploads', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Upload failed.')
      const info = d as UploadInfo
      setUp(info)
      setSeqCol(info.columns.find((c) => /seq/i.test(c)) ?? info.columns[0])
      setLabelCol(info.columns.find((c) => /(label|value|activity|score|measure)/i.test(c)) ?? '')
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
    } catch (e) { setUpErr(e instanceof Error ? e.message : 'Upload failed.') } finally { setUploading(false) }
  }

  const ready = !!name.trim() && (effSource === 'upload' ? !!up && !!seqCol : !!run)

  const train = async () => {
    setPhase('saving'); setErr(null)
    try {
      const created = await postJson<VersionRow[]>('/api/aria/models', {
        name: name.trim(), data_source: effSource, family: effSource === 'our-data' ? fam : null, problem: problem || null,
        rounds: effSource === 'upload' ? 1 : rounds, model_id: cont?.model_id ?? null,
        upload_id: effSource === 'upload' ? up?.upload_id : null, seq_col: seqCol || null, label_col: labelCol || null,
      })
      if (effSource === 'our-data' && run) {
        const known: Record<number, Record<string, number>> = { 0: run.rounds['0'] }
        for (const r of modelRows) if (r.metrics) known[r.version] = r.metrics
        for (const v of created) if (v.metrics) known[v.version] = v.metrics
        setSeries(known)
      }
      setPhase(effSource === 'upload' ? 'queued' : 'running')
      setTimeout(() => result.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the model.'); setPhase('error') }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <section className={cn('space-y-5 self-start rounded-2xl border border-border bg-card p-5', busy && 'pointer-events-none opacity-70')}>
          {cont && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">New version of <b className="text-foreground">{cont.model}</b>, now at v{haveRounds}.</p>}

          {!cont && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Data</div>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="group" aria-label="Data source">
                {([['our-data', 'Our data'], ['upload', 'Your data']] as const).map(([k, t]) => (
                  <button key={k} onClick={() => setSource(k)} aria-pressed={source === k}
                    className={cn('rounded-full px-3 py-1.5 text-sm font-medium transition-colors', source === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {effSource === 'our-data' && !cont && (
            <div className="space-y-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search families" placeholder="Search a protein family or name" className={input} />
              {matches.length > 0 && (
                <ul className="rounded-md border border-border bg-card p-1">
                  {matches.map((m) => (
                    <li key={m[0]}><button onClick={() => { setFam(m[0]); setQ(''); setShowRequest(false) }} className="grid w-full gap-0.5 rounded px-2.5 py-2 text-left text-sm hover:bg-muted"><span><b>{m[0]}</b> {m[1]}</span><small className="text-muted-foreground">{m[2].toLocaleString()} known proteins</small></button></li>
                  ))}
                </ul>
              )}
              {f && (
                <div className="space-y-1.5 rounded-xl border border-border p-3">
                  <span className="font-mono text-xs text-muted-foreground">{f[0]}</span>
                  <div className="font-serif text-base font-medium leading-snug">{f[1]}</div>
                  <p className="text-xs text-muted-foreground">{f[2].toLocaleString()} known proteins</p>
                  {tuned.has(fam)
                    ? <p className="text-sm font-medium text-primary">Aria can be tuned on this family.</p>
                    : <p className="text-sm text-muted-foreground">Not tuned yet. Tuning is specific to each family, so this one needs its own run. <button className="text-primary underline" onClick={() => setShowRequest(true)}>Request it</button></p>}
                </div>
              )}
              {showRequest && <div className="rounded-xl border border-border p-3"><RequestForm family={fam} famName={f?.[1]} /></div>}
            </div>
          )}
          {cont && f && <div className="rounded-xl border border-border p-3 text-sm"><span className="font-mono text-xs text-muted-foreground">{f[0]}</span><div className="font-serif text-base font-medium">{f[1]}</div></div>}

          {effSource === 'upload' && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="size-5" /><span>{uploading ? 'Uploading…' : up ? `${up.filename} · ${up.rows.toLocaleString()} rows` : 'Choose a .csv, .tsv or .xlsx (up to 5 MB)'}</span>
                <input type="file" accept=".csv,.tsv,.xlsx" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              {upErr && <p role="alert" className="text-sm text-destructive">{upErr}</p>}
              {up && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className={label}>Sequence column<SelectBox className="flex w-full" value={seqCol} onChange={(e) => setSeqCol(e.target.value)}>{up.columns.map((c) => <option key={c}>{c}</option>)}</SelectBox></label>
                  <label className={label}>Measurement column <span className="font-normal text-muted-foreground">(optional)</span><SelectBox className="flex w-full" value={labelCol} onChange={(e) => setLabelCol(e.target.value)}><option value="">None</option>{up.columns.map((c) => <option key={c}>{c}</option>)}</SelectBox></label>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-4">
            <label className={label}>Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} disabled={!!cont} /></label>
            <label className={label}>What do you want to improve? <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea className={cn(input, 'min-h-16 rounded-2xl')} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="For example: more stable variants of this family." /></label>
            {effSource === 'our-data' ? (
              <div className={label}>
                <span>{cont ? 'Rounds to add' : 'Rounds of tuning'}</span>
                <input type="number" min={1} max={20} value={rounds} aria-label="Rounds of tuning" onChange={(e) => setRounds(clampRounds(+e.target.value))} className="block h-8 w-24 rounded-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                <span className="block text-xs font-normal text-muted-foreground">Each round is saved as its own version.</span>
              </div>
            ) : (
              <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">A real tuning run on your table needs a GPU job. We save your table and queue the run. It shows as Queued, and nothing is simulated.</p>
            )}
          </div>

          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" onClick={train} disabled={!ready || busy || phase === 'done' || phase === 'queued'}>
            {phase === 'saving' ? 'Saving…' : phase === 'running' ? 'Training…' : effSource === 'upload' ? 'Queue the run' : 'Train'}
          </Button>
        </section>

        <section className="min-w-0 space-y-3">
          {effSource === 'our-data' ? (
            <>
              <FamilyMap fams={fams} tuned={tuned} shortNames={shortNames} selected={fam} onPick={(id) => { if (!cont && !busy) { setFam(id); setQ(''); setShowRequest(false) } }} />
              <p className="text-xs text-muted-foreground">Each dot is one protein family, placed by similarity. Large dots: families Aria was tuned on.</p>
              {fStats && <FamilyStatsView s={fStats} />}
            </>
          ) : up ? (
            <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-xs"><thead><tr className="bg-primary text-primary-foreground">{up.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{c}</th>)}</tr></thead>
                <tbody>{up.preview.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="max-w-[260px] truncate px-3 py-1.5 font-mono">{c}</td>)}</tr>)}</tbody></table>
            </div>
            {uStats && <UploadStatsView s={uStats} />}
            </div>
          ) : (
            <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">Your table preview appears here.</div>
          )}
        </section>
      </div>

      {(phase === 'running' || phase === 'done' || phase === 'queued') && (
        <div ref={result} className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <h3 className="flex items-center gap-2 font-serif text-xl font-medium">{effSource === 'upload' ? 'Run queued' : `Training ${name}`}<StatusChip kind={effSource === 'upload' ? 'queued' : phase === 'done' ? 'done' : 'progress'} className="align-middle" /></h3>
          {effSource === 'upload' ? (
            <p className="max-w-xl text-sm text-muted-foreground">Your table is saved and the run is queued. We will run it on a GPU and the results will appear in your models list. Nothing here is simulated on your data.</p>
          ) : run && (
            <TrainingFlow data={series} from={startAt} to={startAt + rounds} metrics={runs.metrics} onDone={() => setPhase('done')} />
          )}
          {(phase === 'done' || phase === 'queued') && <Button onClick={onDone}>View in Models</Button>}
        </div>
      )}
    </div>
  )
}
