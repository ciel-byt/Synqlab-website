import { cn } from '@/lib/utils'
import type { FamilyStats, LenStats, UploadStats } from './types'

function Hist({ hist, className }: { hist: number[]; className?: string }) {
  const max = Math.max(...hist, 1)
  return (
    <div className={cn('flex h-12 items-end gap-0.5', className)} aria-hidden="true">
      {hist.map((h, i) => <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(4, (h / max) * 100)}%` }} />)}
    </div>
  )
}

function Bars({ rows, empty }: { rows: [string, number][]; empty?: string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty ?? 'None annotated.'}</p>
  return (
    <ul className="space-y-1">
      {rows.map(([name, pct]) => (
        <li key={name} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-xs">
          <span className="truncate" title={name}>{name}</span><span className="tabular-nums text-muted-foreground">{pct}%</span>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-border"><span className="block h-full bg-primary/70" style={{ width: `${Math.min(100, pct)}%` }} /></span>
        </li>
      ))}
    </ul>
  )
}

const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-border bg-card p-3', className)}>
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
    {children}
  </div>
)
const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div><div className="text-lg font-medium leading-tight tabular-nums">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
)
const LenCard = ({ len }: { len: LenStats }) => (
  <Card title="Length (amino acids)">
    <Hist hist={len.hist} />
    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{len.min}</span><span>median {len.p50}</span><span>{len.max}</span></div>
  </Card>
)

/** Summary of the chosen family (real figures from our protein collection). */
export function FamilyStatsView({ s }: { s: FamilyStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card title="Proteins">
        <div className="grid grid-cols-2 gap-3"><Stat label="in this family" value={s.n.toLocaleString()} /><Stat label="species" value={s.n_species.toLocaleString()} /></div>
      </Card>
      <LenCard len={s.len} />
      <Card title="Properties (median)">
        <div className="grid grid-cols-3 gap-2"><Stat label="net charge" value={s.props.charge} /><Stat label="GRAVY" value={s.props.gravy} /><Stat label="cysteines" value={s.props.cys} /></div>
        <div className="mt-2 grid grid-cols-3 gap-2"><Stat label="membrane" value={`${s.props.tm}%`} /><Stat label="signal" value={`${s.props.signal}%`} /><Stat label="confidence" value={s.props.plddt ?? '–'} /></div>
      </Card>
      <Card title="Top species"><Bars rows={s.species} /></Card>
      <Card title={`GO function (${s.go.annotated}% annotated)`}><Bars rows={s.go.top} /></Card>
      <Card title={`EC class (${s.ec.annotated}% annotated)`}><Bars rows={s.ec.top} empty="No enzyme classes annotated." /></Card>
    </div>
  )
}

/** Summary of an uploaded table. */
export function UploadStatsView({ s }: { s: UploadStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card title="Table">
        <div className="grid grid-cols-3 gap-2"><Stat label="rows" value={s.rows.toLocaleString()} /><Stat label="valid sequences" value={s.valid.toLocaleString()} /><Stat label="invalid" value={s.invalid} /></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><Stat label="missing" value={s.missing} /><Stat label="duplicates" value={s.duplicates} /></div>
      </Card>
      {s.len && <LenCard len={s.len} />}
      {s.aa && (
        <Card title="Amino-acid mix">
          <div className="grid grid-cols-5 gap-x-2 gap-y-1 text-xs tabular-nums">{s.aa.map(([a, p]) => <span key={a}><b>{a}</b> <span className="text-muted-foreground">{p}%</span></span>)}</div>
        </Card>
      )}
      {s.label && (
        <Card title={`Measurement: ${s.label.name}`}>
          <Hist hist={s.label.hist} />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{s.label.min.toFixed(2)}</span><span>median {s.label.p50.toFixed(2)}</span><span>{s.label.max.toFixed(2)}</span></div>
        </Card>
      )}
    </div>
  )
}
