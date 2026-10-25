/**
 * People folder detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { MailPlus, Search, UserMinus, Users } from 'lucide-react'
import type { Org, Member } from '../types'
import { initials } from '../helpers'
import { DetailShell, EmptyCallout, OrgAvatar as Avatar } from '../components'
import { PrimaryButton, RoleSelector } from './shared'

export function PeopleFolderDetail(props: {
  org: Org
  members: Member[]
  crumb: ReactNode
  currentUserId: string
  onInvite: () => void
  onSelectMember: (userId: string) => void
  onChangeRole: (userId: string, role: string) => void
  onRemove: (userId: string, label: string) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    if (!q.trim()) return props.members
    const lower = q.toLowerCase()
    return props.members.filter(
      (m) => m.email.toLowerCase().includes(lower) || m.full_name.toLowerCase().includes(lower),
    )
  }, [props.members, q])

  return (
    <DetailShell
      crumb={props.crumb}
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'hsl(var(--color-entity-people) / 0.12)', color: 'hsl(var(--color-entity-people))' }}>
          <Users size={28} />
        </div>
      }
      title="People"
      subtitle={`${props.members.length} member${props.members.length === 1 ? '' : 's'} in ${props.org.name}`}
      actions={
        <PrimaryButton onClick={props.onInvite}>
          <MailPlus size={12} /> Invite member
        </PrimaryButton>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name or email…"
            className="w-full rounded-md border border-border bg-card py-1.5 pl-7 pr-3 text-xs outline-none focus:border-ring"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyCallout
          icon={<Users size={18} className="text-muted-foreground/70" />}
          title={q ? 'No matching members' : 'No members yet'}
          description={q ? 'Try a different search.' : 'Invite people to start collaborating.'}
          action={!q ? <PrimaryButton onClick={props.onInvite}><MailPlus size={12} /> Invite member</PrimaryButton> : undefined}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filtered.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => props.onSelectMember(m.user_id)} className="shrink-0">
                <Avatar seed={m.email} label={initials(m.full_name || m.email)} imageUrl={m.avatar_url} />
              </button>
              <button onClick={() => props.onSelectMember(m.user_id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-foreground hover:underline">{m.full_name || m.email}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </button>
              <RoleSelector role={m.role} disabled={m.user_id === props.currentUserId} onChange={(r) => props.onChangeRole(m.user_id, r)} />
              <button
                onClick={() => props.onRemove(m.user_id, m.full_name || m.email)}
                disabled={m.user_id === props.currentUserId}
                className="rounded p-1.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                title="Remove"
              >
                <UserMinus size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </DetailShell>
  )
}
