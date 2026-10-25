/**
 * Build display initials from a person/org name.
 *
 * Examples:
 *   initials('Ada Lovelace')        → 'AL'
 *   initials('cinder block')        → 'CB'
 *   initials('madonna')             → 'M'
 *   initials('', { fallback: 'U' }) → 'U'
 */
export function initials(
  name: string | null | undefined,
  options: { max?: number; fallback?: string } = {},
): string {
  const { max = 2, fallback = '' } = options
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, max)
  const out = parts
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
  return out || fallback
}
