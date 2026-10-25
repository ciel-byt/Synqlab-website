/**
 * canvasUtils — shared drag-drop, connect, and edge-style helpers
 * for pipeline canvas implementations (PipelineCanvasPanel, InlineCanvasEditor).
 *
 * Deduplicates the identical onConnect/onDrop/onDragOver/handleDragStart
 * logic and default edge style constants.
 */
import { useCallback, type MutableRefObject } from 'react'
import { addEdge, type Edge, type Node, type Connection } from '@xyflow/react'
import type { Tool } from '@/types'

// ── Edge style constants ─────────────────────────────────────────────────

export const DEFAULT_EDGE_MARKER = {
  type: 'arrowclosed' as const,
  width: 14,
  height: 14,
  color: '#64748b',
}

export const DEFAULT_EDGE_STYLE = {
  stroke: '#64748b',
  strokeWidth: 1.5,
  strokeDasharray: '6 3',
}

export const DEFAULT_EDGE_OPTIONS = {
  type: 'default' as const,
  markerEnd: DEFAULT_EDGE_MARKER,
  style: DEFAULT_EDGE_STYLE,
}

// ── Shared hooks ─────────────────────────────────────────────────────────

export function useCanvasConnect(
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
) {
  return useCallback(
    (params: Connection) =>
      setEdges(eds =>
        addEdge(
          { ...params, ...DEFAULT_EDGE_OPTIONS },
          eds,
        ),
      ),
    [setEdges],
  )
}

export function useCanvasDrop(
  tools: Tool[],
  rfInstance: any,
  reactFlowWrapper: MutableRefObject<HTMLDivElement | null>,
  instanceCountsRef: MutableRefObject<Record<string, number>>,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  /** Optional suffix for node IDs to prevent collisions across components. */
  idSuffix?: string,
) {
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const toolId = e.dataTransfer.getData('application/synqlab-tool')
      if (!toolId || !rfInstance || !reactFlowWrapper.current) return

      const tool = tools.find(t => t.id === toolId)
      if (!tool) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })

      const count = (instanceCountsRef.current[tool.id] || 0) + 1
      instanceCountsRef.current[tool.id] = count
      const nodeId = idSuffix
        ? `${tool.id}-${count}-${idSuffix}`
        : `${tool.id}-${count}`

      setNodes(nds => [
        ...nds,
        {
          id: nodeId,
          type: 'tool',
          position,
          data: { tool, instanceLabel: count > 1 ? `${tool.name} ${count}` : tool.name },
        },
      ])
    },
    [rfInstance, tools, setNodes, reactFlowWrapper, instanceCountsRef, idSuffix],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return { onDrop, onDragOver }
}

export function handleToolDragStart(e: React.DragEvent, tool: Tool) {
  e.dataTransfer.setData('application/synqlab-tool', tool.id)
  e.dataTransfer.effectAllowed = 'move'
}
