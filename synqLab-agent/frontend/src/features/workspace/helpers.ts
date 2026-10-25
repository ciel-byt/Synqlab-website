/**
 * Workspace feature — shared helpers.
 * Consolidates helpers from org + projects features.
 */
export { initials } from '@/lib/initials'
export {
  formatDate,
  formatJoined,
  formatRelativeFuture,
  relativeTime,
} from '@/lib/dates'

export {
  roleBadgeClass,
  slugify,
} from '@/features/organization/helpers'

export { statusVariant } from '@/features/projects/helpers'

/* ── Density ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react'

export type Density = 'compact' | 'default' | 'comfortable'

const DENSITY_KEY = 'synqlab-ws-density'

export function useDensity() {
  const [density, setDensityState] = useState<Density>(() => {
    if (typeof window === 'undefined') return 'default'
    return (localStorage.getItem(DENSITY_KEY) as Density) ?? 'default'
  })

  const setDensity = useCallback((d: Density) => {
    setDensityState(d)
    localStorage.setItem(DENSITY_KEY, d)
  }, [])

  // Apply data-density attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
  }, [density])

  return { density, setDensity }
}
