/**
 * InlineCanvasEditor — embedded ReactFlow canvas for creating new pipelines
 * directly inside the PipelinePage content area.
 *
 * Drag tools from the mini palette, connect them, name the pipeline, and save.
 */

import { useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  RotateCcw, Trash2, Save, Layers, X,
} from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ToolMiniPalette } from '@/features/tools/components/ToolMiniPalette'
import { CANVAS_NODE_TYPES, type ToolNodeData } from '@/features/lab/components/CanvasToolNode'
import { useCanvasConnect, useCanvasDrop, handleToolDragStart, DEFAULT_EDGE_OPTIONS } from './canvasUtils'
import type { Tool } from '@/types'

// Uses shared CANVAS_NODE_TYPES from CanvasToolNode

// ── Canvas inner ─────────────────────────────────────────────────────────

function CanvasInner({
  tools,
  health,
  onSaved,
  onCancel,
}: {
  tools: Tool[]
  health?: Record<string, { available: boolean }>
  onSaved: () => void
  onCancel: () => void
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const instanceCountsRef = useRef<Record<string, number>>({})
  const [saved, setSaved] = useState(false)
  const [pipelineName, setPipelineName] = useState('')
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)

  const onConnect = useCanvasConnect(setEdges)
  const { onDrop, onDragOver } = useCanvasDrop(
    tools, rfInstance, reactFlowWrapper, instanceCountsRef, setNodes, `${Date.now()}`
  )

  async function handleSave() {
    const pipelineNodes = nodes.map(n => {
      const data = n.data as unknown as ToolNodeData
      const incoming = edges.filter(e => e.target === n.id)
      return {
        id: n.id,
        tool_name: data.tool.id,
        label: data.instanceLabel || data.tool.name,
        parameters: {},
        depends_on: incoming.map(e => e.source),
        position: n.position,
      }
    })

    const name = pipelineName.trim() || `Pipeline ${new Date().toLocaleString()}`

    try {
      await api.createPipeline({
        id: '',
        name,
        description: `Custom pipeline with ${pipelineNodes.length} node${pipelineNodes.length !== 1 ? 's' : ''}`,
        nodes: pipelineNodes,
      })
      setSaved(true)
      setTimeout(() => onSaved(), 800)
    } catch (err) {
      console.error('Failed to save pipeline:', err)
      alert('Failed to save pipeline')
    }
  }

  function handleClear() {
    if (!confirm('Clear canvas?')) return
    setNodes([])
    setEdges([])
    instanceCountsRef.current = {}
  }

  return (
    <div className="flex h-full">
      {/* Canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 flex items-center gap-2 px-4 border-b border-border bg-card/80 flex-shrink-0">
          <Input
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            placeholder="Pipeline name…"
            className="h-7 w-48 text-xs"
          />
          <span className="text-[10px] text-muted-foreground/50 flex-1 truncate hidden sm:block">
            Drag & connect computers
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => rfInstance?.fitView({ padding: 0.1, duration: 400 })} className="h-7 text-[10px] gap-1 px-1.5">
              <RotateCcw size={10} /> Fit
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-red-500">
              <Trash2 size={10} /> Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-[10px] gap-1 px-1.5">
              <X size={10} /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={nodes.length === 0} className={cn('h-7 text-[10px] gap-1 px-2', saved && 'bg-emerald-600 hover:bg-emerald-600')}>
              <Save size={10} /> {saved ? 'Saved ✓' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            nodeTypes={CANVAS_NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            deleteKeyCode="Backspace"
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={0.8} color="#94a3b8" />
            <Controls showInteractive={false} className="!shadow-sm !border !border-border !bg-card" />

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Layers size={22} className="text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-muted-foreground/70">Drag computers onto the canvas</p>
                  <p className="text-[11.5px] text-muted-foreground/50 mt-1">Connect them to design your pipeline</p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Mini tool palette — right side */}
      <ToolMiniPalette
        tools={tools}
        health={health}
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed(!paletteCollapsed)}
        onDragStart={handleToolDragStart}
        fullHeight
        showSearch
      />
    </div>
  )
}

// ── Exported wrapper ─────────────────────────────────────────────────────

export function InlineCanvasEditor({
  tools,
  health,
  onSaved,
  onCancel,
}: {
  tools: Tool[]
  health?: Record<string, { available: boolean }>
  onSaved: () => void
  onCancel: () => void
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner tools={tools} health={health} onSaved={onSaved} onCancel={onCancel} />
    </ReactFlowProvider>
  )
}
