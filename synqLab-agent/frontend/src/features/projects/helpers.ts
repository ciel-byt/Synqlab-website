/**
 * Project feature — shared helpers.
 */

// ── Re-exports from canonical lib modules ────────────────────────────────────

export { relativeTime } from '@/lib/dates'
export { initials } from '@/lib/initials'

/** Map project status to Badge variant. */
export function statusVariant(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'paused') return 'warning' as const
  return 'secondary' as const
}

