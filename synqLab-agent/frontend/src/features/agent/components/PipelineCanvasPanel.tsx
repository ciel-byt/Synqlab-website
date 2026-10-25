/**
 * PipelineCanvasPanel — embedded ReactFlow canvas for the Pipeline Workshop.
 *
 * Renders inside the Agent Console when pipeline mode is enabled.
 * Reads/writes shared state via PipelineWorkshopContext.
 * Supports drag-and-drop tool addition and node connection.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { RotateCcw, Trash2, Save } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { usePipelineWorkshop } from '@/features/agent/contexts/PipelineWorkshopContext'
import { CANVAS_NODE_TYPES, type ToolNodeData } from '@/features/lab/components/CanvasToolNode'
import { useCanvasConnect, useCanvasDrop, handleToolDragStart } from '@/features/lab/components/canvasUtils'
import type { Tool } from '@/types'

import { ToolMiniPalette } from '@/features/tools/components/ToolMiniPalette'

// ── Main panel ───────────────────────────────────────────────────────────

function CanvasInner({ tools, health, sessionId }: { tools: Tool[]; health?: Record<string, { available: boolean }>; sessionId?: string }) {
  const workshop = usePipelineWorkshop()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [saved, setSaved] = useState(false)
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const instanceCountsRef = useRef<Record<string, number>>({})

  // Sync workshop state → ReactFlow (detect new nodes from chat tool calls)
  useEffect(() => {
    const workshopNodes = workshop.state.nodes
    if (workshopNodes.length === 0) return

    const currentIds = new Set(nodes.map(n => n.id))
    const newNodes = workshopNodes.filter(n => !currentIds.has(n.id))

    if (newNodes.length > 0) {
      const flowNodes: Node[] = newNodes.map((n, idx) => {
        const tool = tools.find(t => t.id === n.tool_name || t.name === n.tool_name)
        return {
          id: n.id,
          type: 'tool',
          position: n.position || { x: 100 + (currentIds.size + idx) * 220, y: 120 },
          data: {
            tool: tool || { id: n.tool_name, name: n.label || n.tool_name, category: 'unknown', description: '', inputs: [], outputs: [] },
            instanceLabel: n.label,
          },
        }
      })
      setNodes(nds => [...nds, ...flowNodes])
    }

    // Sync new edges from workshop
    const workshopEdges = workshop.state.edges
    const currentEdgeIds = new Set(edges.map(e => e.id))
    const newEdges = workshopEdges.filter(e => !currentEdgeIds.has(e.id))
    if (newEdges.length > 0) {
      setEdges(eds => [
        ...eds,
        ...newEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'default',
          markerEnd: { type: 'arrowclosed' as any, width: 14, height: 14, color: '#64748b' },
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 3' },
        })),
      ])
    }
  }, [workshop.state.nodes, workshop.state.edges, tools])

  // Auto-fit canvas whenever nodes change so the graph stays in view
  useEffect(() => {
    if (!rfInstance || nodes.length === 0) return
    // Small delay to let ReactFlow finish layout before fitting
    const timer = setTimeout(() => {
      rfInstance.fitView({ padding: 0.15, duration: 300, maxZoom: 1.2 })
    }, 50)
    return () => clearTimeout(timer)
  }, [nodes.length, rfInstance])

  // Sync ReactFlow → workshop context so chat knows canvas state
  useEffect(() => {
    const workshopNodes = nodes.map(n => {
      const d = n.data as unknown as ToolNodeData
      return {
        id: n.id,
        tool_name: d.tool.id || d.tool.name,
        label: d.instanceLabel || d.tool.name,
        parameters: {},
        depends_on: edges.filter(e => e.target === n.id).map(e => e.source),
        position: n.position,
      }
    })
    workshop.updateNodes(workshopNodes)
  }, [nodes, edges])

  // Sync edges back to workshop
  useEffect(() => {
    const workshopEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }))
    workshop.updateEdges(workshopEdges)
  }, [edges])

  const onConnect = useCanvasConnect(setEdges)

  const { onDrop, onDragOver } = useCanvasDrop(
    tools, rfInstance, reactFlowWrapper, instanceCountsRef, setNodes,
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

    try {
      await api.createPipeline({
        id: '',
        name: workshop.state.name || `Pipeline ${new Date().toLocaleString()}`,
        description: `Custom pipeline with ${pipelineNodes.length} node${pipelineNodes.length !== 1 ? 's' : ''}`,
        nodes: pipelineNodes,
      })
      setSaved(true)
      // Also persist canvas state to the session so it survives refresh.
      if (sessionId) {
        api.saveCanvasState(sessionId, workshop.toJSON()).catch(err =>
          console.warn('Failed to persist canvas state:', err)
        )
      }
      setTimeout(() => {
        setSaved(false)
        workshop.setEnabled(false)
      }, 1200)
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
    workshop.clearAll()
  }

  return (
    <div className="flex h-full border-l border-border">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-9 flex items-center gap-1.5 px-3 border-b border-border bg-card/80 flex-shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider flex-1">Pipeline Canvas</span>
          <Button variant="ghost" size="sm" onClick={() => rfInstance?.fitView({ padding: 0.1, duration: 400 })} className="h-6 text-[10px] gap-1 px-1.5">
            <RotateCcw size={10} /> Fit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-red-500">
            <Trash2 size={10} /> Clear
          </Button>
          <Button size="sm" onClick={handleSave} disabled={nodes.length === 0} className="h-6 text-[10px] gap-1 px-2">
            <Save size={10} /> {saved ? 'Saved ✓' : 'Save'}
          </Button>
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
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={0.8} color="#94a3b8" />
          </ReactFlow>
        </div>
      </div>

      {/* Mini tool palette */}
      <ToolMiniPalette
        tools={tools}
        health={health}
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed(!paletteCollapsed)}
        onDragStart={handleToolDragStart}
      />
    </div>
  )
}

// ── Exported wrapper ─────────────────────────────────────────────────────

export function PipelineCanvasPanel({ tools, health, sessionId }: { tools: Tool[]; health?: Record<string, { available: boolean }>; sessionId?: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner tools={tools} health={health} sessionId={sessionId} />
    </ReactFlowProvider>
  )
}

