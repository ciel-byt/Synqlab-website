import type { VersionRow } from './types'

// Tiny query language for the models table.
//   free words        match model name, family, data, problem
//   family:PF00237    model:uL22   data:our|upload   status:ready|queued   used:standalone|agent|none
//   any metric key with a number:  recovery>30   tm>=0.3   confidence>55   len10>80   tmmcc>0.8   (metric value)
//   gain.recovery>10                                                   (change vs the Aria base)
export interface Cond { field: string; op: string; value: string }
export interface Parsed { words: string[]; conds: Cond[] }

const TEXT_FIELDS = ['family', 'model', 'data', 'status', 'used']

export function parseQuery(q: string): Parsed {
  const words: string[] = []
  const conds: Cond[] = []
  for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^((?:gain\.)?[a-z]+)(>=|<=|>|<|=|:)(.+)$/i)
    if (m) conds.push({ field: m[1].toLowerCase(), op: m[2], value: m[3].toLowerCase() })
    else words.push(tok.toLowerCase())
  }
  return { words, conds }
}

const cmp = (a: number, op: string, b: number) =>
  op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : op === '<=' ? a <= b : a === b

export function matches(r: VersionRow, p: Parsed): boolean {
  const hay = [r.model, r.family ?? '', r.data_source === 'our-data' ? 'our data' : 'your data', r.problem ?? '', r.upload?.filename ?? ''].join(' ').toLowerCase()
  if (!p.words.every((w) => hay.includes(w))) return false
  for (const c of p.conds) {
    const gain = c.field.startsWith('gain.')
    const key = gain ? c.field.slice(5) : c.field
    if (!TEXT_FIELDS.includes(c.field)) {
      const v = r.metrics?.[key]
      const b = r.base?.[key]
      const val = gain ? (v != null && b != null ? v - b : undefined) : v
      const n = parseFloat(c.value)
      if (val == null || Number.isNaN(n) || !cmp(val, c.op === ':' ? '=' : c.op, n)) return false
    } else if (c.field === 'family') { if (!(r.family ?? '').toLowerCase().includes(c.value)) return false }
    else if (c.field === 'model') { if (!r.model.toLowerCase().includes(c.value)) return false }
    else if (c.field === 'data') { if (!(c.value.startsWith('our') ? r.data_source === 'our-data' : r.data_source === 'upload')) return false }
    else if (c.field === 'status') { if (r.status !== c.value) return false }
    else if (c.field === 'used') { if ((r.usage ?? 'none') !== c.value) return false }
  }
  return true
}
