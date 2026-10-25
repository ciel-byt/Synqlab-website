/**
 * Member detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import type { ReactNode } from 'react'
import { UserMinus, UsersRound } from 'lucide-react'
import type { Org, Member } from '../types'
import { initials, formatDate, formatJoined, roleBadgeClass } from '../helpers'
import { DetailShell, BigIcon } from '../components'
import { SecondaryButton, DangerButton, RoleSelector, InfoCard } from './shared'

export function MemberDetail(props: {
  org: Org
  member: Member
  memberTeams: string[]
  crumb: ReactNode
  currentUserId: string
  onChangeRole: (role: string) => void
  onRemove: () => void
  onAssignTeams: () => void
}) {
  const { member } = props
  const isSelf = member.user_id === props.currentUserId
  return (
    <DetailShell
      crumb={props.crumb}
      icon={
        <BigIcon
          seed={member.email}
          label={initials(member.full_name || member.email)}
          imageUrl={member.avatar_url}
          shape="round"
        />
      }
      title={member.full_name || member.email}
      subtitle={
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{member.email}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">joined {formatJoined(member.joined_at)}</span>
        </div>
      }
      actions={
        <>
          <SecondaryButton onClick={props.onAssignTeams}>
            <UsersRound size={12} /> Assign teams
          </SecondaryButton>
          {!isSelf && (
            <DangerButton onClick={props.onRemove}>
              <UserMinus size={12} /> Remove from org
            </DangerButton>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard label="Role">
          {isSelf ? (
            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ring-1 ${roleBadgeClass(member.role)}`}>{member.role}</span>
          ) : (
            <RoleSelector role={member.role} onChange={props.onChangeRole} />
          )}
        </InfoCard>
        <InfoCard label="Authentication">
          <span className="text-sm capitalize text-foreground/80">{member.auth_provider || 'email'}</span>
        </InfoCard>
        <InfoCard label="Email">
          <span className="text-sm text-foreground/80">{member.email}</span>
        </InfoCard>
        <InfoCard label="Joined">
          <span className="text-sm text-foreground/80">{formatDate(member.joined_at)}</span>
        </InfoCard>
        <InfoCard label="Teams">
          {props.memberTeams.length === 0 ? (
            <span className="text-sm text-muted-foreground">Not assigned</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {props.memberTeams.map((teamName) => (
                <span key={teamName} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80">{teamName}</span>
              ))}
            </div>
          )}
        </InfoCard>
      </div>
    </DetailShell>
  )
}
