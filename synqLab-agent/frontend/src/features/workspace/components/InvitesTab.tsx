/**
 * InvitesTab — invite list with create/copy/revoke.
 */
import { Copy, MailPlus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/blocks/EmptyState'
import type { Org, Invite } from '../types'
import { formatRelativeFuture } from '../helpers'

export function InvitesTab(props: {
  org: Org | null
  invites: Invite[]
  onInvite: () => void
  onCopy: (url: string) => void
  onRevoke: (inviteId: string, label: string) => void
}) {
  if (!props.org) return <EmptyState icon={MailPlus} title="Select an organization" />

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Invites</h1>
          <p className="text-sm text-muted-foreground">{props.invites.length} open invite{props.invites.length === 1 ? '' : 's'}</p>
        </div>
        <Button size="sm" onClick={props.onInvite}>
          <Plus size={12} /> New invite
        </Button>
      </div>

      {props.invites.length === 0 ? (
        <EmptyState
          icon={MailPlus}
          title="No open invites"
          description="Invite a teammate by email or generate a shareable link."
          action={<Button variant="link" onClick={props.onInvite}>New invite</Button>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {props.invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: 'hsl(var(--color-entity-invites) / 0.12)', color: 'hsl(var(--color-entity-invites))' }}
              >
                <MailPlus size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{inv.email ?? 'Shareable link'}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="capitalize">{inv.role}</span>
                  <span>·</span>
                  <span>Expires {formatRelativeFuture(inv.expires_at)}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => props.onCopy(inv.invite_url)} title="Copy link">
                <Copy size={12} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => props.onRevoke(inv.id, inv.email ?? 'link invite')} title="Revoke">
                <X size={12} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
