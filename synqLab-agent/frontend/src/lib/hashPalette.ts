/**
 * Stable string → palette helper.
 *
 * Two pages were independently hashing strings to pick a Tailwind color tuple
 * (`ToolsPage.tagColor`, `OrganizationPage.avatarSeedColor`). This is the
 * shared implementation: we use the same FNV-like accumulator and let
 * callers pass their own palette so the existing visual styles survive.
 */
export function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0
  }
  return h
}

/** Deterministically pick an entry from a palette by hashing `seed`. */
export function pickFromPalette<T>(palette: readonly T[], seed: string): T {
  if (palette.length === 0) {
    throw new Error('pickFromPalette: palette must be non-empty')
  }
  return palette[hashString(seed) % palette.length]
}

/**
 * Default tag palette — one Tailwind class string per slot.
 * Matches the `TAG_PALETTES` previously declared in ToolsPage.
 */
export const TAG_PALETTE = [
  'bg-violet-100 text-violet-700 border-violet-300',
  'bg-sky-100 text-sky-700 border-sky-300',
  'bg-status-ok-bg text-status-ok-text border-emerald-300',
  'bg-status-warn-bg text-status-warn-text border-amber-300',
  'bg-rose-100 text-rose-700 border-rose-300',
  'bg-indigo-100 text-status-info-text border-indigo-300',
  'bg-teal-100 text-teal-700 border-teal-300',
  'bg-orange-100 text-orange-700 border-orange-300',
] as const

/**
 * Default avatar palette — split into background + text class so the caller
 * can compose them. Matches the seed → color choices previously declared in
 * OrganizationPage.
 */
export const AVATAR_PALETTE: ReadonlyArray<{ bg: string; text: string }> = [
  { bg: 'bg-status-ok-bg',  text: 'text-emerald-800' },
  { bg: 'bg-indigo-100',    text: 'text-indigo-800' },
  { bg: 'bg-status-warn-bg', text: 'text-amber-800' },
  { bg: 'bg-rose-100',      text: 'text-rose-800' },
  { bg: 'bg-sky-100',       text: 'text-sky-800' },
  { bg: 'bg-violet-100',    text: 'text-violet-800' },
] as const

export function tagColor(tag: string): string {
  return pickFromPalette(TAG_PALETTE, tag)
}

export function avatarSeedColor(seed: string): { bg: string; text: string } {
  return pickFromPalette(AVATAR_PALETTE, seed)
}
