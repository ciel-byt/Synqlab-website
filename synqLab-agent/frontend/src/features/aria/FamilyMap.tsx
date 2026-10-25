import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { Family } from './types'

const hsl = (name: string, alpha = 1) =>
  `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()} / ${alpha})`

// Nudge labels of families that sit close together so they do not overlap.
const LABEL_OFFSET: Record<string, [number, number, string]> = { PF00416: [-9, -8, 'right'], PF00237: [9, 15, 'left'] }
const MAX_ZOOM = 40

/** Map of protein families. Scroll to zoom, drag to pan, click a dot to pick a family. */
export function FamilyMap({ fams, tuned, shortNames, selected, onPick }: {
  fams: Family[]; tuned: Set<string>; shortNames: Record<string, string>; selected: string; onPick: (id: string) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const pts = useRef<[number, number, Family][]>([])
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)
  const [size, setSize] = useState({ w: 640, h: 400 })
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const [hover, setHover] = useState<{ x: number; y: number; f: Family } | null>(null)

  const clamp = (k: number, tx: number, ty: number) => ({ k, tx: Math.min(0, Math.max(size.w - size.w * k, tx)), ty: Math.min(0, Math.max(size.h - size.h * k, ty)) })
  const zoomAt = (factor: number, mx: number, my: number) => setView((v) => {
    const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor))
    return clamp(k, mx - (mx - v.tx) * (k / v.k), my - (my - v.ty) * (k / v.k))
  })

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => { const w = el.clientWidth; setSize({ w, h: Math.round(w * 0.64) }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // wheel needs a non-passive listener so the page does not scroll while zooming the map
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = cv.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = size.w * dpr
    c.height = size.h * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, size.w, size.h)
    const pad = 16
    const P = fams.map((f): [number, number, Family] => [
      (pad + f[3] * (size.w - 2 * pad)) * view.k + view.tx,
      (pad + f[4] * (size.h - 2 * pad)) * view.k + view.ty,
      f,
    ])
    pts.current = P
    const r0 = 2 + Math.min(view.k * 0.25, 3)
    g.fillStyle = hsl('--muted-foreground', 0.4)
    for (const [x, y, f] of P) {
      if (tuned.has(f[0]) || x < -5 || y < -5 || x > size.w + 5 || y > size.h + 5) continue
      g.beginPath(); g.arc(x, y, r0, 0, 6.283); g.fill()
    }
    g.font = '12px Inter, sans-serif'
    for (const [x, y, f] of P) {
      if (!tuned.has(f[0])) continue
      g.fillStyle = hsl('--primary'); g.beginPath(); g.arc(x, y, 5.5 + Math.min(view.k * 0.15, 2), 0, 6.283); g.fill()
      const [dx, dy, align] = LABEL_OFFSET[f[0]] ?? [9, 4, 'left']
      g.fillStyle = hsl('--foreground'); g.textAlign = align as CanvasTextAlign
      g.fillText(shortNames[f[0]] ?? f[0], x + dx * (view.k > 3 ? 1.4 : 1), y + dy); g.textAlign = 'left'
    }
    const s = P.find(([, , f]) => f[0] === selected)
    if (s) { g.strokeStyle = hsl('--primary'); g.lineWidth = 2; g.beginPath(); g.arc(s[0], s[1], 10, 0, 6.283); g.stroke() }
    if (hover) { g.strokeStyle = hsl('--foreground'); g.lineWidth = 1.5; g.beginPath(); g.arc(hover.x, hover.y, 7, 0, 6.283); g.stroke() }
  }, [fams, tuned, shortNames, selected, size, view, hover])

  const local = (e: React.MouseEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const nearest = (mx: number, my: number) => {
    let best: { x: number; y: number; f: Family } | null = null, bd = 144
    for (const [x, y, f] of pts.current) { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = { x, y, f } } }
    return best
  }

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-2xl border border-border bg-muted/40">
      <canvas ref={cv} style={{ width: size.w, height: size.h }} className="block cursor-grab active:cursor-grabbing"
        aria-label="Map of protein families. Scroll to zoom, drag to pan, click a dot to pick a family."
        onMouseDown={(e) => { const p = local(e); drag.current = { x: p.x, y: p.y, tx: view.tx, ty: view.ty, moved: false } }}
        onMouseMove={(e) => {
          const p = local(e)
          const d = drag.current
          if (d) {
            if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 4) d.moved = true
            if (d.moved) { setView((v) => clamp(v.k, d.tx + p.x - d.x, d.ty + p.y - d.y)); setHover(null); return }
          }
          setHover(nearest(p.x, p.y))
        }}
        onMouseUp={(e) => { const d = drag.current; drag.current = null; if (d && !d.moved) { const p = local(e); const n = nearest(p.x, p.y); if (n) onPick(n.f[0]) } }}
        onMouseLeave={() => { drag.current = null; setHover(null) }} />
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <button aria-label="Zoom in" className="grid size-7 place-items-center hover:bg-muted" onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)}><Plus className="size-3.5" /></button>
        <button aria-label="Zoom out" className="grid size-7 place-items-center border-t border-border hover:bg-muted" onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)}><Minus className="size-3.5" /></button>
        <button aria-label="Reset zoom" className="grid size-7 place-items-center border-t border-border hover:bg-muted" onClick={() => setView({ k: 1, tx: 0, ty: 0 })}><RotateCcw className="size-3.5" /></button>
      </div>
      {hover && (
        <div className="pointer-events-none absolute max-w-[220px] rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background" style={{ left: Math.min(hover.x + 12, size.w - 230), top: hover.y + 12 }}>
          <b>{hover.f[0]}</b> {hover.f[1]}
        </div>
      )}
    </div>
  )
}
