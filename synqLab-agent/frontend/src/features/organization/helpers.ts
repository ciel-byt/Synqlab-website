/**
 * Organization feature — shared helpers.
 *
 * Extracted from OrganizationPage.tsx to remove duplication with lib/
 * and to make helpers importable by sub-components.
 */

// ── Re-exports from canonical lib modules ────────────────────────────────────

export { initials } from '@/lib/initials'
export { formatDate, formatRelativeFuture, formatJoined } from '@/lib/dates'

// ── Hashing ──────────────────────────────────────────────────────────────────

export function hash(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

// ── Curated duotone gradients (avatars / icons) ──────────────────────────────

const GRADIENTS: Array<[string, string]> = [
  ['#10b981', '#0ea5e9'],
  ['#6366f1', '#ec4899'],
  ['#f59e0b', '#ef4444'],
  ['#0ea5e9', '#8b5cf6'],
  ['#14b8a6', '#84cc16'],
  ['#f43f5e', '#a855f7'],
  ['#8b5cf6', '#06b6d4'],
  ['#eab308', '#10b981'],
]

export function seedGradient(seed: string): [string, string] {
  return GRADIENTS[hash(seed || 'x') % GRADIENTS.length]
}


// ── Role badge ───────────────────────────────────────────────────────────────

export function roleBadgeClass(role: string): string {
  if (role === 'owner') return 'bg-status-warn-bg text-amber-800 ring-amber-200/70'
  if (role === 'admin') return 'bg-status-info-bg text-indigo-800 ring-indigo-200/70'
  if (role === 'guest') return 'bg-muted text-foreground ring-border'
  return 'bg-status-ok-bg text-emerald-800 ring-emerald-200/70'
}

// ── Slug ─────────────────────────────────────────────────────────────────────

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || `org-${Math.random().toString(36).slice(2, 8)}`
  )
}
