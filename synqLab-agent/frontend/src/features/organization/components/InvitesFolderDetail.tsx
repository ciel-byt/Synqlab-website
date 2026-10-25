/**
 * Invites folder detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import type { ReactNode } from 'react'
import { Copy, MailPlus, Plus, X } from 'lucide-react'
import type { Org, Invite } from '../types'
import { formatRelativeFuture } from '../helpers'
import { DetailShell, EmptyCallout } from '../components'
import { PrimaryButton } from './shared'
import { Button } from '@/components/ui/button'

export function InvitesFolderDetail(props: {
  org: Org
  invites: Invite[]
  crumb: ReactNode
  onInvite: () => void
  onCopy: (url: string) => void
  onRevoke: (inviteId: string, label: string) => void
}) {
  return (
    <DetailShell
      crumb={props.crumb}
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'hsl(var(--color-entity-invites) / 0.12)', color: 'hsl(var(--color-entity-invites))' }}>
          <MailPlus size={28} />
        </div>
      }
      title="Invites"
      subtitle={`${props.invites.length} open invite${props.invites.length === 1 ? '' : 's'}`}
      actions={
        <PrimaryButton onClick={props.onInvite}>
          <Plus size={12} /> New invite
        </PrimaryButton>
      }
    >
      {props.invites.length === 0 ? (
        <EmptyCallout
          icon={<MailPlus size={18} className="text-muted-foreground/70" />}
          title="No open invites"
          description="Invite a teammate by email or generate a shareable link."
          action={<PrimaryButton onClick={props.onInvite}><Plus size={12} /> New invite</PrimaryButton>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {props.invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'hsl(var(--color-entity-invites) / 0.12)', color: 'hsl(var(--color-entity-invites))' }}>
                <MailPlus size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{inv.email ?? 'Shareable link'}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="capitalize">{inv.role}</span>
                  <span>·</span>
                  <span>{formatRelativeFuture(inv.expires_at)}</span>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => props.onCopy(inv.invite_url)} title="Copy link">
                <Copy size={11} /> Copy
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => props.onRevoke(inv.id, inv.email ?? inv.invite_url)} title="Revoke">
                <X size={12} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DetailShell>
  )
}
