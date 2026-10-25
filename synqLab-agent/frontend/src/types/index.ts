export interface ToolInput {
  name: string
  type: string
  description?: string
  default?: unknown
}

export interface ToolOutput {
  name: string
  type: string
  description?: string
}

export interface ToolExample {
  name: string
  description?: string
  inputs: Record<string, unknown>
}

export interface ResourceProfile {
  gpu?: 'low' | 'medium' | 'high' | 'very_high' | 'none'
  cpu?: 'low' | 'medium' | 'high' | 'very_high' | 'none'
  ram?: 'low' | 'medium' | 'high' | 'very_high' | 'none'
  disk_gb?: number
  ram_gb?: number
  estimated_time_per_call?: string
}

export interface Tool {
  id: string
  name: string
  category: string
  category_label: string
  category_description: string
  phase?: string
  status: string
  description?: string
  abstract?: string
  meta?: Record<string, string>
  examples?: ToolExample[]
  inputs: ToolInput[]
  outputs: ToolOutput[]
  tags: string[]
  links: Record<string, string>
  resource_profile?: ResourceProfile
}

export interface Category {
  id: string
  label: string
  description: string
  tool_count: number
}

export interface ToolHealth {
  available: boolean
  reason: string
  install_hint?: string
}

export interface HealthMap {
  [toolId: string]: ToolHealth
}

export interface ComputeInfo {
  device: 'cuda' | 'mps' | 'cpu'
  type: 'gpu' | 'cpu'
  name: string
  vram_gb?: number
  cuda_version?: string
}



export interface JobResult {
  status: 'queued' | 'running' | 'completed' | 'failed'
  tool_id?: string
  success?: boolean
  outputs?: Record<string, unknown>
  latency_ms?: number
  error_message?: string
  error?: string
  result?: PipelineResult
  // Pipeline stage progress (populated during pipeline runs)
  stage?: number
  stage_total?: number
  stage_label?: string
  stage_detail?: string
}

export interface PipelineResult {
  experiment_id: string
  round_id: string
  n_generated: number
  n_passed_gate1: number
  n_passed_gate2: number
  n_top_k: number
  top_k_sequences: string[]
  top_k_scores: Array<{
    confidence?: number
    ddg?: number
    reranker_score?: number
  }>
  budget?: {
    elapsed_seconds?: number
  }
  error?: string
}

export interface DAGPipelineRun {
  id: string
  pipeline_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial'
  started_at?: string
  completed_at?: string
  error?: string
  node_statuses: Record<string, string>
  results?: any
  round?: number
  max_rounds?: number
}

export type SortDirection = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Database browser types
// ---------------------------------------------------------------------------

export interface DbTableResponse<T> {
  total: number
  rows: T[]
  error?: string
}

export interface DbExperiment {
  id: string
  name: string | null
  status: string
  created_at: string | null
  config: Record<string, unknown> | null
}

export interface DbToolRun {
  id: string
  experiment_id: string
  round_id: string
  tool_id: string
  status: string
  started_at: string | null
  finished_at: string | null
  latency_ms: number | null
  error_message: string | null
}

export interface DbArtifact {
  id: string
  experiment_id: string
  tool_run_id: string | null
  artifact_type: string
  path: string
  format: string | null
  size_bytes: number | null
  checksum: string | null
  created_at: string | null
  meta: Record<string, unknown> | null
}

export interface DbTag {
  id: number
  artifact_id: string
  key: string
  value: string | null
}
