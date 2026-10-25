/**
 * Entity color system — deterministic color assignment for teams/orgs.
 *
 * Uses the `--entity-0` through `--entity-5` CSS variables defined in tokens.css.
 * Each entity gets a consistent color based on a hash of its ID or name,
 * so the same team always gets the same color across sessions.
 *
 * Usage:
 *   const idx = entityColorIndex(team.id)
 *   className={`bg-entity-${idx}`}  // or use the hsl() helper
 *   style={{ backgroundColor: entityColorHsl(team.id) }}
 */

/** Number of colors in the entity palette */
export const ENTITY_COLOR_COUNT = 6

/**
 * Simple string hash → palette index.
 * Deterministic: same input always returns the same index.
 */
export function entityColorIndex(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % ENTITY_COLOR_COUNT
}

/**
 * Returns a CSS `hsl(var(--entity-N))` string for use in inline styles.
 */
export function entityColorHsl(seed: string, alpha?: number): string {
  const idx = entityColorIndex(seed)
  if (alpha !== undefined) {
    return `hsl(var(--entity-${idx}) / ${alpha})`
  }
  return `hsl(var(--entity-${idx}))`
}

/**
 * Returns the Tailwind-compatible CSS variable reference for a given seed.
 * Useful for className-based styling when you know the index.
 */
export function entityColorVar(seed: string): string {
  const idx = entityColorIndex(seed)
  return `var(--entity-${idx})`
}

/**
 * All available entity color class mappings.
 * Use with inline styles: style={{ color: entityColorHsl(id) }}
 */
export const ENTITY_COLORS = [
  { label: 'Steel Blue',  var: '--entity-0' },
  { label: 'Sage Green',  var: '--entity-1' },
  { label: 'Warm Amber',  var: '--entity-2' },
  { label: 'Soft Purple', var: '--entity-3' },
  { label: 'Dusty Rose',  var: '--entity-4' },
  { label: 'Ocean Teal',  var: '--entity-5' },
] as const
