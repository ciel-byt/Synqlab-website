import type { FormEvent } from 'react'
import { api } from '@/api/client'
import { toast } from '@/components/ui/sonner'
import type { Project } from '../types'
import { slugify } from '../helpers'

export function useWorkspaceMutations(state: any) {
  const {
    orgs, setOrgs, setActiveOrgId,
    newOrgName, newOrgSlug, setNewOrgOpen, setNewOrgName, setNewOrgSlug,
    newTeamCtx, newTeamName, newTeamDesc, setNewTeamCtx, setNewTeamName, setNewTeamDesc,
    inviteCtx, inviteEmail, inviteRole, setInvites, setInviteCtx, setInviteEmail, setInviteRole,
    renameCtx, renameValue, setTeams, setRenameCtx, setRenameValue,
    deleteCtx, activeOrgId, setDeleteCtx, setMembers,
    addMemberCtx, addMemberPicks, addMemberRole, teamMembers, setTeamMembers, setAddMemberCtx, setAddMemberPicks, setAddMemberRole,
    assignTeamsCtx, assignTeamsSelected, assignTeamsRoles, setAssignTeamsSaving, setAssignTeamsCtx, setAssignTeamsSelected, setAssignTeamsRoles,
    pendingOrgAvatarOrgId, pendingTeamAvatar, setPendingOrgAvatarOrgId, setPendingTeamAvatar,
    orgAvatarInputRef, teamAvatarInputRef, setAvatarPickerCtx,
    setProjects, setShowProjectModal, loadOrgChildren, loadTeamMembers,
  } = state

  function showToast(type: 'success' | 'error', message: string) {
    if (type === 'success') toast.success(message)
    else toast.error(message)
  }

  async function createOrg(ev: FormEvent) {
    ev.preventDefault()
    if (!newOrgName.trim()) return
    const proposedName = newOrgName.trim()
    const nameTaken = orgs.some((o: any) => o.name.trim().toLowerCase() === proposedName.toLowerCase())
    if (nameTaken) { showToast('error', 'Organization name already exists.'); return }
    const proposedSlug = (newOrgSlug.trim() || slugify(proposedName)).toLowerCase()
    const slugTaken = orgs.some((o: any) => o.slug.toLowerCase() === proposedSlug)
    if (slugTaken) { showToast('error', 'Organization slug already exists.'); return }
    try {
      const org = await api.createOrg({ name: proposedName, slug: proposedSlug })
      setOrgs((prev: any) => [...prev, org])
      setActiveOrgId(org.id)
      setNewOrgOpen(false); setNewOrgName(''); setNewOrgSlug('')
      void loadOrgChildren(org.id)
      showToast('success', `Organization "${org.name}" created`)
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
      setTeams((prev: any) => ({
        ...prev,
        [newTeamCtx.orgId]: [...(prev[newTeamCtx.orgId] ?? []), team],
      }))
      void loadTeamMembers(team.id)
      setNewTeamCtx(null); setNewTeamName(''); setNewTeamDesc('')
      showToast('success', `Team "${team.name}" created`)
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
      setInvites((prev: any) => ({ ...prev, [inviteCtx.orgId]: [inv, ...(prev[inviteCtx.orgId] ?? [])] }))
      try { await navigator.clipboard.writeText(inv.invite_url); showToast('success', 'Invite created — link copied') }
      catch { showToast('success', 'Invite created') }
      setInviteCtx(null); setInviteEmail(''); setInviteRole('member')
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
        setOrgs((prev: any) => prev.map((o: any) => (o.id === updated.id ? updated : o)))
        showToast('success', 'Organization renamed')
      } else {
        const updated = await api.renameTeam(renameCtx.teamId, renameValue.trim())
        setTeams((prev: any) => ({
          ...prev,
          [renameCtx.orgId]: (prev[renameCtx.orgId] ?? []).map((t: any) => (t.id === updated.id ? updated : t)),
        }))
        showToast('success', 'Team renamed')
      }
      setRenameCtx(null); setRenameValue('')
    } catch (err) {
      showToast('error', (err as Error).message || 'Rename failed')
    }
  }

  async function commitDelete() {
    if (!deleteCtx) return
    try {
      if (deleteCtx.kind === 'org') {
        await api.deleteOrg(deleteCtx.orgId)
        setOrgs((prev: any) => prev.filter((o: any) => o.id !== deleteCtx.orgId))
        if (activeOrgId === deleteCtx.orgId) setActiveOrgId(orgs.find((o: any) => o.id !== deleteCtx.orgId)?.id ?? '')
        showToast('success', 'Organization deleted')
      } else if (deleteCtx.kind === 'team') {
        await api.deleteTeam(deleteCtx.teamId)
        setTeams((prev: any) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((t: any) => t.id !== deleteCtx.teamId),
        }))
        showToast('success', 'Team deleted')
      } else if (deleteCtx.kind === 'member') {
        await api.removeMember(deleteCtx.orgId, deleteCtx.userId)
        setMembers((prev: any) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((m: any) => m.user_id !== deleteCtx.userId),
        }))
        showToast('success', 'Member removed')
      } else if (deleteCtx.kind === 'invite') {
        await api.deleteOrgInvite(deleteCtx.orgId, deleteCtx.inviteId)
        setInvites((prev: any) => ({
          ...prev,
          [deleteCtx.orgId]: (prev[deleteCtx.orgId] ?? []).filter((i: any) => i.id !== deleteCtx.inviteId),
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
      setMembers((prev: any) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((m: any) => (m.user_id === userId ? updated : m)),
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
          api.addTeamMember(addMemberCtx.teamId, { user_id: userId, role: addMemberRole }),
        ),
      )
      const added = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value)
      setTeamMembers((prev: any) => ({
        ...prev,
        [addMemberCtx.teamId]: [...(prev[addMemberCtx.teamId] ?? []), ...added],
      }))
      setTeams((prev: any) => ({
        ...prev,
        [addMemberCtx.orgId]: (prev[addMemberCtx.orgId] ?? []).map((t: any) =>
          t.id === addMemberCtx.teamId ? { ...t, member_count: t.member_count + added.length } : t,
        ),
      }))
      setAddMemberCtx(null); setAddMemberPicks([]); setAddMemberRole('member')
      if (added.length === selectedIds.length) showToast('success', `Added ${added.length} member${added.length === 1 ? '' : 's'} to team`)
      else if (added.length > 0) showToast('success', `Added ${added.length} (${selectedIds.length - added.length} failed)`)
      else showToast('error', 'Failed to add selected members')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to add member')
    }
  }

  function openAddMemberModal(orgId: string, teamId: string) {
    setAddMemberCtx({ orgId, teamId }); setAddMemberPicks([]); setAddMemberRole('member')
  }

  async function removeTeamMember(orgId: string, teamId: string, userId: string) {
    try {
      await api.removeTeamMember(teamId, userId)
      setTeamMembers((prev: any) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).filter((m: any) => m.user_id !== userId),
      }))
      setTeams((prev: any) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t: any) =>
          t.id === teamId ? { ...t, member_count: Math.max(0, t.member_count - 1) } : t,
        ),
      }))
      showToast('success', 'Removed from team')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to remove')
    }
  }

  async function copyInviteLink(url: string) {
    try { await navigator.clipboard.writeText(url.trim()); showToast('success', 'Invite link copied') }
    catch { showToast('error', 'Could not copy link') }
  }

  async function renameTeamInline(orgId: string, teamId: string, nextName: string) {
    try {
      const updated = await api.renameTeam(teamId, nextName.trim())
      setTeams((prev: any) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t: any) => (t.id === updated.id ? updated : t)),
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
      setTeams((prev: any) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).map((t: any) => (t.id === updated.id ? updated : t)),
      }))
      showToast('success', 'Team description updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Update failed')
      throw err
    }
  }

  async function renameOrgInline(orgId: string, nextName: string) {
    try {
      const updated = await api.renameOrg(orgId, nextName.trim())
      setOrgs((prev: any) => prev.map((o: any) => (o.id === updated.id ? updated : o)))
      showToast('success', 'Organization renamed')
    } catch (err) {
      showToast('error', (err as Error).message || 'Rename failed')
      throw err
    }
  }

  function triggerOrgAvatarUpload(orgId: string) {
    setPendingOrgAvatarOrgId(orgId)
    setAvatarPickerCtx({ kind: 'org', orgId })
  }

  function triggerTeamAvatarUpload(orgId: string, teamId: string) {
    setPendingTeamAvatar({ orgId, teamId })
    setAvatarPickerCtx({ kind: 'team', orgId, teamId })
  }

  async function onOrgAvatarFileSelected(file: File | null) {
    if (!file || !pendingOrgAvatarOrgId) return
    try {
      const updated = await api.uploadOrgAvatar(pendingOrgAvatarOrgId, file)
      setOrgs((prev: any) => prev.map((o: any) => (o.id === updated.id ? updated : o)))
      showToast('success', 'Organization image updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to upload')
    } finally {
      setPendingOrgAvatarOrgId(null)
      if (orgAvatarInputRef.current) orgAvatarInputRef.current.value = ''
    }
  }

  async function removeOrgAvatar(orgId: string) {
    try {
      setOrgs((prev: any) => prev.map((o: any) => (o.id === orgId ? { ...o, avatar_url: null } : o)))
      showToast('success', 'Organization image removed')
      try { await api.removeOrgAvatar(orgId) } catch { }
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to remove image')
    }
  }

  async function onTeamAvatarFileSelected(file: File | null) {
    if (!file || !pendingTeamAvatar) return
    try {
      const updated = await api.uploadTeamAvatar(pendingTeamAvatar.teamId, file)
      setTeams((prev: any) => ({
        ...prev,
        [pendingTeamAvatar.orgId]: (prev[pendingTeamAvatar.orgId] ?? []).map((t: any) =>
          t.id === updated.id ? updated : t,
        ),
      }))
      showToast('success', 'Team image updated')
    } catch (err) {
      showToast('error', (err as Error).message || 'Failed to upload')
    } finally {
      setPendingTeamAvatar(null)
      if (teamAvatarInputRef.current) teamAvatarInputRef.current.value = ''
    }
  }

  async function openAssignTeams(orgId: string, userId: string, userLabel: string) {
    setAssignTeamsCtx({ orgId, userId, userLabel })
    setAssignTeamsSelected([]); setAssignTeamsRoles({})
    const orgTeams = state.teams[orgId] ?? []
    await Promise.all(orgTeams.filter((t: any) => !teamMembers[t.id]).map((t: any) => loadTeamMembers(t.id)))
  }

  async function commitAssignTeams(ev: FormEvent) {
    ev.preventDefault()
    if (!assignTeamsCtx || assignTeamsSelected.length === 0) return
    setAssignTeamsSaving(true)
    try {
      const selectedTeamIds = [...assignTeamsSelected]
      const results = await Promise.allSettled(
        selectedTeamIds.map((teamId) =>
          api.addTeamMember(teamId, {
            user_id: assignTeamsCtx.userId,
            role: assignTeamsRoles[teamId] ?? 'member',
          }),
        ),
      )
      let success = 0, failed = 0
      results.forEach((result, index) => {
        const teamId = selectedTeamIds[index]
        if (result.status === 'fulfilled') {
          success += 1
          const tm = result.value
          setTeamMembers((prev: any) => ({ ...prev, [teamId]: [...(prev[teamId] ?? []), tm] }))
          setTeams((prev: any) => ({
            ...prev,
            [assignTeamsCtx.orgId]: (prev[assignTeamsCtx.orgId] ?? []).map((t: any) =>
              t.id === teamId ? { ...t, member_count: t.member_count + 1 } : t,
            ),
          }))
        } else { failed += 1 }
      })
      if (success > 0) {
        showToast('success', `Added to ${success} team${success === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}`)
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

  function handleProjectCreated(p: Project) {
    setProjects((prev: any) => [p, ...prev])
    setShowProjectModal(false)
  }

  return {
    showToast,
    createOrg, createTeam, sendInvite,
    commitRename, commitDelete,
    changeMemberRole,
    commitAddTeamMember, openAddMemberModal,
    removeTeamMember, copyInviteLink,
    renameTeamInline, updateTeamDescriptionInline, renameOrgInline,
    triggerOrgAvatarUpload, triggerTeamAvatarUpload,
    onOrgAvatarFileSelected, onTeamAvatarFileSelected, removeOrgAvatar,
    openAssignTeams, commitAssignTeams,
    handleProjectCreated,
  }
}
