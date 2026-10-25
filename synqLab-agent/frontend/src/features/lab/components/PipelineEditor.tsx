/**
 * PipelineEditor — canvas-based visual pipeline editor with node cards and SVG edges.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Play, Save, LayoutGrid, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { PipelineNodeDef, PipelineDef, PipelineRun, NodeStatus } from '@/features/lab/types'
import { PipelineNodeCard } from '@/features/lab/components/PipelineNode'

// Available tools for the palette.
const TOOL_PALETTE = [
  { tool: 'predict_structure', label: 'Fold Protein', icon: '🧬' },
  { tool: 'generate_sequences', label: 'Generate Sequences', icon: '🧪' },
  { tool: 'analyze_stability', label: 'Stability Analysis', icon: '📊' },
  { tool: 'write_report', label: 'Write Report', icon: '📄' },
  { tool: 'search_literature', label: 'Literature Search', icon: '🔍' },
]

interface PipelineEditorProps {
  pipeline: PipelineDef | null
  onSave?: (pipeline: PipelineDef) => void
}

export function PipelineEditor({ pipeline, onSave }: PipelineEditorProps) {
  const [nodes, setNodes] = useState<PipelineNodeDef[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<PipelineRun | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Sync from prop.
  useEffect(() => {
    if (pipeline) {
      setNodes(pipeline.nodes.map(n => ({ ...n })))
    }
  }, [pipeline?.id])

  const addNode = useCallback((toolName: string, label: string) => {
    const id = `${toolName.replace(/_/g, '')}_${Date.now().toString(36)}`
    const newNode: PipelineNodeDef = {
      id,
      tool_name: toolName,
      label,
      parameters: {},
      depends_on: [],
      position: { x: 100 + nodes.length * 260, y: 200 },
    }
    setNodes(prev => [...prev, newNode])
  }, [nodes.length])

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id).map(n => ({
      ...n,
      depends_on: n.depends_on.filter(d => d !== id),
    })))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleRun = useCallback(async () => {
    if (!pipeline) return
    setRunning(true)
    setRunStatus(null)
    try {
      // Build scoped inputs from node parameters (nodeId::param format).
      const inputs: Record<string, unknown> = {}
      for (const node of nodes) {
        for (const [key, value] of Object.entries(node.parameters || {})) {
          inputs[`${node.id}::${key}`] = value
        }
      }
      const { run_id } = await api.runDAGPipeline(pipeline.id, inputs)

      // Poll for completion.
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const status = await api.getDAGRun(run_id)
        setRunStatus(status as unknown as PipelineRun)

        // Update node statuses on canvas.
        if (status.node_statuses) {
          setNodes(prev => prev.map(n => ({
            ...n,
            status: (status.node_statuses?.[n.id] as NodeStatus) || 'pending',
          })))
        }

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'partial') {
          break
        }
      }
    } catch (err) {
      console.error('Pipeline run failed:', err)
    } finally {
      setRunning(false)
    }
  }, [pipeline, nodes])

  const handleSave = useCallback(() => {
    if (!pipeline) return
    onSave?.({ ...pipeline, nodes })
  }, [pipeline, nodes, onSave])

  // Compute edges from depends_on.
  const edges = nodes.flatMap(node =>
    node.depends_on.map(depId => {
      const from = nodes.find(n => n.id === depId)
      const to = node
      if (!from || !to) return null
      return { from: from.position, to: to.position, fromId: depId, toId: node.id }
    }).filter(Boolean),
  ) as { from: { x: number; y: number }; to: { x: number; y: number }; fromId: string; toId: string }[]

  return (
    <div className="flex h-full">
      {/* Tool palette */}
      <div className="w-[180px] flex-shrink-0 border-r border-border/40 bg-card/50 p-3 space-y-2 overflow-y-auto">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Add Tool</h4>
        {TOOL_PALETTE.map(({ tool, label, icon }) => (
          <button
            key={tool}
            onClick={() => addNode(tool, label)}
            className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs text-left hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40"
          >
            <span>{icon}</span>
            <span className="font-medium">{label}</span>
          </button>
        ))}

        <div className="border-t border-border/20 pt-2 mt-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Templates</h4>
          {['gfp11', 'design', 'screening'].map(tid => (
            <button
              key={tid}
              onClick={async () => {
                try {
                  const tmpl = await api.getPipeline(tid)
                  setNodes(tmpl.nodes)
                } catch (err) {
                  console.error('Failed to load template:', err)
                }
              }}
              className="flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-[10px] text-left hover:bg-muted/50 transition-colors"
            >
              <LayoutGrid className="h-3 w-3 text-muted-foreground" />
              <span className="capitalize">{tid.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-auto bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.3)_1px,transparent_0)] bg-[size:24px_24px]" ref={canvasRef}>
        {/* SVG edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 1200, minHeight: 600 }}>
          {edges.map((edge, i) => {
            const x1 = edge.from.x + 180
            const y1 = edge.from.y + 40
            const x2 = edge.to.x
            const y2 = edge.to.y + 40
            const cx = (x1 + x2) / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            )
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node => (
          <div
            key={node.id}
            className="absolute group"
            style={{ left: node.position.x, top: node.position.y }}
          >
            <PipelineNodeCard
              node={node}
              selected={selectedId === node.id}
              onSelect={() => setSelectedId(node.id)}
              onDelete={() => deleteNode(node.id)}
            />
          </div>
        ))}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Add tools from the palette to build your pipeline</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {runStatus && (
          <Badge variant="outline" className={`text-[9px] ${
            runStatus.status === 'completed' ? 'text-emerald-500 border-emerald-500/30' :
            runStatus.status === 'failed' ? 'text-destructive border-destructive/30' :
            'text-blue-500 border-blue-500/30'
          }`}>
            {runStatus.status}
          </Badge>
        )}
        <Button size="sm" variant="outline" onClick={handleSave} className="h-7 text-xs gap-1">
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button size="sm" onClick={handleRun} disabled={running || nodes.length === 0} className="h-7 text-xs gap-1">
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {running ? 'Running...' : 'Run'}
        </Button>
      </div>
    </div>
  )
}
