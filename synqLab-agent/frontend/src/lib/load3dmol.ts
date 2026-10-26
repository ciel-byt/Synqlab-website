/** Load the bundled 3Dmol library (no CDN) and expose it as window.$3Dmol for the viewers. */
export async function load3Dmol(): Promise<void> {
  const w = window as unknown as { $3Dmol?: unknown }
  if (w.$3Dmol) return
  const m = (await import('3dmol')) as unknown as { default?: unknown }
  w.$3Dmol = m.default ?? m
}
