/**
 * DagPreview — read-only mini ReactFlow showing a pipeline's node graph.
 * Compact, auto-fit, non-interactive. Used in the pipeline detail view.
 */

import { useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import type { PipelineNodeDef } from '@/features/lab/types'
import type { Tool } from '@/types'
import { ToolIcon, catAccent } from '@/features/tools/helpers'

interface DagPreviewProps {
  nodes: PipelineNodeDef[]
  tools: Tool[]
  className?: string
  height?: number
}

// ── Compact tool node ────────────────────────────────────────────────────

interface PreviewNodeData {
  tool: Tool
  label: string
}

function PreviewNode({ data }: NodeProps) {
  const { tool, label } = data as unknown as PreviewNodeData
  const acc = catAccent(tool.category)

  return (
    <div className="bg-card rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.08)] relative overflow-visible">
      <div className={cn('absolute left-0 top-0 bottom-0 w-[2px] rounded-l-md', acc.bar)} />

      <Handle
        type="target"
        position={Position.Left}
        style={{ left: -4, width: 8, height: 8, background: '#cbd5e1', border: '1.5px solid white', borderRadius: 2 }}
      />

      <div className="pl-2.5 pr-2 py-1.5 flex items-center gap-1.5 min-w-0">
        <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0', acc.iconBg)}>
          <ToolIcon toolId={tool.id} category={tool.category} size={9} className={acc.iconText} />
        </div>
        <span className="text-[10px] font-semibold text-foreground truncate leading-none">
          {label}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ right: -4, width: 8, height: 8, background: '#0f172a', border: '1.5px solid white', borderRadius: 2 }}
      />
    </div>
  )
}

const NODE_TYPES = { preview: PreviewNode }

// ── Main component ───────────────────────────────────────────────────────

function DagPreviewInner({ nodes: pipelineNodes, tools, className, height = 180 }: DagPreviewProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const fNodes: Node[] = pipelineNodes.map((n, idx) => {
      const tool = tools.find(t => t.id === n.tool_name || t.name === n.tool_name)
      return {
        id: n.id,
        type: 'preview',
        position: n.position || { x: 80 + idx * 180, y: 60 + (idx % 2) * 40 },
        data: {
          tool: tool || {
            id: n.tool_name,
            name: n.label || n.tool_name,
            category: 'unknown',
            category_label: '',
            category_description: '',
            description: '',
            inputs: [],
            outputs: [],
            tags: [],
            links: {},
            status: 'unknown',
          },
          label: n.label || tool?.name || n.tool_name,
        },
      }
    })

    const fEdges: Edge[] = []
    for (const n of pipelineNodes) {
      for (const dep of n.depends_on || []) {
        fEdges.push({
          id: `${dep}-${n.id}`,
          source: dep,
          target: n.id,
          type: 'default',
          markerEnd: { type: 'arrowclosed' as any, width: 12, height: 12, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 1.2, strokeDasharray: '5 3' },
        })
      }
    }

    return { flowNodes: fNodes, flowEdges: fEdges }
  }, [pipelineNodes, tools])

  if (pipelineNodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground/50 text-[11px]', className)} style={{ height }}>
        No nodes defined
      </div>
    )
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow()
  const fitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doFit = useCallback(() => {
    clearTimeout(fitTimerRef.current)
    fitTimerRef.current = setTimeout(() => {
      fitView({ padding: 0.25, duration: 200, maxZoom: 1 })
    }, 80)
  }, [fitView])

  // Re-fit when container resizes (tab switch, visibility change)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) doFit()
    })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(fitTimerRef.current) }
  }, [doFit])

  // Also refit when the pipeline nodes change
  useEffect(() => {
    doFit()
  }, [flowNodes.length, doFit])

  return (
    <div ref={containerRef} className={cn('rounded-lg border border-border bg-muted/20 overflow-hidden', className)} style={{ height }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onInit={doFit}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={14} size={0.8} color="#d1d5db" />
      </ReactFlow>
    </div>
  )
}

export function DagPreview(props: DagPreviewProps) {
  return (
    <ReactFlowProvider>
      <DagPreviewInner {...props} />
    </ReactFlowProvider>
  )
}
