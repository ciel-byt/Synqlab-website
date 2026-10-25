/**
 * Organization feature — shared sub-components.
 *
 * Uses shadcn primitives: Button, Breadcrumb, Select, EmptyState.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  Building2,
  MailPlus,
  Plus,
  Users,
  UsersRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { entityColorHsl } from '@/lib/entity-colors'
import type { Org, Member, Team, TeamMember, Selection } from '../types'
import { initials } from '../helpers'


import { Button } from '@/components/ui/button'
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { EmptyState } from '@/components/blocks/EmptyState'

// ── Buttons (thin wrappers around shadcn Button) ─────────────────────────────

export function SecondaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button variant="secondary" size="sm" onClick={onClick}>{children}</Button>
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button size="sm" onClick={onClick}>{children}</Button>
}

export function DangerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button variant="destructive" size="sm" onClick={onClick}>{children}</Button>
}

export function IconActionButton({
  onClick,
  icon,
  title,
  variant = 'neutral',
}: {
  onClick: () => void
  icon: ReactNode
  title: string
  variant?: 'neutral' | 'primary' | 'danger'
}) {
  const v = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : 'secondary'
  return <Button variant={v as any} size="icon" onClick={onClick} title={title} aria-label={title}>{icon}</Button>
}

// ── Inline team name editor ──────────────────────────────────────────────────

export function InlineTeamName({
  team,
  onOpen,
  onRenameInline,
}: {
  team: Team
  onOpen: () => void
  onRenameInline: (nextName: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(team.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(team.name)
  }, [team.name, editing])

  async function commit() {
    const next = draft.trim()
    if (!next || next === team.name) {
      setDraft(team.name)
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onRenameInline(next)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-left">
      {team.avatar_url ? (
        <img
          src={team.avatar_url}
          alt={team.name}
          className="h-7 w-7 rounded-full border border-border object-cover"
        />
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: entityColorHsl(team.id) }}
        >
          {initials(team.name).slice(0, 2)}
        </span>
      )}
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!saving) void commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
            if (e.key === 'Escape') {
              setDraft(team.name)
              setEditing(false)
            }
          }}
          autoFocus
          disabled={saving}
          className="min-w-[120px] bg-transparent px-0 py-0 text-sm font-medium text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setEditing(true)
          }}
          className="font-medium text-foreground hover:underline"
          title="Double-click to rename"
        >
          {team.name}
        </button>
      )}
    </div>
  )
}

// ── Inline team description editor ───────────────────────────────────────────

export function InlineTeamDescription({
  team,
  onUpdateDescription,
}: {
  team: Team
  onUpdateDescription: (nextDescription: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(team.description ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(team.description ?? '')
  }, [team.description, editing])

  async function commit() {
    const next = draft.trim()
    const current = (team.description ?? '').trim()
    if (next === current) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onUpdateDescription(next)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!saving) void commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          }
          if (e.key === 'Escape') {
            setDraft(team.description ?? '')
            setEditing(false)
          }
        }}
        autoFocus
        disabled={saving}
        className="w-full min-w-[120px] bg-transparent px-0 py-0 text-xs text-muted-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setEditing(true)
      }}
      className="w-full truncate bg-transparent p-0 text-left text-xs text-muted-foreground"
      title="Double-click to edit description"
    >
      {team.description?.trim() || '—'}
    </button>
  )
}

// ── Team members preview (stacked avatars) ───────────────────────────────────

export function TeamMembersPreview({
  members,
  total,
}: {
  members: TeamMember[]
  total: number
}) {
  const visible = members.slice(0, 3)
  const hidden = Math.max(0, total - visible.length)

  return (
    <div className="inline-flex min-w-[110px] items-center gap-1.5">
      <div className="flex items-center">
        {visible.map((m, idx) => {
          return m.avatar_url ? (
            <img
              key={m.user_id}
              src={m.avatar_url}
              alt={m.full_name || m.email}
              className={cn(
                'h-5 w-5 rounded-full border border-white object-cover ring-1 ring-border',
                idx > 0 ? '-ml-1.5' : '',
              )}
            />
          ) : (
            <span
              key={m.user_id}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-semibold text-white ring-1 ring-border',
                idx > 0 ? '-ml-1.5' : '',
              )}
              style={{ backgroundColor: entityColorHsl(m.user_id) }}
            >
              {initials(m.full_name || m.email).slice(0, 2)}
            </span>
          )
        })}
        {hidden > 0 && (
          <span className={cn('rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground', visible.length > 0 ? '-ml-1' : '')}>
            ...
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">({total})</span>
    </div>
  )
}

// ── Team tile card ───────────────────────────────────────────────────────────

export function TeamTile({ team }: { team: Team }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition hover:border-border hover:shadow-sm">
      <div className="h-1 w-full bg-foreground/20 dark:bg-foreground/10" />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: entityColorHsl(team.id) }}
          >
            {initials(team.name).slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{team.name}</div>
            <div className="text-[10px] text-muted-foreground">{team.member_count} member{team.member_count === 1 ? '' : 's'}</div>
          </div>
        </div>
        {team.description && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{team.description}</p>}
      </div>
    </div>
  )
}

// ── Breadcrumb (shadcn) ──────────────────────────────────────────────────────

export function Breadcrumb({
  org,
  selection,
  teams,
  members,
  onSelect,
}: {
  org: Org
  selection: Exclude<Selection, null>
  teams: Team[]
  members: Member[]
  onSelect: (sel: Selection) => void
}) {
  const crumbs: Array<{ label: string; onClick?: () => void; icon?: ReactNode }> = [
    {
      label: org.name,
      icon: <Building2 size={11} />,
      onClick: () => onSelect({ kind: 'org', orgId: org.id }),
    },
  ]
  if (selection.kind === 'teams-folder') {
    crumbs.push({ label: 'Teams', icon: <UsersRound size={11} /> })
  }
  if (selection.kind === 'team') {
    crumbs.push({
      label: 'Teams',
      icon: <UsersRound size={11} />,
      onClick: () => onSelect({ kind: 'teams-folder', orgId: org.id }),
    })
    const t = teams.find((x) => x.id === selection.teamId)
    crumbs.push({ label: t?.name ?? 'Team' })
  }
  if (selection.kind === 'people-folder') {
    crumbs.push({ label: 'People', icon: <Users size={11} /> })
  }
  if (selection.kind === 'member') {
    crumbs.push({
      label: 'People',
      icon: <Users size={11} />,
      onClick: () => onSelect({ kind: 'people-folder', orgId: org.id }),
    })
    const m = members.find((x) => x.user_id === selection.userId)
    crumbs.push({ label: m?.full_name || m?.email || 'Member' })
  }
  if (selection.kind === 'invites-folder') {
    crumbs.push({ label: 'Invites', icon: <MailPlus size={11} /> })
  }

  return (
    <BreadcrumbRoot>
      <BreadcrumbList className="text-xs gap-1">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <BreadcrumbItem key={i}>
              {!isLast && c.onClick ? (
                <BreadcrumbLink asChild>
                  <button
                    onClick={c.onClick}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-muted hover:text-foreground"
                  >
                    {c.icon}
                    {c.label}
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="inline-flex items-center gap-1 px-1.5 py-0.5">
                  {c.icon}
                  {c.label}
                </BreadcrumbPage>
              )}
              {!isLast && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  )
}

// ── Role selector (shadcn Select) ────────────────────────────────────────────

export function RoleSelector({
  role,
  disabled,
  onChange,
}: {
  role: string
  disabled?: boolean
  onChange: (r: string) => void
}) {
  return (
    <Select value={role} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-7 w-[90px] text-[11px] capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="guest">guest</SelectItem>
        <SelectItem value="member">member</SelectItem>
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="owner">owner</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── Info card ────────────────────────────────────────────────────────────────

export function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  )
}

// ── Empty states (using shared EmptyState block) ─────────────────────────────

export function EmptyTree({ onCreate, query }: { onCreate: () => void; query: string }) {
  if (query) {
    return (
      <EmptyState
        icon={Building2}
        title="No matching organizations"
        className="mx-2 py-6"
      />
    )
  }
  return (
    <EmptyState
      icon={Building2}
      title="No organizations"
      description="Create an organization to group teams, members, and projects."
      action={
        <Button size="sm" onClick={onCreate}>
          <Plus size={11} /> New organization
        </Button>
      }
      className="mx-2 py-6"
    />
  )
}

export function EmptySelection({ onCreate, hasOrgs }: { onCreate: () => void; hasOrgs: boolean }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={Building2}
        title={hasOrgs ? 'Select something from the tree' : 'Welcome to your workspaces'}
        description={
          hasOrgs
            ? 'Click an organization, team, or member on the left.'
            : 'Create your first organization to start inviting members and building teams.'
        }
        action={
          !hasOrgs ? (
            <Button onClick={onCreate}>
              <Plus size={14} /> Create organization
            </Button>
          ) : undefined
        }
        className="border-none bg-transparent"
      />
    </div>
  )
}
