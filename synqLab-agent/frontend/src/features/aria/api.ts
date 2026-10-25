import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { Runs, VersionRow } from './types'

export async function getJson<T>(path: string): Promise<T> {
  const r = await apiFetch(path)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(typeof d.detail === 'string' ? d.detail : 'Request failed.')
  }
  return r.json()
}

let runsCache: Runs | null = null
export function useRuns(): Runs | null {
  const [runs, setRuns] = useState<Runs | null>(runsCache)
  useEffect(() => {
    if (runsCache) return
    getJson<Runs>('/api/aria/runs').then((r) => { runsCache = r; setRuns(r) }).catch(() => {})
  }, [])
  return runs
}

export function useModels() {
  const [rows, setRows] = useState<VersionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = () => getJson<VersionRow[]>('/api/aria/models').then(setRows).catch(() => setError('Could not load your models.'))
  useEffect(() => { reload() }, [])
  return { rows, error, reload }
}
