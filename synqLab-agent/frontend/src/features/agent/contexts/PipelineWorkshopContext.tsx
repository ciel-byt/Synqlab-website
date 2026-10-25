/**
 * PipelineWorkshopContext — shared state between Agent Chat and Pipeline Canvas.
 *
 * When pipeline mode is enabled in the console, this context provides
 * the reactive node/edge state that both panels can read and mutate.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { PipelineNodeDef } from '@/features/lab/types'

export interface WorkshopEdge {
  id: string
  source: string
  target: string
}

export interface PipelineWorkshopState {
  nodes: PipelineNodeDef[]
  edges: WorkshopEdge[]
  name: string
}

export interface PipelineWorkshopContextValue {
  state: PipelineWorkshopState
  enabled: boolean
  setEnabled: (v: boolean) => void
  addNode: (node: PipelineNodeDef) => void
  removeNode: (nodeId: string) => void
  connectNodes: (sourceId: string, targetId: string) => void
  disconnectNodes: (sourceId: string, targetId: string) => void
  setName: (name: string) => void
  clearAll: () => void
  updateNodes: (nodes: PipelineNodeDef[]) => void
  updateEdges: (edges: WorkshopEdge[]) => void
  /** Restore state from a persisted snapshot (e.g. from DB on session load). */
  loadState: (snapshot: { nodes: any[]; edges: any[]; name: string }) => void
  /** Serialize current state for persistence. */
  toJSON: () => { nodes: any[]; edges: any[]; name: string }
}

const WorkshopContext = createContext<PipelineWorkshopContextValue | null>(null)

export function usePipelineWorkshop() {
  const ctx = useContext(WorkshopContext)
  if (!ctx) throw new Error('usePipelineWorkshop must be used within PipelineWorkshopProvider')
  return ctx
}

export function usePipelineWorkshopOptional() {
  return useContext(WorkshopContext)
}

export function PipelineWorkshopProvider({
  children,
  defaultEnabled = false,
}: {
  children: ReactNode
  defaultEnabled?: boolean
}) {
  const [enabled, setEnabled] = useState(defaultEnabled)
  const [state, setState] = useState<PipelineWorkshopState>({
    nodes: [],
    edges: [],
    name: 'New Pipeline',
  })

  const addNode = useCallback((node: PipelineNodeDef) => {
    setState(prev => ({ ...prev, nodes: [...prev.nodes, node] }))
  }, [])

  const removeNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }))
  }, [])

  const connectNodes = useCallback((sourceId: string, targetId: string) => {
    setState(prev => ({
      ...prev,
      edges: [...prev.edges, { id: `${sourceId}-${targetId}`, source: sourceId, target: targetId }],
    }))
  }, [])

  const disconnectNodes = useCallback((sourceId: string, targetId: string) => {
    setState(prev => ({
      ...prev,
      edges: prev.edges.filter(e => !(e.source === sourceId && e.target === targetId)),
    }))
  }, [])

  const setName = useCallback((name: string) => {
    setState(prev => ({ ...prev, name }))
  }, [])

  const clearAll = useCallback(() => {
    setState({ nodes: [], edges: [], name: 'New Pipeline' })
  }, [])

  const updateNodes = useCallback((nodes: PipelineNodeDef[]) => {
    setState(prev => ({ ...prev, nodes }))
  }, [])

  const updateEdges = useCallback((edges: WorkshopEdge[]) => {
    setState(prev => ({ ...prev, edges }))
  }, [])

  const loadState = useCallback((snapshot: { nodes: any[]; edges: any[]; name: string }) => {
    setState({
      nodes: (snapshot.nodes || []).map((n: any, idx: number) => ({
        id: n.id || `node-${idx}`,
        tool_name: n.tool_name || '',
        label: n.label || n.tool_name || '',
        parameters: n.parameters || {},
        depends_on: n.depends_on || [],
        position: n.position || { x: 100 + idx * 220, y: 120 },
      })),
      edges: (snapshot.edges || []).map((e: any) => ({
        id: e.id || `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
      })),
      name: snapshot.name || 'New Pipeline',
    })
  }, [])

  const toJSON = useCallback(() => ({
    nodes: state.nodes.map(n => ({
      id: n.id,
      tool_name: n.tool_name,
      label: n.label,
      parameters: n.parameters,
      depends_on: n.depends_on,
      position: n.position,
    })),
    edges: state.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    name: state.name,
  }), [state])

  return (
    <WorkshopContext.Provider value={{
      state, enabled, setEnabled,
      addNode, removeNode, connectNodes, disconnectNodes,
      setName, clearAll, updateNodes, updateEdges,
      loadState, toJSON,
    }}>
      {children}
    </WorkshopContext.Provider>
  )
}
