/**
 * Shared date/time formatting helpers.
 *
 * Consolidated from features/chat/helpers.ts, features/projects/helpers.ts,
 * and features/organization/helpers.ts to eliminate duplication.
 */

/** Human-readable relative time from an ISO string (past). */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Friendly absolute date, e.g. "Apr 28, 2026". */
export function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Relative future, e.g. "in 3 days" — used for invite expiry. */
export function formatRelativeFuture(iso: string): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'expired'
  const d = Math.round(ms / 86_400_000)
  if (d === 1) return 'in 1 day'
  if (d < 30) return `in ${d} days`
  const mo = Math.round(d / 30)
  return `in ${mo} mo`
}

/** Relative past shorthand, e.g. "3d ago", "2w ago", "1y ago". */
export function formatJoined(iso: string): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  const d = Math.floor(ms / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}
