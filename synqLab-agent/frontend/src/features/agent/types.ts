/**
 * Agent feature — shared TypeScript types.
 *
 * Mirrors the backend schemas from app/routers/agents.py.
 */

export type AgentEventType =
  | 'text_delta'
  | 'text_done'
  | 'tool_use_start'
  | 'tool_use_done'
  | 'tool_proposal'
  | 'checkpoint'
  | 'task_spawned'
  | 'task_updated'
  | 'task_completed'
  | 'turn_done'
  | 'session_done'
  | 'title_updated'
  | 'error'

export interface AgentEvent {
  type: AgentEventType
  content?: string
  tool_call_id?: string
  tool_name?: string
  arguments?: string
  result?: Record<string, unknown>
  success?: boolean
  error?: string
  message?: string
  reason?: string
  checkpoint_id?: string
  tool_calls_so_far?: number
  task?: AgentTask
  title?: string
}

export type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

export interface AgentTask {
  id: string
  parent_session_id: string
  agent_type: string
  goal: string
  state: TaskState
  result?: Record<string, unknown> | null
  error?: string | null
  created_at: string
  updated_at: string
}

export type AutonomyMode = 'copilot' | 'supervised' | 'autonomous'

export interface AgentSession {
  id: string
  agent_type: string
  title: string | null
  status: string
  autonomy_mode: AutonomyMode
  model: string
  total_input_tokens: number
  total_output_tokens: number
  total_tool_calls: number
  canvas_state?: { nodes: any[]; edges: any[]; name: string } | null
  created_at: string
  updated_at: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls: AgentToolCall[] | null
  tool_call_id: string | null
  tool_name: string | null
  created_at: string
}

export interface AgentToolCall {
  id: string
  function: {
    name: string
    arguments: string
  }
}

export interface CreateSessionRequest {
  agent_type?: string
  title?: string
  project_id?: string
  model?: string
  autonomy_mode?: AutonomyMode
  skill_id?: string
}

export interface SendMessageRequest {
  content: string
}

export interface AgentSkill {
  id: string
  name: string
  description: string
  version: string
  author: string | null
  tags: string[]
  agent_types: string[]
  tools: string[]
  autonomy_default: AutonomyMode
  body: string
  source: 'core' | 'user'
}

export type ArtifactType = 'markdown_report' | 'pdb_structure' | 'score_table' | 'sequence_fasta'
export type ArtifactScope = 'session' | 'project' | 'global'

export interface AgentArtifact {
  id: string
  session_id: string | null              // nullable for scope='global' / 'project'
  scope: ArtifactScope
  org_id?: string | null
  project_id?: string | null
  name: string
  artifact_type: ArtifactType
  content_type: string
  content?: string | null
  size_bytes: number | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

// ── Usage & Templates ─────────────────────────────────────────────────────

export interface UsageSummary {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  tool_calls: number
  estimated_cost_usd: number
  budget_limit?: number
  budget_used_ratio?: number
  status?: 'ok' | 'soft_limit' | 'hard_limit'
  model_breakdown?: Record<string, { input: number; output: number }>
}

export interface AgentTemplate {
  id: string
  name: string
  description: string
  agent_type: string
  skill_id: string | null
  autonomy_mode: string
  model: string
  icon: string
  tags: string[]
  source: 'core' | 'user'
  budget?: { session_limit: number; soft_ratio: number } | null
}
