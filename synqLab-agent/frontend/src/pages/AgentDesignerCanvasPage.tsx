import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Trash2, RotateCcw, Save,
  X, Layers,
} from 'lucide-react'
import { api } from '@/api/client'
import type { Tool, Category } from '@/types'
import { useToolsAndHealth } from '@/features/tools/hooks/useToolsAndHealth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ToolIcon, catAccent } from '@/features/tools/helpers'
import { ToolMiniPalette } from '@/features/tools/components/ToolMiniPalette'
import { CANVAS_NODE_TYPES, type ToolNodeData } from '@/features/lab/components/CanvasToolNode'
import type { PipelineDef } from '@/features/lab/types'

const CAT_DOT: Record<string, string> = {
  sequence_generation: 'bg-violet-500', structure_prediction: 'bg-sky-500',
  scoring: 'bg-amber-500', data: 'bg-teal-500',
}
function catDot(cat: string) { return CAT_DOT[cat] ?? 'bg-slate-400' }

// Uses shared CANVAS_NODE_TYPES from CanvasToolNode

function Inspector({ node, onClose }: { node: Node | null; onClose: () => void }) {
  if (!node) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Layers size={18} className="text-muted-foreground/50" />
      </div>
      <p className="text-[12px] text-muted-foreground/70 leading-relaxed">Select a node on the canvas to inspect its inputs and outputs</p>
    </div>
  )

  const { tool } = node.data as unknown as ToolNodeData
  const acc = catAccent(tool.category)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5', acc.iconBg)}>
            <ToolIcon toolId={tool.id} category={tool.category} size={13} className={acc.iconText} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">{tool.name}</p>
            <p className="text-[10.5px] text-muted-foreground/70">{tool.category_label}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground/50 hover:text-muted-foreground mt-0.5">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {tool.description && (
          <p className="text-[12px] text-muted-foreground leading-relaxed">{tool.description}</p>
        )}

        {tool.inputs?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">Inputs</p>
            <div className="space-y-1.5">
              {tool.inputs.map(inp => (
                <div key={inp.name} className="flex items-start gap-2 text-[11.5px]">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', catDot(tool.category))} />
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-foreground">{inp.name}</span>
                    <span className="font-mono text-muted-foreground/70 ml-1.5 text-[10px]">{inp.type}</span>
                    {inp.description && <p className="text-muted-foreground/70 text-[11px] mt-0.5 leading-snug">{inp.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tool.outputs?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">Outputs</p>
            <div className="space-y-1.5">
              {tool.outputs.map(out => (
                <div key={out.name} className="flex items-start gap-2 text-[11.5px]">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-foreground" />
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-foreground">{out.name}</span>
                    <span className="font-mono text-muted-foreground/70 ml-1.5 text-[10px]">{out.type}</span>
                    {out.description && <p className="text-muted-foreground/70 text-[11px] mt-0.5 leading-snug">{out.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tool.links && Object.keys(tool.links).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">Resources</p>
            <div className="space-y-1">
              {Object.entries(tool.links).map(([type, url]) => (
                <a key={type} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="capitalize">{type}</span>
                  <span className="text-muted-foreground/50">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function DesignerCanvas({
  tools,
  categories: _categories,
  pipelineId,
  onRegisterDragStart,
}: {
  tools: Tool[]
  categories: Category[]
  pipelineId: string
  onRegisterDragStart?: (fn: (e: React.DragEvent, tool: Tool) => void) => void
}) {
  const navigate = useNavigate()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const instanceCountsRef = useRef<Record<string, number>>({})
  const [saved, setSaved] = useState(false)
  const [pipelineDef, setPipelineDef] = useState<PipelineDef | null>(null)

  useEffect(() => {
    if (!pipelineId || pipelineId === 'new') {
      // Blank canvas for new pipeline
      setPipelineDef({ id: 'new', name: 'New Pipeline', description: '', nodes: [] })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const def = await api.getPipeline(pipelineId)
        if (cancelled) return
        setPipelineDef(def)
        // Convert pipeline nodes to React Flow nodes
        const flowNodes: Node[] = (def.nodes || []).map((n, idx) => {
          const tool = tools.find(t => t.id === n.tool_name || t.name === n.tool_name)
          return {
            id: n.id,
            type: 'tool',
            position: n.position || { x: 100 + idx * 200, y: 100 },
            data: {
              tool: tool || {
                id: n.tool_name,
                name: n.label || n.tool_name,
                category: 'unknown',
                description: '',
                inputs: [],
                outputs: [],
              },
              instanceLabel: n.label,
            },
          }
        })
        setNodes(flowNodes)
        // Build edges from depends_on
        const flowEdges: Edge[] = []
        for (const n of def.nodes || []) {
          for (const dep of n.depends_on || []) {
            flowEdges.push({
              id: `${dep}-${n.id}`,
              source: dep,
              target: n.id,
              type: 'default',
              markerEnd: { type: 'arrowclosed' as any, width: 14, height: 14, color: '#64748b' },
              style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 3' },
            })
          }
        }
        setEdges(flowEdges)
      } catch (err) {
        console.error('Failed to load pipeline:', err)
      }
    })()
    return () => { cancelled = true }
  }, [pipelineId, tools])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds =>
        addEdge({
          ...params,
          type: 'default',
          markerEnd: { type: 'arrowclosed' as any, width: 14, height: 14, color: '#64748b' },
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 3' },
        }, eds)
      ),
    [setEdges],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const toolId = e.dataTransfer.getData('application/synqlab-tool')
      const tool = tools.find(t => t.id === toolId)
      if (!tool || !rfInstance || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })

      instanceCountsRef.current[tool.id] = (instanceCountsRef.current[tool.id] ?? 0) + 1
      const count = instanceCountsRef.current[tool.id]
      const newNode: Node = {
        id: `${tool.id}-${count}-${Date.now()}`,
        type: 'tool',
        position,
        data: {
          tool,
          instanceLabel: count > 1 ? `instance ${count}` : undefined,
        },
      }
      setNodes(nds => [...nds, newNode])
    },
    [tools, rfInstance, setNodes],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  async function save() {
    if (!pipelineDef) return
    try {
      // Convert React Flow nodes back to pipeline nodes
      const pipelineNodes = nodes.map(n => {
        const data = n.data as unknown as ToolNodeData
        const incomingEdges = edges.filter(e => e.target === n.id)
        return {
          id: n.id,
          tool_name: data.tool.id,
          label: data.instanceLabel || data.tool.name,
          parameters: {},
          depends_on: incomingEdges.map(e => e.source),
          position: n.position,
        }
      })

      if (pipelineId === 'new' || !pipelineId) {
        // New pipeline — create via API
        const pName = pipelineDef.name !== 'New Pipeline' ? pipelineDef.name : `Pipeline ${new Date().toLocaleString()}`
        const payload = {
          id: '',
          name: pName,
          description: `Custom pipeline with ${pipelineNodes.length} node${pipelineNodes.length !== 1 ? 's' : ''}`,
          nodes: pipelineNodes,
        }
        console.log('[DesignerCanvas] Creating pipeline:', payload)
        await api.createPipeline(payload)
        setSaved(true)
        setTimeout(() => navigate('/lab/pipelines'), 600)
      } else {
        await api.savePipeline(pipelineId, {
          ...pipelineDef,
          nodes: pipelineNodes,
        })
        setSaved(true)
        setTimeout(() => navigate('/lab/pipelines'), 800)
      }
    } catch (err) {
      console.error('Failed to save pipeline:', err)
      alert('Failed to save pipeline')
    }
  }

  function clear() {
    if (!confirm('Clear canvas? This will reset all nodes.')) return
    setNodes([])
    setEdges([])
    setSelectedNode(null)
    instanceCountsRef.current = {}
  }

  function reset() {
    if (rfInstance) rfInstance.fitView({ padding: 0.1, duration: 500 })
  }

  function onDragStart(e: React.DragEvent, tool: Tool) {
    e.dataTransfer.setData('application/synqlab-tool', tool.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  useEffect(() => {
    onRegisterDragStart?.(onDragStart)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 flex items-center gap-2 px-4 border-b border-border bg-card flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate('/lab/pipelines')}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            ← Back
          </button>
          <span className="text-[11px] text-muted-foreground flex-1 truncate hidden sm:block">Drag &amp; connect tools</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-[11px] gap-1.5">
              <RotateCcw size={11} /> Fit
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-red-600">
              <Trash2 size={11} /> Clear
            </Button>
            <Button size="sm" onClick={save} className={cn('h-7 text-[11px] gap-1.5', saved && 'bg-emerald-600 hover:bg-emerald-600')}>
              <Save size={11} /> {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        <div ref={reactFlowWrapper} className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={CANVAS_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            deleteKeyCode="Backspace"
            defaultEdgeOptions={{
              type: 'default',
              markerEnd: { type: 'arrowclosed' as any, width: 14, height: 14, color: '#64748b' },
              style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 3' },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
            <Controls showInteractive={false} className="!shadow-sm !border !border-border !bg-card" />
            <MiniMap
              nodeColor={n => {
                const d = n.data as unknown as ToolNodeData
                const map: Record<string, string> = {
                  'bg-violet-500': '#8b5cf6', 'bg-sky-500': '#0ea5e9',
                  'bg-amber-500': '#f59e0b', 'bg-teal-500': '#14b8a6', 'bg-slate-400': '#94a3b8',
                }
                return map[catDot(d?.tool?.category ?? '')] ?? '#94a3b8'
              }}
              className="!border !border-border !shadow-sm !bg-card"
              maskColor="rgba(248,250,251,0.7)"
            />

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Layers size={22} className="text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-muted-foreground/70">Drag tools onto the canvas</p>
                  <p className="text-[11.5px] text-muted-foreground/50 mt-1">Connect them to design your agent pipeline</p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      {selectedNode && (
        <div className="w-60 flex-shrink-0 border-l border-border bg-card">
          <Inspector node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      )}
    </div>
  )
}

export function AgentDesignerCanvasPage() {
  const { pipelineId } = useParams<{ pipelineId: string }>()
  const { tools, categories, health, loading } = useToolsAndHealth({ withCategories: true })

  const [onDragStartFn, setOnDragStartFn] = useState<{ fn: (e: React.DragEvent, tool: Tool) => void } | null>(null)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
              <p className="text-[12px] text-muted-foreground/70">Loading tools…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ReactFlowProvider>
              <DesignerCanvas
                tools={tools}
                categories={categories}
                pipelineId={pipelineId ?? ''}
                onRegisterDragStart={fn => setOnDragStartFn({ fn })}
              />
            </ReactFlowProvider>
          </div>
        )}
      </div>

      {/* Mini palette — right side */}
      {!loading && (
        <ToolMiniPalette
          tools={tools}
          health={health}
          onDragStart={(e, tool) => onDragStartFn?.fn(e, tool)}
          fullHeight
          showSearch
        />
      )}
    </div>
  )
}
