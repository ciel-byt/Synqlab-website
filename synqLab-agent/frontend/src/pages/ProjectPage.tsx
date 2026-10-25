import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot,
  Building2,
  ChevronDown,
  FlaskConical,
  GitBranch,
  Globe,
  Lock,
  MessageSquare,
  Plus,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { api } from '@/api/client'
import type { Org } from '@/features/organization/types'

import type { Project } from '@/features/projects/types'
import { PROJECT_STATUS_OPTIONS } from '@/features/projects/types'
import { relativeTime, statusVariant, initials } from '@/features/projects/helpers'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserPicker, type PickedUser } from '@/components/shared/UserPicker'

// ── Types (page-specific) ─────────────────────────────────────────────────────

interface Pipeline {
  id: string
  project_id: string
  name: string
  description: string | null
  current_version: number
  is_public: boolean
  created_by: string
  created_at: string
}

interface ProjectMember {
  user_id: string
  email: string
  full_name: string
  avatar_url: string | null
  access_level: string
  granted_at: string
}

interface ProjectChat {
  id: string
  org_id: string
  kind: 'ai' | 'dm' | 'group'
  title: string | null
  updated_at: string
  participant_ids: string[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [projectOrg, setProjectOrg] = useState<Org | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [chats, setChats] = useState<ProjectChat[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [newPipelineName, setNewPipelineName] = useState('')
  const [showNewPipeline, setShowNewPipeline] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

  async function loadProjectData(targetProjectId: string) {
    setLoading(true)
    setError(null)
    try {
      const proj = await api.getProject(targetProjectId)
      setProject(proj)

      const [pipes, mems, orgs, chts] = await Promise.all([
        api.listProjectPipelines(targetProjectId),
        api.listProjectMembers(targetProjectId),
        api.listOrgs(),
        api.listChatSessions({ org_id: proj.org_id, project_id: targetProjectId }),
      ])

      setPipelines(pipes as Pipeline[])
      setMembers(mems as ProjectMember[])
      setProjectOrg(orgs.find(o => o.id === proj.org_id) ?? null)
      setChats(chts as ProjectChat[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectId) return
    void loadProjectData(projectId)
  }, [projectId])

  async function addMember(user: PickedUser) {
    if (!projectId) return
    try {
      await api.addProjectMember(projectId, { user_id: user.id, access_level: 'read' })
      setMembers(await api.listProjectMembers(projectId) as ProjectMember[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    }
    setShowAddMember(false)
  }

  async function createPipeline(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !newPipelineName.trim()) return
    setCreating(true)
    try {
      const pipe = await api.createProjectPipeline(projectId, { name: newPipelineName })
      setPipelines(prev => [pipe as Pipeline, ...prev])
      setNewPipelineName('')
      setShowNewPipeline(false)
    } catch {}
    finally { setCreating(false) }
  }

  async function updateStatus(nextStatus: string) {
    if (!projectId || !project) return
    setSavingStatus(true)
    try {
      const updated = await api.updateProject(projectId, { status: nextStatus })
      setProject(prev => (prev ? { ...prev, status: updated.status, updated_at: updated.updated_at } : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project status')
    } finally {
      setSavingStatus(false)
    }
  }

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-muted-foreground/70">Loading…</div>
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 h-full">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    )
  }

  const filteredMembers = members.filter(member => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    )
  })

  const existingMemberIds = members.map(member => member.user_id)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 max-w-5xl mx-auto flex flex-col h-full overflow-y-auto w-full">

      {/* Back button */}
      <button
        onClick={() => navigate('/workspace/projects')}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to projects
      </button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Project header card ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-foreground truncate">{project.name}</h1>
              {project.description && <p className="mt-1.5 text-sm text-muted-foreground">{project.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {projectOrg?.avatar_url ? (
                    <img src={projectOrg.avatar_url} alt={projectOrg.name} className="h-4 w-4 rounded-full object-cover mr-1" />
                  ) : (
                    <Building2 size={11} className="mr-1" />
                  )}
                  {projectOrg?.name ?? 'Organization'}
                </Badge>
                <Badge variant="outline">
                  <Users size={11} className="mr-1" />
                  {project.team_name ?? 'Team not assigned'}
                </Badge>
                {project.visibility === 'private' ? (
                  <Badge variant="outline"><Lock size={11} className="mr-1" /> Private</Badge>
                ) : (
                  <Badge variant="secondary"><Globe size={11} className="mr-1" /> {project.visibility}</Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="cursor-pointer" disabled={savingStatus}>
                      <Badge variant={statusVariant(project.status)} className="capitalize">
                        {project.status}
                        <ChevronDown size={10} className="ml-1 opacity-50" />
                      </Badge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {PROJECT_STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        className="capitalize"
                        onClick={() => void updateStatus(status)}
                      >
                        {status}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddMember(v => !v)}>
              <Users size={12} className="mr-1.5" />
              Add member
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Members ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="text-sm">Members</CardTitle>
              <CardDescription>Project members with access</CardDescription>
            </div>
            <Badge variant="secondary">{members.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddMember && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Search from all users in this organization</p>
              <UserPicker
                orgId={project.org_id}
                onSelect={addMember}
                excluded={existingMemberIds}
                placeholder="Search organization users by name or email…"
              />
            </div>
          )}

          <Input
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="Filter current project members…"
          />

          {filteredMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground text-center">
              No members found.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {filteredMembers.map(member => (
                <div key={member.user_id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} />
                    <AvatarFallback className="text-xs">{initials(member.full_name || member.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{member.full_name || member.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{member.access_level}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Chats ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="min-w-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-muted-foreground/70" />
                Project chats
              </CardTitle>
              <CardDescription>Conversations and AI sessions tied to this project</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate(`/chat?project_id=${projectId}&org_id=${project.org_id}`)}>
              <Plus size={12} className="mr-1.5" />
              Start chat
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No chats linked to this project yet.{' '}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => navigate(`/chat?project_id=${projectId}&org_id=${project.org_id}`)}
              >
                Start one
              </Button>
              .
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {chats.map(chat => {
                const title = chat.title || (chat.kind === 'ai' ? 'AI Assistant' : chat.kind === 'dm' ? 'Direct message' : 'Group chat')
                const Icon = chat.kind === 'ai' ? Bot : chat.kind === 'dm' ? UserIcon : Users
                return (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    className="flex w-full items-center gap-3 px-4 py-3 h-auto justify-start rounded-none"
                    onClick={() => navigate(`/chat?session_id=${chat.id}`)}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${chat.kind === 'ai' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-foreground truncate">{title}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {chat.kind === 'ai' ? 'AI assistant' : chat.kind === 'dm' ? 'Direct message' : `Group · ${chat.participant_ids.length} people`}
                        {' · '}{relativeTime(chat.updated_at)}
                      </p>
                    </div>
                  </Button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pipelines ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 w-full">
            <CardTitle className="text-sm">Pipelines</CardTitle>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => setShowNewPipeline(v => !v)}>
              <Plus size={12} className="mr-1.5" />
              Add pipeline
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNewPipeline && (
            <form onSubmit={createPipeline} className="flex gap-2">
              <Input
                value={newPipelineName}
                onChange={e => setNewPipelineName(e.target.value)}
                placeholder="Pipeline name…"
                required
                className="flex-1"
              />
              <Button type="submit" disabled={creating} size="sm">
                {creating ? '…' : 'Create'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewPipeline(false)}>
                Cancel
              </Button>
            </form>
          )}

          {pipelines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 rounded-xl border border-dashed border-border">
              <GitBranch size={22} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground/70">No pipelines yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pipelines.map(pl => (
                <div
                  key={pl.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <FlaskConical size={14} className="text-muted-foreground/70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{pl.name}</p>
                    {pl.description && <p className="text-xs text-muted-foreground/70 truncate">{pl.description}</p>}
                  </div>
                  <Badge variant="secondary">v{pl.current_version}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
