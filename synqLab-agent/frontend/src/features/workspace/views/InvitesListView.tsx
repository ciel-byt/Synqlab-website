/**
 * InvitesListView — routed view for /workspace/invites.
 */
import { useWorkspace } from '@/pages/WorkspacePage'
import { InvitesTab } from '../components/InvitesTab'

export function InvitesListView() {
  const d = useWorkspace()
  return (
    <InvitesTab
      org={d.activeOrg}
      invites={d.activeInvites}
      onInvite={() => d.setInviteCtx({ orgId: d.activeOrgId })}
      onCopy={(url) => d.copyInviteLink(url)}
      onRevoke={(inviteId, label) => d.setDeleteCtx({ kind: 'invite', orgId: d.activeOrgId, inviteId, label })}
    />
  )
}
