/**
 * WorkspaceModals — wraps OrgModals + NewProjectModal + hidden file inputs.
 */
import { OrgModals } from '@/features/organization/components/OrgModals'
import { NewProjectModal } from '@/features/projects/components/NewProjectModal'
import { AvatarPickerModal } from './AvatarPickerModal'
import type { useWorkspaceData } from '../hooks/useWorkspaceData'

type WorkspaceData = ReturnType<typeof useWorkspaceData>

export function WorkspaceModals({ d }: { d: WorkspaceData }) {
  return (
    <>
      {/* Hidden file inputs for avatar uploads */}
      <input ref={d.orgAvatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" className="hidden" onChange={(e) => d.onOrgAvatarFileSelected(e.target.files?.[0] ?? null)} />
      <input ref={d.teamAvatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" className="hidden" onChange={(e) => d.onTeamAvatarFileSelected(e.target.files?.[0] ?? null)} />

      <AvatarPickerModal
        open={d.avatarPickerCtx !== null}
        onOpenChange={(o) => { if (!o) d.setAvatarPickerCtx(null) }}
        onUploadCustom={() => {
          if (d.avatarPickerCtx?.kind === 'org') {
            d.orgAvatarInputRef.current?.click()
          } else if (d.avatarPickerCtx?.kind === 'team') {
            d.teamAvatarInputRef.current?.click()
          }
          d.setAvatarPickerCtx(null)
        }}
        onSelectBuiltin={(file) => {
          if (d.avatarPickerCtx?.kind === 'org') {
            d.onOrgAvatarFileSelected(file)
          } else if (d.avatarPickerCtx?.kind === 'team') {
            d.onTeamAvatarFileSelected(file)
          }
          d.setAvatarPickerCtx(null)
        }}
      />

      {/* Org/Team/Member/Invite modals */}
      <OrgModals
        newOrg={{
          open: d.newOrgOpen,
          name: d.newOrgName,
          slug: d.newOrgSlug,
          setName: d.setNewOrgName,
          setSlug: d.setNewOrgSlug,
          onSubmit: d.createOrg,
          onClose: () => d.setNewOrgOpen(false),
        }}
        newTeam={{
          ctx: d.newTeamCtx,
          name: d.newTeamName,
          desc: d.newTeamDesc,
          setName: d.setNewTeamName,
          setDesc: d.setNewTeamDesc,
          onSubmit: d.createTeam,
          onClose: () => { d.setNewTeamCtx(null); d.setNewTeamName(''); d.setNewTeamDesc('') },
        }}
        invite={{
          ctx: d.inviteCtx,
          email: d.inviteEmail,
          role: d.inviteRole,
          setEmail: d.setInviteEmail,
          setRole: d.setInviteRole,
          onSubmit: d.sendInvite,
          onClose: () => { d.setInviteCtx(null); d.setInviteEmail(''); d.setInviteRole('member') },
        }}
        rename={{
          ctx: d.renameCtx ? { kind: d.renameCtx.kind, current: d.renameCtx.current } : null,
          value: d.renameValue,
          setValue: d.setRenameValue,
          onSubmit: d.commitRename,
          onClose: () => { d.setRenameCtx(null); d.setRenameValue('') },
        }}
        del={{
          ctx: d.deleteCtx ? { kind: d.deleteCtx.kind, label: d.deleteCtx.label } : null,
          onConfirm: d.commitDelete,
          onClose: () => d.setDeleteCtx(null),
        }}
        addMember={{
          ctx: d.addMemberCtx,
          role: d.addMemberRole,
          picks: d.addMemberPicks,
          addableMembers: d.addableMembers,
          setRole: d.setAddMemberRole,
          setPicks: d.setAddMemberPicks,
          onSubmit: d.commitAddTeamMember,
          onClose: () => { d.setAddMemberCtx(null); d.setAddMemberPicks([]); d.setAddMemberRole('member') },
        }}
        assignTeams={{
          ctx: d.assignTeamsCtx,
          selected: d.assignTeamsSelected,
          roles: d.assignTeamsRoles,
          saving: d.assignTeamsSaving,
          teams: d.assignTeamsCtx ? (d.teams[d.assignTeamsCtx.orgId] ?? []) : [],
          teamMembers: d.teamMembers,
          setSelected: d.setAssignTeamsSelected,
          setRoles: d.setAssignTeamsRoles,
          onSubmit: d.commitAssignTeams,
          onClose: () => d.setAssignTeamsCtx(null),
        }}
      />

      {/* Project create modal */}
      <NewProjectModal
        orgs={d.orgs}
        teams={d.teams}
        defaultOrgId={d.projectModalPrefill.orgId ?? d.activeOrgId ?? d.orgs[0]?.id}
        defaultTeamId={d.projectModalPrefill.teamId ?? undefined}
        onCreated={d.handleProjectCreated}
        open={d.showProjectModal}
        onOpenChange={d.setShowProjectModal}
      />
    </>
  )
}
