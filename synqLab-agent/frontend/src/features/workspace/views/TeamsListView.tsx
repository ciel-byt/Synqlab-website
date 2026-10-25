/**
 * TeamsListView — routed view for /workspace/teams.
 */
import { useWorkspace } from '@/pages/WorkspacePage'
import { TeamsTab } from '../components/TeamsTab'

export function TeamsListView() {
  const d = useWorkspace()
  return (
    <TeamsTab
      org={d.activeOrg}
      teams={d.activeTeams}
      teamMembers={d.teamMembers}
      onNewTeam={() => d.setNewTeamCtx({ orgId: d.activeOrgId })}
      onRenameTeam={(teamId, current) => {
        d.setRenameCtx({ kind: 'team', orgId: d.activeOrgId, teamId, current })
        d.setRenameValue(current)
      }}
      onRenameTeamInline={(teamId, name) => d.renameTeamInline(d.activeOrgId, teamId, name)}
      onUpdateTeamDescriptionInline={(teamId, desc) => d.updateTeamDescriptionInline(d.activeOrgId, teamId, desc)}
      onDeleteTeam={(teamId, label) => d.setDeleteCtx({ kind: 'team', orgId: d.activeOrgId, teamId, label })}
      onAddTeamMember={(teamId) => d.openAddMemberModal(d.activeOrgId, teamId)}
      onRemoveTeamMember={(teamId, userId) => d.removeTeamMember(d.activeOrgId, teamId, userId)}
      onUploadTeamLogo={(teamId) => d.triggerTeamAvatarUpload(d.activeOrgId, teamId)}
    />
  )
}
