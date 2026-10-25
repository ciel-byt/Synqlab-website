/**
 * Lab feature — types and tab definitions.
 */

export const LAB_TABS = [
  { key: 'computers',    label: 'Computers',   path: '/lab/computers' },
  { key: 'pipelines',   label: 'Pipelines',   path: '/lab/pipelines' },
  { key: 'agents',      label: 'Agents',      path: '/lab/agents' },
  { key: 'experiments', label: 'Experiments',  path: '/lab/experiments' },
] as const

// ── Pipeline types ────────────────────────────────────────────────────────

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Schema for a single input field on a pipeline node (Airflow Param-style). */
export interface NodeFieldSchema {
  name: string
  type: 'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'list' | 'sequence' | 'object'
  label: string
  description?: string
  default?: unknown
  required?: boolean
  minimum?: number
  maximum?: number
  enum?: unknown[]
  enumLabels?: string[]
  placeholder?: string
  section?: string
}

/** Schema for a single output field on a pipeline node. */
export interface NodeOutputSchema {
  name: string
  type: string
  description?: string
}

export interface PipelineNodeDef {
  id: string
  tool_name: string
  label: string
  parameters: Record<string, unknown>
  depends_on: string[]
  position: { x: number; y: number }
  status?: NodeStatus
  /** Embedded input schema for form generation (populated by backend). */
  input_schema?: NodeFieldSchema[]
  /** Embedded output schema for wired-field display. */
  output_schema?: NodeOutputSchema[]
}

export interface PipelineDef {
  id: string
  name: string
  description: string
  nodes: PipelineNodeDef[]
  /** Pipeline-level configurable params (Airflow-style). */
  pipeline_params?: NodeFieldSchema[]
}

export interface PipelineTemplate {
  template_id: string
  name: string
  description: string
  node_count: number
  nodes: PipelineNodeDef[]
}

export interface PipelineRun {
  id: string
  pipeline_id: string
  status: string
  node_statuses?: Record<string, string>
  results?: Record<string, unknown>
  started_at?: string
  completed_at?: string
  batch?: boolean
  error?: string
}
