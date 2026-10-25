/**
 * Organization detail pane — routes selection to the correct detail view.
 * Mechanically extracted from OrganizationPage.tsx (the DetailPane function).
 */
import type { Org, Member, Team, Invite, TeamMember, Selection, ContextMenuItem } from '../types'
import { Breadcrumb, EmptySelection } from './shared'
import { OrgDetail } from './OrgDetail'
import { TeamsFolderDetail } from './TeamsFolderDetail'
import { TeamDetail } from './TeamDetail'
import { PeopleFolderDetail } from './PeopleFolderDetail'
import { MemberDetail } from './MemberDetail'
import { InvitesFolderDetail } from './InvitesFolderDetail'

export function OrgDetailPane(props: {
  selection: Exclude<Selection, null>
  orgs: Org[]
  members: Record<string, Member[]>
  teams: Record<string, Team[]>
  invites: Record<string, Invite[]>
  teamMembers: Record<string, TeamMember[]>
  onNewTeam: (orgId: string) => void
  onInvite: (orgId: string) => void
  onRenameOrg: (orgId: string, current: string) => void
  onDeleteOrg: (orgId: string, label: string) => void
  onRenameTeam: (orgId: string, teamId: string, current: string) => void
  onDeleteTeam: (orgId: string, teamId: string, label: string) => void
  onAddTeamMember: (orgId: string, teamId: string) => void
  onRemoveTeamMember: (orgId: string, teamId: string, userId: string) => void
  onChangeRole: (orgId: string, userId: string, role: string) => void
  onRemoveMember: (orgId: string, userId: string, label: string) => void
  onRevokeInvite: (orgId: string, inviteId: string, label: string) => void
  onCopyInvite: (url: string) => void
  onUploadOrgLogo: (orgId: string) => void
  onUploadTeamLogo: (orgId: string, teamId: string) => void
  onRenameTeamInline: (orgId: string, teamId: string, nextName: string) => Promise<void>
  onUpdateTeamDescriptionInline: (orgId: string, teamId: string, nextDescription: string) => Promise<void>
  onRenameOrgInline: (orgId: string, nextName: string) => Promise<void>
  onAssignTeams: (orgId: string, userId: string, userLabel: string) => void
  buildOrgMenu: (org: Org) => ContextMenuItem[]
  buildTeamMenu: (orgId: string, team: Team) => ContextMenuItem[]
  onSelect: (sel: Selection) => void
  currentUserId: string
}) {
  const { selection, orgs, members, teams, invites, teamMembers } = props
  const anyOrgId = 'orgId' in selection ? selection.orgId : ''
  const org = orgs.find((o) => o.id === anyOrgId)
  if (!org) return <EmptySelection onCreate={() => {}} hasOrgs={orgs.length > 0} />

  const crumb = (
    <Breadcrumb
      org={org}
      selection={selection}
      teams={teams[org.id] ?? []}
      members={members[org.id] ?? []}
      onSelect={props.onSelect}
    />
  )

  if (selection.kind === 'org') {
    return (
      <OrgDetail
        org={org}
        members={members[org.id] ?? []}
        teams={teams[org.id] ?? []}
        invites={invites[org.id] ?? []}
        crumb={crumb}
        onNewTeam={() => props.onNewTeam(org.id)}
        onInvite={() => props.onInvite(org.id)}
        onRename={() => props.onRenameOrg(org.id, org.name)}
        onRenameInline={(nextName) => props.onRenameOrgInline(org.id, nextName)}
        onDelete={() => props.onDeleteOrg(org.id, org.name)}
        onUploadLogo={() => props.onUploadOrgLogo(org.id)}

        teamMembersByTeam={teamMembers}
        onSelectTeam={(teamId) => props.onSelect({ kind: 'team', orgId: org.id, teamId })}
        onRenameTeam={(teamId, current) => props.onRenameTeam(org.id, teamId, current)}
        onRenameTeamInline={(teamId, nextName) => props.onRenameTeamInline(org.id, teamId, nextName)}
        onUpdateTeamDescriptionInline={(teamId, nextDescription) =>
          props.onUpdateTeamDescriptionInline(org.id, teamId, nextDescription)
        }
        onDeleteTeam={(teamId, label) => props.onDeleteTeam(org.id, teamId, label)}
        onOpenTeams={() => props.onSelect({ kind: 'teams-folder', orgId: org.id })}
        onOpenMembers={() => props.onSelect({ kind: 'people-folder', orgId: org.id })}
        onOpenInvites={() => props.onSelect({ kind: 'invites-folder', orgId: org.id })}
      />
    )
  }

  if (selection.kind === 'teams-folder') {
    return (
      <TeamsFolderDetail
        org={org}
        teams={teams[org.id] ?? []}
        crumb={crumb}
        onNewTeam={() => props.onNewTeam(org.id)}
        onSelectTeam={(teamId) => props.onSelect({ kind: 'team', orgId: org.id, teamId })}
        onRenameTeam={(teamId, current) => props.onRenameTeam(org.id, teamId, current)}
        onRenameTeamInline={(teamId, nextName) => props.onRenameTeamInline(org.id, teamId, nextName)}
        onUpdateTeamDescriptionInline={(teamId, nextDescription) =>
          props.onUpdateTeamDescriptionInline(org.id, teamId, nextDescription)
        }
        onDeleteTeam={(teamId, label) => props.onDeleteTeam(org.id, teamId, label)}
        teamMembersByTeam={teamMembers}
      />
    )
  }

  if (selection.kind === 'team') {
    const team = (teams[org.id] ?? []).find((t) => t.id === selection.teamId)
    if (!team) return <EmptySelection onCreate={() => {}} hasOrgs={true} />
    return (
      <TeamDetail
        org={org}
        team={team}
        teamMembers={teamMembers[team.id] ?? []}
        crumb={crumb}
        onAddMember={() => props.onAddTeamMember(org.id, team.id)}
        onRemoveMember={(userId) => props.onRemoveTeamMember(org.id, team.id, userId)}
        onRename={() => props.onRenameTeam(org.id, team.id, team.name)}
        onRenameInline={(nextName) => props.onRenameTeamInline(org.id, team.id, nextName)}
        onDelete={() => props.onDeleteTeam(org.id, team.id, team.name)}
        onUploadLogo={() => props.onUploadTeamLogo(org.id, team.id)}

      />
    )
  }

  if (selection.kind === 'people-folder') {
    return (
      <PeopleFolderDetail
        org={org}
        members={members[org.id] ?? []}
        crumb={crumb}
        currentUserId={props.currentUserId}
        onInvite={() => props.onInvite(org.id)}
        onSelectMember={(userId) => props.onSelect({ kind: 'member', orgId: org.id, userId })}
        onChangeRole={(userId, role) => props.onChangeRole(org.id, userId, role)}
        onRemove={(userId, label) => props.onRemoveMember(org.id, userId, label)}
      />
    )
  }

  if (selection.kind === 'member') {
    const m = (members[org.id] ?? []).find((x) => x.user_id === selection.userId)
    if (!m) return <EmptySelection onCreate={() => {}} hasOrgs={true} />
    const memberTeams = (teams[org.id] ?? [])
      .filter((t) => (teamMembers[t.id] ?? []).some((tm) => tm.user_id === m.user_id))
      .map((t) => t.name)
    return (
      <MemberDetail
        org={org}
        member={m}
        memberTeams={memberTeams}
        crumb={crumb}
        currentUserId={props.currentUserId}
        onChangeRole={(role) => props.onChangeRole(org.id, m.user_id, role)}
        onRemove={() => props.onRemoveMember(org.id, m.user_id, m.full_name || m.email)}
        onAssignTeams={() => props.onAssignTeams(org.id, m.user_id, m.full_name || m.email)}
      />
    )
  }

  if (selection.kind === 'invites-folder') {
    return (
      <InvitesFolderDetail
        org={org}
        invites={invites[org.id] ?? []}
        crumb={crumb}
        onInvite={() => props.onInvite(org.id)}
        onCopy={(url) => props.onCopyInvite(url)}
        onRevoke={(inviteId, label) => props.onRevokeInvite(org.id, inviteId, label)}
      />
    )
  }

  return <EmptySelection onCreate={() => {}} hasOrgs={true} />
}
