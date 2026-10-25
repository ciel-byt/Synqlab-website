/**
 * MembersListView — routed view for /workspace/members.
 *
 * Includes a tab bar: Active Members | Pending Invites
 * Merges the old InvitesListView into a single unified view.
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/pages/WorkspacePage'
import { MembersTab } from '../components/MembersTab'
import { InvitesTab } from '../components/InvitesTab'

type Tab = 'members' | 'invites'

export function MembersListView() {
  const d = useWorkspace()
  const [tab, setTab] = useState<Tab>('members')

  const inviteCount = d.activeInvites.length

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      {/* Tab bar */}
      <div className="shrink-0 px-6 pt-4 pb-0">
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setTab('members')}
            className={cn(
              'px-3 py-2 text-[12.5px] font-medium transition-colors relative',
              tab === 'members'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Members
            {tab === 'members' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab('invites')}
            className={cn(
              'px-3 py-2 text-[12.5px] font-medium transition-colors relative flex items-center gap-1.5',
              tab === 'invites'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Invites
            {inviteCount > 0 && (
              <span className="text-[10px] tabular-nums bg-muted px-1.5 py-px rounded-full text-muted-foreground">
                {inviteCount}
              </span>
            )}
            {tab === 'invites' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'members' ? (
          <MembersTab
            org={d.activeOrg}
            members={d.activeMembers}
            teams={d.activeTeams}
            teamMembers={d.teamMembers}
            currentUserId={d.user?.id ?? ''}
            onInvite={() => d.setInviteCtx({ orgId: d.activeOrgId })}
            onChangeRole={(userId, role) => d.changeMemberRole(d.activeOrgId, userId, role)}
            onRemove={(userId, label) => d.setDeleteCtx({ kind: 'member', orgId: d.activeOrgId, userId, label })}
            onAssignTeams={(userId, label) => d.openAssignTeams(d.activeOrgId, userId, label)}
          />
        ) : (
          <InvitesTab
            org={d.activeOrg}
            invites={d.activeInvites}
            onInvite={() => d.setInviteCtx({ orgId: d.activeOrgId })}
            onCopy={(url) => d.copyInviteLink(url)}
            onRevoke={(inviteId, label) => d.setDeleteCtx({ kind: 'invite', orgId: d.activeOrgId, inviteId, label })}
          />
        )}
      </div>
    </div>
  )
}
