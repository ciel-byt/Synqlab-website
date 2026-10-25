/**
 * useWorkspaceData — consolidated data hook for the Workspace page.
 *
 * Merges useOrgData (org/team/member/invite CRUD) with ProjectsPage
 * inline data fetching (projects by org/team scope).
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '@/api/client'
import { apiFetch, setApiOrgId } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/sonner'

import type { Org, Member, Invite, Team, TeamMember, Project, WorkspaceTab } from '../types'
import { useWorkspaceMutations } from './useWorkspaceMutations'

export function useWorkspaceData() {
  const { user } = useAuth()

  /* ── Core entity state ──────────────────────────────────────────────── */
  const [orgs, setOrgs] = useState<Org[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string>('')
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [invites, setInvites] = useState<Record<string, Invite[]>>({})
  const [teams, setTeams] = useState<Record<string, Team[]>>({})
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({})
  const [projects, setProjects] = useState<Project[]>([])

  const [loading, setLoading] = useState(true)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('projects')

  /* ── Derived: active org ────────────────────────────────────────────── */
  const activeOrg = useMemo(() => orgs.find((o) => o.id === activeOrgId) ?? null, [orgs, activeOrgId])
  const activeMembers = useMemo(() => members[activeOrgId] ?? [], [members, activeOrgId])
  const activeTeams = useMemo(() => teams[activeOrgId] ?? [], [teams, activeOrgId])
  const activeInvites = useMemo(() => invites[activeOrgId] ?? [], [invites, activeOrgId])

  /* ── Modal state (carried over from useOrgData) ─────────────────────── */
  const [newOrgOpen, setNewOrgOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')

  const [newTeamCtx, setNewTeamCtx] = useState<{ orgId: string } | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  const [inviteCtx, setInviteCtx] = useState<{ orgId: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'guest'>('member')

  const [renameCtx, setRenameCtx] = useState<
    | { kind: 'org'; orgId: string; current: string }
    | { kind: 'team'; orgId: string; teamId: string; current: string }
    | null
  >(null)
  const [renameValue, setRenameValue] = useState('')

  const [deleteCtx, setDeleteCtx] = useState<
    | { kind: 'org'; orgId: string; label: string }
    | { kind: 'team'; orgId: string; teamId: string; label: string }
    | { kind: 'member'; orgId: string; userId: string; label: string }
    | { kind: 'invite'; orgId: string; inviteId: string; label: string }
    | null
  >(null)

  const [addMemberCtx, setAddMemberCtx] = useState<{ orgId: string; teamId: string } | null>(null)
  const [addMemberRole, setAddMemberRole] = useState<'member' | 'lead'>('member')
  const [addMemberPicks, setAddMemberPicks] = useState<string[]>([])
  const [assignTeamsCtx, setAssignTeamsCtx] = useState<{
    orgId: string; userId: string; userLabel: string
  } | null>(null)
  const [assignTeamsSelected, setAssignTeamsSelected] = useState<string[]>([])
  const [assignTeamsRoles, setAssignTeamsRoles] = useState<Record<string, 'member' | 'lead'>>({})
  const [assignTeamsSaving, setAssignTeamsSaving] = useState(false)

  // Avatar picker
  const [avatarPickerCtx, setAvatarPickerCtx] = useState<{ kind: 'org' | 'team', orgId: string, teamId?: string } | null>(null)
  const [pendingOrgAvatarOrgId, setPendingOrgAvatarOrgId] = useState<string | null>(null)
  const [pendingTeamAvatar, setPendingTeamAvatar] = useState<{ orgId: string; teamId: string } | null>(null)

  // Project create modal
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectModalPrefill, setProjectModalPrefill] = useState<{ orgId?: string; teamId?: string | null }>({})

  const orgAvatarInputRef = useRef<HTMLInputElement>(null)
  const teamAvatarInputRef = useRef<HTMLInputElement>(null)

  /* ── Sync org ID to API layer ─────────────────────────────────────────── */
  useEffect(() => {
    setApiOrgId(activeOrgId || null)
  }, [activeOrgId])

  /* ── Data fetching ──────────────────────────────────────────────────── */
  useEffect(() => { void loadRoot() }, [])

  // NOTE: removed 10-second polling and window-focus refresh to avoid
  // constant API chatter across all pages. Data loads on mount and when
  // activeOrgId changes. Workspace views can call loadOrgChildren()
  // explicitly after mutations.

  // Load projects when org changes
  useEffect(() => {
    if (activeOrgId) void loadProjects(activeOrgId)
  }, [activeOrgId])

  async function loadRoot() {
    setLoading(true)
    try {
      const list = await api.listOrgs()
      setOrgs(list)
      if (list.length > 0) {
        const first = list[0]
        setActiveOrgId(first.id)
        await loadOrgChildren(first.id)
        void Promise.allSettled(
          list.filter((o) => o.id !== first.id).map((o) => loadOrgChildren(o.id)),
        )
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  async function loadOrgChildren(orgId: string) {
    const [membersRes, teamsRes, invitesRes] = await Promise.allSettled([
      api.listOrgMembers(orgId),
      api.listTeams(orgId),
      api.listOrgInvites(orgId),
    ])

    if (membersRes.status === 'fulfilled') {
      setMembers((prev) => ({ ...prev, [orgId]: membersRes.value }))
    }
    if (teamsRes.status === 'fulfilled') {
      const t = teamsRes.value
      setTeams((prev) => ({ ...prev, [orgId]: t }))
      void (async () => {
        const detailRows = await Promise.allSettled(
          t.map(async (team) => ({
            teamId: team.id,
            members: await api.listTeamMembers(team.id),
          })),
        )
        setTeamMembers((prev) => {
          const next = { ...prev }
          for (const row of detailRows) {
            if (row.status === 'fulfilled') next[row.value.teamId] = row.value.members
          }
          return next
        })
      })()
    }
    if (invitesRes.status === 'fulfilled') {
      setInvites((prev) => ({ ...prev, [orgId]: invitesRes.value }))
    } else {
      setInvites((prev) => ({ ...prev, [orgId]: [] }))
    }
  }

  async function loadTeamMembers(teamId: string) {
    try {
      const list = await api.listTeamMembers(teamId)
      setTeamMembers((prev) => ({ ...prev, [teamId]: list }))
    } catch (err) {
      toast.error((err as Error).message || 'Failed to load team members')
    }
  }

  async function loadProjects(orgId: string) {
    setProjectsLoading(true)
    try {
      const res = await apiFetch(`/api/projects?org_id=${orgId}`)
      const data: Project[] = await res.json()
      setProjects(data)
    } catch {
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }

  /* ── Derived ────────────────────────────────────────────────────────── */
  const addableMembers = useMemo(() => {
    if (!addMemberCtx) return []
    return (members[addMemberCtx.orgId] ?? []).filter(
      (m) => !(teamMembers[addMemberCtx.teamId] ?? []).some((tm) => tm.user_id === m.user_id),
    )
  }, [addMemberCtx, members, teamMembers])

  /* ── Extract Mutations ──────────────────────────────────────────────── */
  const stateSnapshot = {
    orgs, setOrgs, setActiveOrgId,
    newOrgName, newOrgSlug, setNewOrgOpen, setNewOrgName, setNewOrgSlug,
    newTeamCtx, newTeamName, newTeamDesc, setNewTeamCtx, setNewTeamName, setNewTeamDesc,
    inviteCtx, inviteEmail, inviteRole, setInvites, setInviteCtx, setInviteEmail, setInviteRole,
    renameCtx, renameValue, setTeams, setRenameCtx, setRenameValue,
    deleteCtx, activeOrgId, setDeleteCtx, setMembers,
    addMemberCtx, addMemberPicks, addMemberRole, teamMembers, setTeamMembers, setAddMemberCtx, setAddMemberPicks, setAddMemberRole,
    assignTeamsCtx, assignTeamsSelected, assignTeamsRoles, setAssignTeamsSaving, setAssignTeamsCtx,
    pendingOrgAvatarOrgId, pendingTeamAvatar, setPendingOrgAvatarOrgId, setPendingTeamAvatar,
    orgAvatarInputRef, teamAvatarInputRef, setAvatarPickerCtx,
    setProjects, setShowProjectModal, loadOrgChildren, loadTeamMembers, teams
  }
  const mutations = useWorkspaceMutations(stateSnapshot)

  /* ── Return ─────────────────────────────────────────────────────────── */
  return {
    user,
    // Core data
    orgs, activeOrgId, setActiveOrgId, activeOrg,
    members, teams, invites, teamMembers,
    activeMembers, activeTeams, activeInvites,
    projects, projectsLoading,
    loading,
    // Tab
    activeTab, setActiveTab,
    // Addable members
    addableMembers,
    // Modal state
    newOrgOpen, setNewOrgOpen, newOrgName, setNewOrgName, newOrgSlug, setNewOrgSlug,
    newTeamCtx, setNewTeamCtx, newTeamName, setNewTeamName, newTeamDesc, setNewTeamDesc,
    inviteCtx, setInviteCtx, inviteEmail, setInviteEmail, inviteRole, setInviteRole,
    renameCtx, setRenameCtx, renameValue, setRenameValue,
    deleteCtx, setDeleteCtx,
    addMemberCtx, setAddMemberCtx, addMemberRole, setAddMemberRole,
    addMemberPicks, setAddMemberPicks,
    assignTeamsCtx, setAssignTeamsCtx,
    assignTeamsSelected, setAssignTeamsSelected,
    assignTeamsRoles, setAssignTeamsRoles,
    assignTeamsSaving,
    pendingOrgAvatarOrgId, pendingTeamAvatar,
    showProjectModal, setShowProjectModal,
    projectModalPrefill, setProjectModalPrefill,
    // Avatar picker
    avatarPickerCtx, setAvatarPickerCtx,
    // Refs
    orgAvatarInputRef, teamAvatarInputRef,
    // Actions
    ...mutations,
    loadProjects,
  }
}
