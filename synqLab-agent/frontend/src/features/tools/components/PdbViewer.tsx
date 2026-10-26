/**
 * PdbViewer — 3Dmol.js protein structure viewer.
 * Loads PDB data from the backend artifact endpoint and renders
 * an interactive 3D cartoon view colored by pLDDT confidence.
 * Extracted from ToolsPage.tsx.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { load3Dmol } from '@/lib/load3dmol'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $3Dmol: any
  }
}

export function PdbViewer({ pdbPath }: { pdbPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null

    async function init() {
      setStatus('loading')
      setErrorMsg('')

      await load3Dmol()

      if (cancelled) return

      // Fetch PDB via backend
      let pdbData: string
      try {
        const res = await apiFetch(`/api/artifact?path=${encodeURIComponent(pdbPath)}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`)
        pdbData = await res.text()
        if (!pdbData.trim().startsWith('ATOM') && !pdbData.includes('ATOM')) {
          throw new Error(`Not a valid PDB file (starts with: ${pdbData.slice(0, 40)})`)
        }
      } catch (e) {
        if (!cancelled) { setStatus('error'); setErrorMsg(String(e)) }
        return
      }

      if (cancelled || !containerRef.current) return

      // Wait for container to have real layout dimensions
      await new Promise<void>(resolve => {
        const check = () => {
          if (!containerRef.current) { resolve(); return }
          const { width, height } = containerRef.current.getBoundingClientRect()
          if (width > 0 && height > 0) { resolve() }
          else requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      })
      if (cancelled || !containerRef.current) return

      viewer = window.$3Dmol.createViewer(containerRef.current, {
        backgroundColor: 'white',
        antialias: true,
      })
      viewer.addModel(pdbData, 'pdb')
      viewer.setStyle({}, {
        cartoon: {
          colorscheme: { prop: 'b', gradient: 'roygb', min: 0, max: 100 },
        },
      })
      viewer.zoomTo()
      viewer.render()

      const ro = new ResizeObserver(() => {
        try { viewer?.resize(); viewer?.render() } catch { /* ignore */ }
      })
      ro.observe(containerRef.current)

      if (!cancelled) {
        setStatus('ready')
        ;(containerRef.current as HTMLDivElement & { __ro?: ResizeObserver }).__ro = ro
      }
    }

    init().catch(e => {
      if (!cancelled) { setStatus('error'); setErrorMsg(String(e)) }
    })

    return () => {
      cancelled = true
      try { viewer?.clear() } catch { /* ignore */ }
      try {
        const ro = (containerRef.current as HTMLDivElement & { __ro?: ResizeObserver })?.__ro
        ro?.disconnect()
      } catch { /* ignore */ }
    }
  }, [pdbPath])

  return (
    <div className="rounded border border-border bg-card" style={{ height: 360, overflow: 'clip' }}>
      {status === 'error' ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
          <div className="text-[12px] text-red-500 font-medium">Could not render structure</div>
          <pre className="text-[10.5px] text-muted-foreground/70 whitespace-pre-wrap break-all max-w-xs">{errorMsg}</pre>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <div ref={containerRef} className="w-full h-full" />

          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12px] text-muted-foreground/70 bg-card z-10 pointer-events-none">
              <Loader2 size={14} className="animate-spin" /> Loading structure…
            </div>
          )}

          {status === 'ready' && (
            <div className="absolute bottom-2 right-2 text-[10px] font-mono text-muted-foreground/70 bg-card/80 px-1.5 py-0.5 rounded pointer-events-none">
              drag · scroll to zoom
            </div>
          )}

          {status === 'ready' && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-card/90 border border-border rounded px-2 py-1 pointer-events-none">
              <div className="flex h-2 w-16 rounded overflow-hidden">
                <div className="flex-1" style={{ background: 'red' }} />
                <div className="flex-1" style={{ background: 'orange' }} />
                <div className="flex-1" style={{ background: 'yellow' }} />
                <div className="flex-1" style={{ background: 'green' }} />
                <div className="flex-1" style={{ background: 'blue' }} />
              </div>
              <span className="text-[9.5px] font-mono text-muted-foreground">pLDDT 0→100</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
