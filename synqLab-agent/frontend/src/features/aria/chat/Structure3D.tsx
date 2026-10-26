import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { load3Dmol } from '@/lib/load3dmol'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d3 = () => (window as unknown as { $3Dmol?: any }).$3Dmol

// AlphaFold-style confidence colours.
const conf = (b: number) => (b > 90 ? '#0053d6' : b > 70 ? '#65cbf3' : b > 50 ? '#ffdb13' : '#ff7d45')

/** Rotating cartoon of a predicted structure, coloured by confidence. */
export function Structure3D({ pdbId, height = 220 }: { pdbId: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let dead = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null
    ;(async () => {
      setStatus('loading')
      try {
        await load3Dmol()
        const r = await apiFetch(`/api/aria/chat/pdb/${pdbId}`)
        if (!r.ok) throw new Error(String(r.status))
        const text = await r.text()
        if (dead || !ref.current) return
        viewer = d3().createViewer(ref.current, { backgroundColor: 'white' })
        viewer.addModel(text, 'pdb')
        viewer.setStyle({}, { cartoon: { colorfunc: (a: { b: number }) => conf(a.b <= 1 ? a.b * 100 : a.b) } })
        viewer.zoomTo(); viewer.spin('y', 0.6); viewer.render()
        setStatus('ready')
      } catch { if (!dead) setStatus('error') }
    })()
    return () => { dead = true; if (viewer) viewer.clear() }
  }, [pdbId])

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-white" style={{ height }}>
      <div ref={ref} className="absolute inset-0" />
      {status === 'loading' && <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>}
      {status === 'error' && <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground">Structure could not be loaded.</div>}
    </div>
  )
}
