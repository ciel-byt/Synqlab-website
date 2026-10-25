import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface LiveLogsProps {
    onClose: () => void
}

export function LiveLogs({ onClose }: LiveLogsProps) {
    const [lines, setLines] = useState<string[]>([])
    const [connected, setConnected] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${proto}//${window.location.host}/ws/logs`)
        ws.onopen = () => setConnected(true)
        ws.onclose = () => setConnected(false)
        ws.onerror = () => setConnected(false)
        ws.onmessage = (evt) => {
            setLines((prev) => {
                const next = [...prev, evt.data]
                return next.length > 500 ? next.slice(-500) : next
            })
        }
        return () => ws.close()
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [lines])

    return (
        <div className="w-[420px] border-l border-border bg-foreground flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-background/10">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-background/30'}`} />
                    <span className="text-xs font-medium text-background/70 tracking-wide uppercase">Live Logs</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-background/10 text-background/50 hover:text-background/80 transition-colors">
                    <X size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-[1.6] text-background/50">
                {lines.length === 0 && (
                    <span className="text-background/30 italic">{connected ? 'Waiting for log output…' : 'Connecting…'}</span>
                )}
                {lines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    )
}
