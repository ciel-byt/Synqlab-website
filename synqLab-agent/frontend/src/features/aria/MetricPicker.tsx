import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { MetricDef } from './types'

/** Choose which metric columns the table shows. Every metric reported in the Aria paper is listed. */
export function MetricPicker({ metrics, selected, onChange }: { metrics: MetricDef[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const groups = Array.from(new Set(metrics.map((m) => m.group)))
  const toggle = (k: string) => { const s = new Set(selected); s.has(k) ? s.delete(k) : s.add(k); onChange(s) }
  const setGroup = (g: string, on: boolean) => { const s = new Set(selected); metrics.filter((m) => m.group === g).forEach((m) => (on ? s.add(m.key) : s.delete(m.key))); onChange(s) }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex h-8 items-center gap-2 rounded-full border border-input bg-background pl-3 pr-2.5 text-xs font-medium hover:bg-muted/50">
          Metrics ({selected.size}/{metrics.length}) <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto p-3">
        <div className="mb-2 flex gap-3 text-xs">
          <button className="text-primary underline" onClick={() => onChange(new Set(metrics.map((m) => m.key)))}>Select all</button>
          <button className="text-primary underline" onClick={() => onChange(new Set())}>Clear</button>
        </div>
        {groups.map((g) => {
          const ms = metrics.filter((m) => m.group === g)
          const all = ms.every((m) => selected.has(m.key))
          return (
            <div key={g} className="mb-3">
              <label className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <input type="checkbox" checked={all} onChange={() => setGroup(g, !all)} />{g}
              </label>
              {ms.map((m) => (
                <label key={m.key} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50" title={m.help}>
                  <input type="checkbox" className="mt-1" checked={selected.has(m.key)} onChange={() => toggle(m.key)} />
                  <span>{m.label} <span className="text-xs text-muted-foreground">{m.unit}</span></span>
                </label>
              ))}
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
