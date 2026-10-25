/**
 * Organization data hook — all state, effects, actions, and menu builders.
 * Extracted from OrganizationPage.tsx.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  Building2,
  MailPlus,
  Pencil,
  Shield,
  ShieldCheck,
  Trash2,
  UserCircle2,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/sonner'

import type { Org, Member, Invite, Team, TeamMember, Selection, ContextMenuItem } from '../types'
import { slugify } from '../helpers'

export function useOrgData() {
  const { user } = useAuth()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [invites, setInvites] = useState<Record<string, Invite[]>>({})
  const [teams, setTeams] = useState<Record<string, Team[]>>({})
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({})

  const [loading, setLoading] = useState(true)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Selection>(null)
  const [search, setSearch] = useState('')
  const [orgSort, setOrgSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc')

  // Ã¢â€â‚¬Ã¢â€â‚¬ Modals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
    orgId: string
    userId: string
    userLabel: string
  } | null>(null)
  const [assignTeamsSelected, setAssignTeamsSelected] = useState<string[]>([])
  const [assignTeamsRoles, setAssignTeamsRoles] = useState<Record<string, 'member' | 'lead'>>({})
  const [assignTeamsSaving, setAssignTeamsSaving] = useState(false)
  const [pendingOrgAvatarOrgId, setPendingOrgAvatarOrgId] = useState<string | null>(null)
  const [pendingTeamAvatar, setPendingTeamAvatar] = useState<{ orgId: string; teamId: string } | null>(null)

  const orgAvatarInputRef = useRef<HTMLInputElement>(null)
  const teamAvatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadRoot()
  }, [])

  useEffect(() => {
    function onFocusRefresh() {
      if (orgs.length === 0) return
      void Promise.allSettled(
        orgs.map(async (o) => {
          await loadOrgChildren(o.id)
        }),
      )
    }
    window.addEventListener('focus', onFocusRefresh)
    return () => window.removeEventListener('focus', onFocusRefresh)
  }, [orgs])

  useEffect(() => {
    const selectedOrgId = selection && 'orgId' in selection ? selection.orgId : null
    if (!selectedOrgId) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadOrgChildren(selectedOrgId)
    }, 10_000)
    return () => window.clearInterval(id)
  }, [selection])

  async function loadRoot() {
    setLoading(true)
    try {
      const list = await api.listOrgs()
      setOrgs(list)
      if (list.length > 0) {
        const first = list[0]
        setExpanded(new Set([first.id]))
        setSelection({ kind: 'org', orgId: first.id })
        await loadOrgChildren(first.id)
        // Warm counts for all org rows so Teams/People/Invites stay current in the sidebar.
        void Promise.allSettled(
          list
            .filter((o) => o.id !== first.id)
            .map(async (o) => {
              await loadOrgChildren(o.id)
            }),
        )
      }
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to load organizations')
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
            if (row.status === 'fulfilled') {
              next[row.value.teamId] = row.value.members
            }
          }
          return next
        })
      })()
    }
    // Invites are admin-only; for member users we keep it empty without error noise.
    if (invitesRes.status === 'fulfilled') {
      setInvites((prev) => ({ ...prev, [orgId]: invitesRes.value }))
    } else {
      setInvites((prev) => ({ ...prev, [orgId]: [] }))
    }

    if (membersRes.status === 'rejected' || teamsRes.status === 'rejected') {
      const msg =
        membersRes.status === 'rejected'
          ? membersRes.reason instanceof Error
            ? membersRes.reason.message
            : 'Failed to load members'
          : teamsRes.status === 'rejected'
            ? teamsRes.reason instanceof Error
              ? teamsRes.reason.message
              : 'Failed to load teams'
            : 'Failed to load organization details'
      showToast('error', msg)
    }
  }

  async function loadTeamMembers(teamId: string) {
    try {
      const list = await api.listTeamMembers(teamId)
      setTeamMembers((prev) => ({ ...prev, [teamId]: list }))
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to load team members')
    }
  }



  // Ã¢â€â‚¬Ã¢â€â‚¬ Selection + expansion Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  function toggleExpand(key: string, loadOrg?: string, loadTeam?: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else {
        next.add(key)
        if (loadOrg && !members[loadOrg]) void loadOrgChildren(loadOrg)
        if (loadTeam && !teamMembers[loadTeam]) void loadTeamMembers(loadTeam)
      }
      return next
    })
  }

  function select(sel: Selection) {
    setSelection(sel)
    if (sel?.kind === 'org' && !members[sel.orgId]) void loadOrgChildren(sel.orgId)
    if (sel?.kind === 'team' && !teamMembers[sel.teamId]) void loadTeamMembers(sel.teamId)
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Actions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  function showToast(type: 'success' | 'error', message: string) {
    if (type === 'success') toast.success(message)
    else toast.error(message)
  }

  async function createOrg(ev: FormEvent) {
    ev.preventDefault()
    if (!newOrgName.trim()) return
    const proposedName = newOrgName.trim()
    const nameTaken = orgs.some((o) => o.name.trim().toLowerCase() === proposedName.toLowerCase())
    if (nameTaken) {
      showToast('error', 'Organization name already exists. Choose a different name.')
      return
    }
    const proposedSlug = (newOrgSlug.trim() || slugify(proposedName)).toLowerCase()
    const slugTaken = orgs.some((o) => o.slug.toLowerCase() === proposedSlug)
    if (slugTaken) {
      showToast('error', 'Organization already exists. Choose a different name or custom slug.')
      return
    }
    try {
      const org = await api.createOrg({
        name: proposedName,
        slug: proposedSlug,
      })
      setOrgs((prev) => [...prev, org])
      setNewOrgOpen(false)
      setNewOrgName('')
      setNewOrgSlug('')
      setExpanded((prev) => new Set([...prev, org.id]))
      setSelection({ kind: 'org', orgId: org.id })
      void loadOrgChildren(org.id)
      showToast('success', `Organization Ã¢â‚¬Å“${org.name}Ã¢â‚¬Â created`)
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to create organization')
    }
  }

  async function createTeam(ev: FormEvent) {
    ev.preventDefault()
    if (!newTeamCtx || !newTeamName.trim()) return
    try {
      const team = await api.createTeam(newTeamCtx.orgId, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || null,
      })
      setTeams((prev) => ({
        ...prev,
        [newTeamCtx.orgId]: [...(prev[newTeamCtx.orgId] ?? []), team],
      }))
      setExpanded((prev) => new Set([...prev, `teams:${newTeamCtx.orgId}`, `team:${team.id}`]))
      setSelection({ kind: 'team', orgId: newTeamCtx.orgId, teamId: team.id })
      void loadTeamMembers(team.id)
      setNewTeamCtx(null)
      setNewTeamName('')
      setNewTeamDesc('')
      showToast('success', `Team Ã¢â‚¬Å“${team.name}Ã¢â‚¬Â created`)
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to create team')
    }
  }

  async function sendInvite(ev: FormEvent) {
    ev.preventDefault()
    if (!inviteCtx) return
    try {
      const inv = await api.createOrgInvite(inviteCtx.orgId, {
        role: inviteRole,
        email: inviteEmail.trim() || undefined,
      })
      setInvites((prev) => ({ ...prev, [inviteCtx.orgId]: [inv, ...(prev[inviteCtx.orgId] ?? [])] }))
      setExpanded((prev) => new Set([...prev, `invites:${inviteCtx.orgId}`]))
      setSelection({ kind: 'invites-folder', orgId: inviteCtx.orgId })
      try {
        await navigator.clipboard.writeText(inv.invite_url)
        showToast('success', 'Invite created Ã¢â‚¬â€ link copied to clipboard')
      } catch {
        showToast('success', 'Invite created')
      }
      setInviteCtx(null)
      setInviteEmail('')
      setInviteRole('member')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to create invite')
    }
  }

  async function commitRename(ev: FormEvent) {
    ev.preventDefault()
    if (!renameCtx || !renameValue.trim()) return
    try {
      if (renameCtx.kind === 'org') {
        const updated = await api.renameOrg(renameCtx.orgId, renameValue.trim())
        setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
        showToast('success', 'Organization renamed')
      } else {
        const updated = await api.renameTeam(renameCtx.teamId, renameValue.trim())
        setTeams((prev) => ({
          ...prev,
          [renameCtx.orgId]: (prev[renameCtx.orgId] ?? []).map((t) => (t.id === updated.id ? updated : t)),
        }))
        showToast('success', 'Team renamed')
      }
      setRenameCtx(null)
      setRenameValue('')
    } catch (err) {
      showToast('error', (err as Error).message || 'Rename failed')
    }
  }

  async function commitDelete() {
    if (!deleteCtx) return
    try {
      if (deleteCtx.kind === 'org') {
        await api.deleteOrg(deleteCtx.orgId)
        setOrgs((prev) => prev.filter((o) => o.id !== deleteCtx.orgId))
        if (selection?.kind !== null && (selection as any)?.orgId === deleteCtx.orgId) setSelection(null)
        showToast('success', 'Organization deleted')
      } else if (deleteCtx.kind === 'team') {
        await api.deleteTeam(deleteCtx.teamId)
        setTeams((prev) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((t) => t.id !== deleteCtx.teamId),
        }))
        if (selection?.kind === 'team' && selection.teamId === deleteCtx.teamId) {
          setSelection({ kind: 'teams-folder', orgId: deleteCtx.orgId })
        }
        showToast('success', 'Team deleted')
      } else if (deleteCtx.kind === 'member') {
        await api.removeMember(deleteCtx.orgId, deleteCtx.userId)
        setMembers((prev) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((m) => m.user_id !== deleteCtx.userId),
        }))
        if (selection?.kind === 'member' && selection.userId === deleteCtx.userId) {
          setSelection({ kind: 'people-folder', orgId: deleteCtx.orgId })
        }
        showToast('success', 'Member removed')
      } else if (deleteCtx.kind === 'invite') {
        await api.deleteOrgInvite(deleteCtx.orgId, deleteCtx.inviteId)
        setInvites((prev) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((i) => i.id !== deleteCtx.inviteId),
        }))
        showToast('success', 'Invite revoked')
      }
      setDeleteCtx(null)
    } catch (err) {
      showToast('error', (err as Error).message || 'Delete failed')
    }
  }

  async function changeMemberRole(orgId: string, userId: string, role: string) {
    try {
      const updated = await api.updateMemberRole(orgId, userId, role)
      setMembers((prev) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((m) => (m.user_id === userId ? updated : m)),
      }))
      showToast('success', `Role updated to ${role}`)
    } catch (err) {
      showToast('error', (err as Error).message || 'Role update failed')
    }
  }

  async function commitAddTeamMember(ev: FormEvent) {
    ev.preventDefault()
    if (!addMemberCtx || addMemberPicks.length === 0) return
    try {
      const selectedIds = [...addMemberPicks]
      const results = await Promise.allSettled(
        selectedIds.map((userId) =>
          api.addTeamMember(addMemberCtx.teamId, {
            user_id: userId,
            role: addMemberRole,
          }),
        ),
      )
      const added = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof api.addTeamMember>>> => r.status === 'fulfilled')
        .map((r) => r.value)
      setTeamMembers((prev) => ({
        ...prev,
        [addMemberCtx.teamId]: [...(prev[addMemberCtx.teamId] ?? []), ...added],
      }))
      setTeams((prev) => ({
        ...prev,
        [addMemberCtx.orgId]: (prev[addMemberCtx.orgId] ?? []).map((t) =>
          t.id === addMemberCtx.teamId ? { ...t, member_count: t.member_count + added.length } : t,
        ),
      }))
      setAddMemberCtx(null)
      setAddMemberPicks([])
      setAddMemberRole('member')
      if (added.length === selectedIds.length) {
        showToast('success', `Added ${added.length} member${added.length === 1 ? '' : 's'} to team`)
      } else if (added.length > 0) {
        showToast('success', `Added ${added.length} member${added.length === 1 ? '' : 's'} (${selectedIds.length - added.length} failed)`)
      } else {
        showToast('error', 'Failed to add selected members')
      }
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to add member')
    }
  }

  function openAddMemberModal(orgId: string, teamId: string) {
    setAddMemberCtx({ orgId, teamId })
    setAddMemberPicks([])
    setAddMemberRole('member')
  }

  async function removeTeamMember(orgId: string, teamId: string, userId: string) {
    try {
      await api.removeTeamMember(teamId, userId)
      setTeamMembers((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).filter((m) => m.user_id !== userId),
      }))
      setTeams((prev) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t) =>
          t.id === teamId ? { ...t, member_count: Math.max(0, t.member_count - 1) } : t,
        ),
      }))
      showToast('success', 'Removed from team')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to remove')
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url.trim())
      showToast('success', 'Invite link copied')
    } catch {
      showToast('error', 'Could not copy link')
    }
  }

  async function renameTeamInline(orgId: string, teamId: string, nextName: string) {
    try {
      const updated = await api.renameTeam(teamId, nextName.trim())
      setTeams((prev) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t) => (t.id === updated.id ? updated : t)),
      }))
      showToast('success', 'Team renamed')
    } catch (err) {
      showToast('error', (err as Error).message || 'Rename failed')
      throw err
    }
  }

  async function updateTeamDescriptionInline(orgId: string, teamId: string, nextDescription: string) {
    try {
      const updated = await api.updateTeam(teamId, { description: nextDescription.trim() })
      setTeams((prev) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t) => (t.id === updated.id ? updated : t)),
      }))
      showToast('success', 'Team description updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Update failed')
      throw err
    }
  }

  async function renameOrgInline(orgId: string, nextName: string) {
    try {
      const trimmed = nextName.trim()
      const updated = await api.renameOrg(orgId, trimmed)
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      showToast('success', 'Organization renamed')
    } catch (err) {
      showToast('error', (err as Error).message || 'Rename failed')
      throw err
    }
  }

  function triggerOrgAvatarUpload(orgId: string) {
    setPendingOrgAvatarOrgId(orgId)
    orgAvatarInputRef.current?.click()
  }

  function triggerTeamAvatarUpload(orgId: string, teamId: string) {
    setPendingTeamAvatar({ orgId, teamId })
    teamAvatarInputRef.current?.click()
  }

  async function onOrgAvatarFileSelected(file: File | null) {
    if (!file || !pendingOrgAvatarOrgId) return
    try {
      const updated = await api.uploadOrgAvatar(pendingOrgAvatarOrgId, file)
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      showToast('success', 'Organization image updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to upload organization image')
    } finally {
      setPendingOrgAvatarOrgId(null)
      if (orgAvatarInputRef.current) orgAvatarInputRef.current.value = ''
    }
  }

  async function onTeamAvatarFileSelected(file: File | null) {
    if (!file || !pendingTeamAvatar) return
    try {
      const updated = await api.uploadTeamAvatar(pendingTeamAvatar.teamId, file)
      setTeams((prev) => ({
        ...prev,
        [pendingTeamAvatar.orgId]: (prev[pendingTeamAvatar.orgId] ?? []).map((t) =>
          t.id === updated.id ? updated : t,
        ),
      }))
      showToast('success', 'Team image updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to upload team image')
    } finally {
      setPendingTeamAvatar(null)
      if (teamAvatarInputRef.current) teamAvatarInputRef.current.value = ''
    }
  }

  async function openAssignTeams(orgId: string, userId: string, userLabel: string) {
    setAssignTeamsCtx({ orgId, userId, userLabel })
    setAssignTeamsSelected([])
    setAssignTeamsRoles({})
    const orgTeams = teams[orgId] ?? []
    await Promise.all(
      orgTeams
        .filter((t) => !teamMembers[t.id])
        .map(async (t) => {
          await loadTeamMembers(t.id)
        }),
    )
  }

  async function commitAssignTeams(ev: FormEvent) {
    ev.preventDefault()
    if (!assignTeamsCtx || assignTeamsSelected.length === 0) return
    setAssignTeamsSaving(true)
    try {
      const selectedTeamIds = [...assignTeamsSelected]
      const results = await Promise.allSettled(
        selectedTeamIds.map(async (teamId) =>
          api.addTeamMember(teamId, {
            user_id: assignTeamsCtx.userId,
            role: assignTeamsRoles[teamId] ?? 'member',
          }),
        ),
      )
      let success = 0
      let failed = 0
      results.forEach((result, index) => {
        const teamId = selectedTeamIds[index]
        if (result.status === 'fulfilled') {
          success += 1
          const tm = result.value
          setTeamMembers((prev) => ({
            ...prev,
            [teamId]: [...(prev[teamId] ?? []), tm],
          }))
          setTeams((prev) => ({
            ...prev,
            [assignTeamsCtx.orgId]: (prev[assignTeamsCtx.orgId] ?? []).map((t) =>
              t.id === teamId ? { ...t, member_count: t.member_count + 1 } : t,
            ),
          }))
        } else {
          failed += 1
        }
      })
      if (success > 0 && failed === 0) {
        showToast('success', `Added to ${success} team${success === 1 ? '' : 's'}`)
        setAssignTeamsCtx(null)
      } else if (success > 0) {
        showToast('success', `Added to ${success} team${success === 1 ? '' : 's'} (${failed} failed)`)
        setAssignTeamsCtx(null)
      } else {
        showToast('error', 'Could not add user to selected teams')
      }
    } catch (err) {
      showToast('error', (err as Error).message || 'Bulk team assignment failed')
    } finally {
      setAssignTeamsSaving(false)
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Context menu builders Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  function orgMenuItems(org: Org): ContextMenuItem[] {
    return [
      {
        kind: 'action',
        label: 'New organizationÃ¢â‚¬Â¦',
        icon: <Building2 size={14} />,
        onClick: () => setNewOrgOpen(true),
      },
      { kind: 'divider' },
      {
        kind: 'action',
        label: 'New teamÃ¢â‚¬Â¦',
        icon: <UsersRound size={14} />,
        onClick: () => setNewTeamCtx({ orgId: org.id }),
      },
      {
        kind: 'action',
        label: 'Invite memberÃ¢â‚¬Â¦',
        icon: <MailPlus size={14} />,
        onClick: () => setInviteCtx({ orgId: org.id }),
      },
      {
        kind: 'action',
        label: 'Upload logoÃ¢â‚¬Â¦',
        icon: <UserCircle2 size={14} />,
        onClick: () => triggerOrgAvatarUpload(org.id),
      },
      { kind: 'divider' },
      {
        kind: 'action',
        label: 'RenameÃ¢â‚¬Â¦',
        icon: <Pencil size={14} />,
        onClick: () => {
          setRenameCtx({ kind: 'org', orgId: org.id, current: org.name })
          setRenameValue(org.name)
        },
      },
      {
        kind: 'action',
        label: 'Delete organization',
        icon: <Trash2 size={14} />,
        destructive: true,
        onClick: () => setDeleteCtx({ kind: 'org', orgId: org.id, label: org.name }),
      },
    ]
  }

  function teamsFolderMenuItems(orgId: string): ContextMenuItem[] {
    return [
      {
        kind: 'action',
        label: 'New teamÃ¢â‚¬Â¦',
        icon: <UsersRound size={14} />,
        onClick: () => setNewTeamCtx({ orgId }),
      },
    ]
  }

  function teamMenuItems(orgId: string, team: Team): ContextMenuItem[] {
    return [
      {
        kind: 'action',
        label: 'Add memberÃ¢â‚¬Â¦',
        icon: <UserPlus size={14} />,
        onClick: () => openAddMemberModal(orgId, team.id),
      },
      {
        kind: 'action',
        label: 'Upload logoÃ¢â‚¬Â¦',
        icon: <UserCircle2 size={14} />,
        onClick: () => triggerTeamAvatarUpload(orgId, team.id),
      },
      {
        kind: 'action',
        label: 'RenameÃ¢â‚¬Â¦',
        icon: <Pencil size={14} />,
        onClick: () => {
          setRenameCtx({ kind: 'team', orgId, teamId: team.id, current: team.name })
          setRenameValue(team.name)
        },
      },
      { kind: 'divider' },
      {
        kind: 'action',
        label: 'Delete team',
        icon: <Trash2 size={14} />,
        destructive: true,
        onClick: () => setDeleteCtx({ kind: 'team', orgId, teamId: team.id, label: team.name }),
      },
    ]
  }

  function peopleFolderMenuItems(orgId: string): ContextMenuItem[] {
    return [
      {
        kind: 'action',
        label: 'Invite memberÃ¢â‚¬Â¦',
        icon: <MailPlus size={14} />,
        onClick: () => setInviteCtx({ orgId }),
      },
    ]
  }

  function memberMenuItems(orgId: string, member: Member): ContextMenuItem[] {
    const isSelf = member.user_id === user?.id
    const items: ContextMenuItem[] = [
      {
        kind: 'action',
        label: 'Make member',
        icon: <UserCircle2 size={14} />,
        disabled: isSelf || member.role === 'member',
        onClick: () => changeMemberRole(orgId, member.user_id, 'member'),
      },
      {
        kind: 'action',
        label: 'Make admin',
        icon: <Shield size={14} />,
        disabled: isSelf || member.role === 'admin',
        onClick: () => changeMemberRole(orgId, member.user_id, 'admin'),
      },
      {
        kind: 'action',
        label: 'Make owner',
        icon: <ShieldCheck size={14} />,
        disabled: isSelf || member.role === 'owner',
        onClick: () => changeMemberRole(orgId, member.user_id, 'owner'),
      },
      { kind: 'divider' },
      {
        kind: 'action',
        label: 'Remove from organization',
        icon: <UserMinus size={14} />,
        destructive: true,
        disabled: isSelf,
        onClick: () =>
          setDeleteCtx({
            kind: 'member',
            orgId,
            userId: member.user_id,
            label: member.full_name || member.email,
          }),
      },
    ]
    return items
  }

  function invitesFolderMenuItems(orgId: string): ContextMenuItem[] {
    return [
      {
        kind: 'action',
        label: 'New inviteÃ¢â‚¬Â¦',
        icon: <MailPlus size={14} />,
        onClick: () => setInviteCtx({ orgId }),
      },
    ]
  }



  // Ã¢â€â‚¬Ã¢â€â‚¬ Derived Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? [...orgs]
      : orgs.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
    return filtered.sort((a, b) => {
      if (orgSort === 'name_asc') return a.name.localeCompare(b.name)
      if (orgSort === 'name_desc') return b.name.localeCompare(a.name)
      if (orgSort === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [orgs, search, orgSort])

  const addableMembers = useMemo(() => {
    if (!addMemberCtx) return []
    return (members[addMemberCtx.orgId] ?? []).filter(
      (m) => !(teamMembers[addMemberCtx.teamId] ?? []).some((tm) => tm.user_id === m.user_id),
    )
  }, [addMemberCtx, members, teamMembers])

  return {
    // Data
    user,
    orgs,
    members,
    teams,
    invites,
    teamMembers,
    loading,
    expanded,
    selection,
    search,
    orgSort,
    filteredOrgs,
    addableMembers,

    // Setters for data
    setSearch,
    setOrgSort,

    // Modal state
    newOrgOpen, setNewOrgOpen,
    newOrgName, setNewOrgName,
    newOrgSlug, setNewOrgSlug,
    newTeamCtx, setNewTeamCtx,
    newTeamName, setNewTeamName,
    newTeamDesc, setNewTeamDesc,
    inviteCtx, setInviteCtx,
    inviteEmail, setInviteEmail,
    inviteRole, setInviteRole,
    renameCtx, setRenameCtx,
    renameValue, setRenameValue,
    deleteCtx, setDeleteCtx,
    addMemberCtx, setAddMemberCtx,
    addMemberRole, setAddMemberRole,
    addMemberPicks, setAddMemberPicks,
    assignTeamsCtx, setAssignTeamsCtx,
    assignTeamsSelected, setAssignTeamsSelected,
    assignTeamsRoles, setAssignTeamsRoles,
    assignTeamsSaving,

    // Refs
    orgAvatarInputRef,
    teamAvatarInputRef,

    // Actions
    toggleExpand,
    select,
    showToast,
    createOrg,
    createTeam,
    sendInvite,
    commitRename,
    commitDelete,
    changeMemberRole,
    commitAddTeamMember,
    openAddMemberModal,
    removeTeamMember,
    copyInviteLink,
    renameTeamInline,
    updateTeamDescriptionInline,
    renameOrgInline,
    triggerOrgAvatarUpload,
    triggerTeamAvatarUpload,
    onOrgAvatarFileSelected,
    onTeamAvatarFileSelected,
    openAssignTeams,
    commitAssignTeams,

    // Menu builders
    orgMenuItems,
    teamsFolderMenuItems,
    teamMenuItems,
    peopleFolderMenuItems,
    memberMenuItems,
    invitesFolderMenuItems,
  }
}
