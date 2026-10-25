import { useState } from 'react'
import { Check, Copy, Download, X } from 'lucide-react'
import { Structure3D } from './Structure3D'

export interface Card {
  version_id: string; model: string; version: number; family: string; scenario_id: string; prompt: string; spec: Record<string, string>
  result: { seq: string; plddt: number; gate: boolean; filter: boolean; reasons: string[]; tm: number | null; hit: boolean | null; evalue: string | null; identity: number | null; pdb: string }
  props: { length: number; charge: number; gravy: number; cys: number }
  checks: { label: string; requested: string; actual: string; ok: boolean }[]
  reference: { acc: string }
  go: string[]; ec: string[]
}

const Row = ({ ok, label, children }: { ok?: boolean | null; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2 py-1 text-xs">
    <span className="mt-0.5 shrink-0">{ok == null ? <span className="inline-block size-3.5" /> : ok ? <Check className="size-3.5 text-emerald-600" /> : <X className="size-3.5 text-red-500" />}</span>
    <span className="w-28 shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 flex-1">{children}</span>
  </div>
)

/** One generated protein: sequence, structure, whether it follows the request, and its features. */
export function ResultCard({ c, compact }: { c: Card; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const r = c.result
  const fasta = `>${c.model.replace(/\s+/g, '_')}_v${c.version}_${c.scenario_id}\n${r.seq.match(/.{1,60}/g)?.join('\n')}\n`
  const copy = async () => { await navigator.clipboard.writeText(r.seq).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([fasta], { type: 'text/plain' })); a.download = `${c.scenario_id}_v${c.version}.fasta`; a.click() }
  const conf = r.plddt >= 90 ? 'very high' : r.plddt >= 70 ? 'high' : r.plddt >= 50 ? 'low' : 'very low'

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{c.model} <span className="font-normal text-muted-foreground">v{c.version}</span></span>
        <span className="text-xs text-muted-foreground">{c.props.length} aa</span>
      </div>
      <div className={compact ? 'grid gap-4' : 'grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]'}>
        <div className="space-y-1.5">
          <Structure3D pdbId={r.pdb} />
          <p className="text-[11px] text-muted-foreground">Predicted structure, coloured by confidence. Drag to rotate.</p>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sequence</span>
              <span className="flex gap-1">
                <button onClick={copy} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? 'Copied' : 'Copy'}</button>
                <button onClick={download} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"><Download className="size-3" />FASTA</button>
              </span></div>
            <code className="block max-h-24 overflow-y-auto break-all rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-relaxed">{r.seq}</code>
          </div>
          <div className="divide-y divide-border/60">
            {c.checks.map((k) => <Row key={k.label} ok={k.ok} label={k.label}>requested {k.requested}, got <b>{k.actual}</b></Row>)}
            <Row ok={r.gate} label="Follows request">{r.gate ? 'Yes' : `No${r.reasons.length ? `: ${r.reasons.join('; ')}` : ''}`}</Row>
            <Row ok={r.filter} label="Quality filters">{r.filter ? 'Passed' : 'Failed'}</Row>
            <Row label="Confidence"><b>{r.plddt.toFixed(1)}</b> / 100 <span className="text-muted-foreground">({conf})</span></Row>
            <Row label="Structure match">{r.tm != null ? <><b>{r.tm.toFixed(2)}</b> TM-score vs natural {c.reference.acc}</> : '–'}</Row>
            <Row ok={r.hit} label="Domain">{c.family} {r.hit == null ? '–' : r.hit ? `detected${r.evalue ? ` (E ${r.evalue})` : ''}` : 'not detected'}</Row>
            <Row label="Closest natural">{c.reference.acc}{r.identity != null ? `, ${r.identity}% identical` : ''}</Row>
            <Row label="Charge, GRAVY"><b>{c.props.charge > 0 ? '+' : ''}{c.props.charge}</b>, {c.props.gravy}, {c.props.cys} cysteines</Row>
            <Row label="GO function">{c.go.length ? c.go.join(', ') : '–'} <span className="text-muted-foreground">(predicted, demo)</span></Row>
            <Row label="EC class">{c.ec.length ? c.ec.join(', ') : 'none annotated'} <span className="text-muted-foreground">(predicted, demo)</span></Row>
          </div>
        </div>
      </div>
    </div>
  )
}

