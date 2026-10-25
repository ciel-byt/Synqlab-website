export interface MetricDef { key: string; label: string; unit: string; dec: number; help: string; group: string }
export interface FamilyRun {
  short: string
  name: string
  held_out: number
  max_rounds: number
  seeds: number
  rounds: Record<string, Record<string, number>>
}
export interface ControlRef { name: string; note: string; values: Record<string, number> }
export interface Runs { metrics: MetricDef[]; families: Record<string, FamilyRun>; control: { general: ControlRef; aria: ControlRef }; source: string }
export type Family = [string, string, number, number, number] // pfam, description, n, x, y
export interface FamilyData { families: Family[]; tuned: string[] }

export interface VersionRow {
  id: string
  model_id: string
  model: string
  version: number
  rounds: number
  data_source: 'our-data' | 'upload'
  family: string | null
  problem: string | null
  upload: { filename: string; rows: number; seq_col: string | null; label_col: string | null } | null
  status: 'ready' | 'queued'
  metrics: Record<string, number> | null
  base: Record<string, number> | null
  usage: null | 'standalone' | 'agent'
  simulated: boolean
  created_at: string
}

export interface LenStats { min: number; p50: number; max: number; hist: number[] }
export interface FamilyStats {
  n: number
  len: LenStats
  species: [string, number][]
  n_species: number
  ec: { annotated: number; top: [string, number][] }
  go: { annotated: number; top: [string, number][] }
  props: { charge: number; gravy: number; cys: number; tm: number; signal: number; plddt: number | null }
}
export interface UploadStats {
  rows: number; sequences: number; valid: number; invalid: number; missing: number; duplicates: number
  len?: LenStats
  aa?: [string, number][]
  props?: { cys: number }
  label?: { name: string; n: number; min: number; p50: number; max: number; hist: number[] }
}
