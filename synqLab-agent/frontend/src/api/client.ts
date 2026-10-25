import type { Tool, Category, HealthMap, ComputeInfo, JobResult, PipelineResult, DAGPipelineRun, DbTableResponse, DbExperiment, DbToolRun, DbArtifact, DbTag } from '@/types'
import type { Org, Member, Invite, Team, TeamMember } from '@/features/organization/types'
import type { Project } from '@/features/projects/types'
import type { Session, Message, Participant } from '@/features/chat/types'
import type { AgentSession, AgentMessage, AgentEvent, AgentSkill, AgentArtifact, AgentTemplate, UsageSummary, CreateSessionRequest, SendMessageRequest } from '@/features/agent/types'
import type { PipelineTemplate, PipelineDef } from '@/features/lab/types'
import { apiFetch, getApiAuthToken } from '@/lib/api'

const BASE = ''  // same origin

async function get<T>(path: string): Promise<T> {
  const res = await apiFetch(BASE + path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(BASE + path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(BASE + path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(BASE + path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function del(path: string): Promise<void> {
  const res = await apiFetch(BASE + path, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export const api = {
  // ── Tools / Lab ──────────────────────────────────────────────────────────
  getTools: () => get<{ tools: Tool[] }>('/api/tools').then(d => d.tools),
  getAllTools: () => get<{ tools: Tool[] }>('/api/tools/all').then(d => d.tools),
  getCategories: () => get<{ categories: Category[] }>('/api/categories').then(d => d.categories),
  getAllCategories: () => get<{ categories: Category[] }>('/api/categories/all').then(d => d.categories),
  getHealth: () => get<{ tools: HealthMap }>('/api/health').then(d => d.tools),
  getCompute: () => get<ComputeInfo>('/api/compute'),

  getJob: (id: string) => get<JobResult>(`/api/jobs/${id}`),
  listPipelineRuns: () => get<DAGPipelineRun[]>('/api/pipelines/runs'),
  deleteExperiment: (id: string) => del(`/api/pipelines/runs/${id}`),
  getExperiment: (id: string) => get<PipelineResult>(`/api/experiments/${id}`),
  runTool: (tool_id: string, inputs: Record<string, unknown>) =>
    post<{ job_id: string }>('/api/run-tool', { tool_id, inputs }),
  runLegacyPipeline: (params: {
    n_sequences: number
    top_k: number
    plddt_threshold: number
    ddg_threshold: number
    use_reranker: boolean
    parent_sequence?: string
  }) => post<{ job_id: string }>('/api/run-pipeline', params),

  // DAG pipeline engine (MDMI-aligned)
  runDAGPipeline: (templateId: string, inputs: Record<string, unknown>) =>
    post<{ run_id: string; status: string }>(`/api/pipelines/${templateId}/run`, { inputs }),
  getDAGRun: (runId: string) =>
    get<{
      id: string
      status: string
      node_statuses: Record<string, string>
      results?: Record<string, unknown>
      error?: string
      round?: number
      max_rounds?: number
      rounds?: any[]
    }>(`/api/pipelines/runs/${runId}`),

  // ── Database browser ─────────────────────────────────────────────────────
  dbStatus: () => get<{ connected: boolean }>('/api/db/status'),
  dbExperiments: (limit = 100, offset = 0) =>
    get<DbTableResponse<DbExperiment>>(`/api/db/experiments?limit=${limit}&offset=${offset}`),
  dbToolRuns: (limit = 100, offset = 0, experimentId?: string) =>
    get<DbTableResponse<DbToolRun>>(
      `/api/db/tool_runs?limit=${limit}&offset=${offset}${experimentId ? `&experiment_id=${experimentId}` : ''}`
    ),
  dbArtifacts: (limit = 100, offset = 0, experimentId?: string) =>
    get<DbTableResponse<DbArtifact>>(
      `/api/db/artifacts?limit=${limit}&offset=${offset}${experimentId ? `&experiment_id=${experimentId}` : ''}`
    ),
  dbTags: (limit = 200, offset = 0, artifactId?: string) =>
    get<DbTableResponse<DbTag>>(
      `/api/db/tags?limit=${limit}&offset=${offset}${artifactId ? `&artifact_id=${artifactId}` : ''}`
    ),

  // ── Organizations ────────────────────────────────────────────────────────
  listOrgs: () => get<Org[]>('/api/orgs'),
  createOrg: (body: { name: string; slug: string }) =>
    post<Org>('/api/orgs', body),
  renameOrg: (orgId: string, name: string) =>
    patch<Org>(`/api/orgs/${orgId}`, { name }),
  removeOrgAvatar: (orgId: string) =>
    patch<Org>(`/api/orgs/${orgId}`, { avatar_url: null }),
  deleteOrg: (orgId: string) => del(`/api/orgs/${orgId}`),
  uploadOrgAvatar: async (orgId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiFetch(`/api/orgs/${orgId}/avatar-upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<Org>
  },

  // ── Org members ──────────────────────────────────────────────────────────
  listOrgMembers: (orgId: string) =>
    get<Member[]>(`/api/orgs/${orgId}/members`),
  updateMemberRole: (orgId: string, userId: string, role: string) =>
    patch<Member>(`/api/orgs/${orgId}/members/${userId}`, { role }),
  removeMember: (orgId: string, userId: string) =>
    del(`/api/orgs/${orgId}/members/${userId}`),

  // ── Org invites ──────────────────────────────────────────────────────────
  listOrgInvites: (orgId: string) =>
    get<Invite[]>(`/api/orgs/${orgId}/invitations`),
  createOrgInvite: (orgId: string, body: { role: string; email?: string }) =>
    post<Invite>(`/api/orgs/${orgId}/invitations`, body),
  deleteOrgInvite: (orgId: string, inviteId: string) =>
    del(`/api/orgs/${orgId}/invitations/${inviteId}`),
  previewInvite: (token: string) =>
    get<{ org_name: string; role: string; expires_at: string; valid: boolean }>(`/api/invite/${token}`),
  acceptInvite: (token: string) =>
    post<{ org_id: string; org_name: string; role: string }>(`/api/invite/${token}/accept`, {}),
  listMyInvites: () =>
    get<Array<{ id: string; org_id: string; org_name: string; role: string; direction: string; invitee_email: string | null; invite_url: string; created_at: string; expires_at: string; status: string }>>(
      '/api/my/invitations'
    ),
  acceptMyInvite: (inviteId: string) =>
    post<{ org_id: string; org_name: string; role: string }>(`/api/my/invitations/${inviteId}/accept`, {}),
  rejectMyInvite: async (inviteId: string) => {
    const res = await apiFetch(`/api/my/invitations/${inviteId}/reject`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  },

  // ── Teams ────────────────────────────────────────────────────────────────
  listTeams: (orgId: string) =>
    get<Team[]>(`/api/projects/org/${orgId}/teams`),
  createTeam: (orgId: string, body: { name: string; description?: string | null }) =>
    post<Team>(`/api/projects/org/${orgId}/teams`, body),
  updateTeam: (teamId: string, body: { name?: string; description?: string; avatar_url?: string | null }) =>
    patch<Team>(`/api/projects/teams/${teamId}`, body),
  renameTeam: (teamId: string, name: string) =>
    patch<Team>(`/api/projects/teams/${teamId}`, { name }),
  deleteTeam: (teamId: string) => del(`/api/projects/teams/${teamId}`),
  uploadTeamAvatar: async (teamId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiFetch(`/api/projects/teams/${teamId}/avatar-upload`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<Team>
  },
  listTeamMembers: (teamId: string) =>
    get<TeamMember[]>(`/api/projects/teams/${teamId}/members`),
  addTeamMember: (teamId: string, body: { user_id: string; role?: string }) =>
    post<TeamMember>(`/api/projects/teams/${teamId}/members`, body),
  removeTeamMember: (teamId: string, userId: string) =>
    del(`/api/projects/teams/${teamId}/members/${userId}`),

  // ── Projects ─────────────────────────────────────────────────────────────
  listProjects: (orgId: string) =>
    get<Project[]>(`/api/projects?org_id=${orgId}`),
  createProject: (body: { org_id: string; team_id: string; name: string; description?: string | null; visibility?: string }) =>
    post<Project>('/api/projects', body),
  getProject: (projectId: string) =>
    get<Project>(`/api/projects/${projectId}`),
  updateProject: (projectId: string, body: { status?: string; name?: string; description?: string }) =>
    patch<Project>(`/api/projects/${projectId}`, body),
  deleteProject: (projectId: string) => del(`/api/projects/${projectId}`),
  listProjectPipelines: (projectId: string) =>
    get<Array<{ id: string; project_id: string; name: string; description: string | null; current_version: number; is_public: boolean; created_by: string; created_at: string }>>(`/api/projects/${projectId}/pipelines`),
  createProjectPipeline: (projectId: string, body: { name: string }) =>
    post<{ id: string; project_id: string; name: string; description: string | null; current_version: number; is_public: boolean; created_by: string; created_at: string }>(`/api/projects/${projectId}/pipelines`, body),
  listProjectMembers: (projectId: string) =>
    get<Array<{ user_id: string; email: string; full_name: string; avatar_url: string | null; access_level: string; granted_at: string }>>(`/api/projects/${projectId}/members`),
  addProjectMember: (projectId: string, body: { user_id: string; access_level: string }) =>
    post<void>(`/api/projects/${projectId}/members`, body),
  removeProjectMember: (projectId: string, userId: string) =>
    del(`/api/projects/${projectId}/members/${userId}`),

  // ── Chat ─────────────────────────────────────────────────────────────────
  listChatSessions: (params?: { org_id?: string; project_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.org_id) qs.set('org_id', params.org_id)
    if (params?.project_id) qs.set('project_id', params.project_id)
    const q = qs.toString()
    return get<Session[]>(`/api/chat/sessions${q ? `?${q}` : ''}`)
  },
  createChatSession: (body: { org_id: string; kind: string; title?: string; participant_ids?: string[]; project_id?: string }) =>
    post<Session>('/api/chat/sessions', body),
  deleteChatSession: (sessionId: string) => del(`/api/chat/sessions/${sessionId}`),
  updateChatSession: (sessionId: string, body: { title?: string }) =>
    patch<Session>(`/api/chat/sessions/${sessionId}`, body),
  listChatMessages: (sessionId: string) =>
    get<Message[]>(`/api/chat/sessions/${sessionId}/messages`),
  sendChatMessage: (sessionId: string, body: { content: string }) =>
    post<Message>(`/api/chat/sessions/${sessionId}/messages`, body),
  listChatParticipants: (sessionId: string) =>
    get<Participant[]>(`/api/chat/sessions/${sessionId}/participants`),
  addChatParticipant: (sessionId: string, body: { user_id: string }) =>
    post<void>(`/api/chat/sessions/${sessionId}/participants`, body),
  removeChatParticipant: (sessionId: string, userId: string) =>
    del(`/api/chat/sessions/${sessionId}/participants/${userId}`),

  // ── People ───────────────────────────────────────────────────────────────
  searchPeople: (orgId: string, query = '', limit = 15) =>
    get<Array<{ id: string; email: string; full_name: string; avatar_url: string | null; role?: string }>>(
      `/api/people/org/${orgId}/search?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  // ── Agent Sessions ──────────────────────────────────────────────────────
  createAgentSession: (body: CreateSessionRequest) =>
    post<AgentSession>('/api/agents/sessions', body),
  listAgentSessions: (projectId?: string) =>
    get<AgentSession[]>(`/api/agents/sessions${projectId ? `?project_id=${projectId}` : ''}`),
  getAgentSession: (id: string) =>
    get<{ session: AgentSession; messages: AgentMessage[] }>(`/api/agents/sessions/${id}`),
  deleteAgentSession: (id: string) =>
    del(`/api/agents/sessions/${id}`),
  saveCanvasState: (sessionId: string, canvasState: { nodes: any[]; edges: any[]; name: string }) =>
    patch<{ status: string }>(`/api/agents/sessions/${sessionId}/canvas`, { canvas_state: canvasState }),
  sendAgentMessage: (sessionId: string, body: SendMessageRequest) =>
    post<{ events: AgentEvent[] }>(`/api/agents/sessions/${sessionId}/message`, body),

  // ── Skills ────────────────────────────────────────────────────────────
  listSkills: (query?: string, agentType?: string) => {
    const params = new URLSearchParams()
    if (query) params.set('query', query)
    if (agentType) params.set('agent_type', agentType)
    const qs = params.toString()
    return get<AgentSkill[]>(`/api/skills/${qs ? `?${qs}` : ''}`)
  },
  getSkill: (id: string) =>
    get<AgentSkill>(`/api/skills/${id}`),
  createSkill: (body: Partial<AgentSkill>) =>
    post<AgentSkill>('/api/skills/', body),
  deleteSkill: (id: string) =>
    del(`/api/skills/${id}`),

  // ── Artifacts ──────────────────────────────────────────────────────────
  listArtifacts: (sessionId: string) =>
    get<AgentArtifact[]>(`/api/agents/sessions/${sessionId}/artifacts`),
  getArtifact: (sessionId: string, artifactId: string) =>
    get<AgentArtifact>(`/api/agents/sessions/${sessionId}/artifacts/${artifactId}`),
  uploadArtifact: async (sessionId: string, file: File): Promise<AgentArtifact> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiFetch(BASE + `/api/agents/sessions/${sessionId}/artifacts`, {
      method: 'POST',
      body: fd,
      // DO NOT set Content-Type — browser sets multipart boundary automatically.
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(detail || `HTTP ${res.status}`)
    }
    return res.json() as Promise<AgentArtifact>
  },
  promoteArtifact: (artifactId: string) =>
    post<{ artifact_id: string; scope: 'project'; project_id: string }>(
      `/api/agents/artifacts/${artifactId}/promote`, {},
    ),
  listDatasets: (projectId: string) =>
    get<AgentArtifact[]>(`/api/agents/datasets?project_id=${encodeURIComponent(projectId)}`),

  // ── Pipelines ─────────────────────────────────────────────────────────
  listPipelineTemplates: () =>
    get<PipelineTemplate[]>('/api/pipelines/templates'),
  listCustomPipelines: () =>
    get<PipelineTemplate[]>('/api/pipelines/custom'),
  createPipeline: (pipeline: { id?: string; name: string; description: string; nodes: any[] }) =>
    post<PipelineTemplate>('/api/pipelines', pipeline),
  getPipeline: (id: string) =>
    get<PipelineDef>(`/api/pipelines/${id}`),
  savePipeline: (id: string, pipeline: PipelineDef) =>
    put<{ id: string; version: number }>(`/api/pipelines/${id}`, pipeline),
  deletePipeline: (id: string) => del(`/api/pipelines/${id}`),
  renamePipeline: (id: string, name: string) =>
    patch<{ id: string; name: string; status: string }>(`/api/pipelines/${id}`, { name }),

  // ── Agent Templates ──────────────────────────────────────────────────────
  listAgentTemplates: () =>
    get<AgentTemplate[]>('/api/agents/templates'),
  getAgentTemplate: (id: string) =>
    get<AgentTemplate>(`/api/agents/templates/${id}`),

  // ── Usage ─────────────────────────────────────────────────────────────
  getSessionUsage: (sessionId: string) =>
    get<UsageSummary>(`/api/agents/sessions/${sessionId}/usage`),

  // ── Storage browser ──────────────────────────────────────────────────
  browseStorage: (path: string = '') => {
    const qs = path ? `?namespace=${encodeURIComponent(path.split('/')[0])}&path=${encodeURIComponent(path.split('/').slice(1).join('/'))}` : ''
    return get<StorageBrowseResponse>(`/api/storage/browse${qs}`)
  },
  browseStorageRaw: (namespace: string = '', subPath: string = '') => {
    const params = new URLSearchParams()
    if (namespace) params.set('namespace', namespace)
    if (subPath) params.set('path', subPath)
    const qs = params.toString()
    return get<StorageBrowseResponse>(`/api/storage/browse${qs ? '?' + qs : ''}`)
  },
  downloadStorageUrl: (filePath: string) => {
    const base = `${BASE}/api/storage/download?path=${encodeURIComponent(filePath)}`
    const token = getApiAuthToken()
    return token ? `${base}&token=${encodeURIComponent(token)}` : base
  },

  // ── Training / Brightness ─────────────────────────────────────────────
  trainingListModels: () =>
    get<{ models: Array<{ version: string; feature_mode: string; n_train: number | null; tau: number | null; trained_at: string | null; path: string; is_active: boolean }> }>('/api/training/brightness/models').then(d => d.models),
  trainingUpload: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiFetch(BASE + '/api/training/brightness/upload', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  },
  trainingTrain: (body: { dataset_path: string; sequence_column: string; label_column: string; feature_mode: string }) =>
    post<{ job_id: string }>('/api/training/brightness/train', body),
  trainingStatus: (jobId: string) =>
    get<{ status: string; progress: string; model_version: string | null; error?: string | null; metrics?: Record<string, unknown> | null }>(`/api/training/brightness/status/${jobId}`),
  trainingDeploy: (version: string) =>
    post<void>('/api/training/brightness/deploy', { version }),

  // ── Database browser ──────────────────────────────────────────────────
  dbListTables: () =>
    get<Array<{ name: string; row_count: number }>>('/api/database/tables'),
  dbGetTable: (table: string) =>
    get<{ columns: Array<{ name: string; type: string }> }>(`/api/database/tables/${table}`),
  dbGetRows: (table: string) =>
    get<{ rows: Record<string, unknown>[] }>(`/api/database/tables/${table}/rows`),
  dbGetSchemaMap: () =>
    get<Record<string, unknown>>('/api/database/schema-map'),
}

export interface StorageEntry {
  name: string
  display_name?: string
  is_dir: boolean
  size: number | null
  modified: string
  path: string
}

export interface StorageBrowseResponse {
  entries: StorageEntry[]
  namespace: string
  path: string
}

export async function pollJob(
  jobId: string,
  intervalMs = 1500,
  timeoutMs = 7_200_000,
): Promise<JobResult> {
  const deadline = Date.now() + timeoutMs
  let interval = intervalMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval))
    const job = await api.getJob(jobId)
    if (job.status === 'completed' || job.status === 'failed') return job
    interval = Math.min(interval * 1.2, 5000)
  }
  return { status: 'failed', error: 'Timed out waiting for job result.' }
}
