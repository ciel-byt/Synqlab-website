/**
 * People feature — shared helpers.
 */
import { useEffect, useState } from 'react'

// ── Re-exports from canonical lib modules ────────────────────────────────────

export { initials } from '@/lib/initials'

// ── FNV-1a hash ──────────────────────────────────────────────────────────────

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0)
}

// ── Team color — golden-angle distribution ───────────────────────────────────

export function teamColor(i: number): string {
  const hue = (i * 137.508) % 360
  return `hsl(${Math.round(hue)}, 62%, 52%)`
}

// ── Clamp ────────────────────────────────────────────────────────────────────

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

// ── Debounce hook ────────────────────────────────────────────────────────────

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 50
export const ALL_ORGS_ID = '__all__'
export const TEAM_MEMBERSHIP_LOOKUP_CAP = 120
