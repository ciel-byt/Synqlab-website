/**
 * Shared role chip palette helpers.
 *
 * Lives in `lib/` (not next to `RoleChip.tsx`) so that callers can import the
 * class string without pulling in the React component, and to satisfy the
 * react-refresh "components-only" lint rule on the component file.
 */
export type Role = 'owner' | 'admin' | 'member' | 'guest' | 'viewer' | (string & {})

export function roleChipClass(role: string | undefined): string {
  const r = (role ?? 'member').toLowerCase()
  if (r === 'owner') return 'bg-status-warn-bg text-amber-800 ring-amber-200'
  if (r === 'admin') return 'bg-status-info-bg text-indigo-800 ring-indigo-200'
  if (r === 'guest') return 'bg-muted/40 text-foreground ring-slate-200'
  if (r === 'viewer') return 'bg-muted/40 text-muted-foreground ring-border'
  return 'bg-status-ok-bg text-emerald-800 ring-emerald-200'
}
