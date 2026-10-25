/**
 * Organization tree node components.
 *
 * Uses shadcn sidebar primitives (SidebarMenuItem, SidebarMenuButton) and
 * SidebarCollapsibleGroup for org-level grouping, matching Chat/Projects.
 * Actions rendered via OrgDropdown (shadcn DropdownMenu).
 */
import type { ReactNode } from 'react'
import {
  ChevronRight,
  LogIn,
  MailPlus,
  Users,
  UsersRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Org, Member, Team, Invite, TeamMember, Selection, ContextMenuItem } from '../types'
import { initials, formatRelativeFuture } from '../helpers'
import { OrgDropdown } from './OrgDropdown'
import {
  SidebarMenuItem,
  SidebarMenuAction,
} from '@/components/ui/sidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// ── TreeRow ──────────────────────────────────────────────────────────────────

export function TreeRow({
  level,
  caret = false,
  open = false,
  selected = false,
  onCaret,
  onClick,
  icon,
  label,
  meta,
  actions,
}: {
  level: number
  caret?: boolean
  open?: boolean
  selected?: boolean
  onCaret?: () => void
  onClick?: () => void
  icon: ReactNode
  label: string
  meta?: ReactNode
  /** Inline action elements (e.g. OrgDropdown) — visible on hover */
  actions?: ReactNode
}) {
  const indent = level * 12
  return (
    <SidebarMenuItem className="mb-0.5 last:mb-0 relative">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 rounded-md transition-all duration-150 w-full text-left px-2.5 py-1.5",
          selected
            ? "bg-sidebar-accent"
            : "hover:bg-sidebar-accent/50",
        )}
        style={{ paddingLeft: `${10 + indent}px` }}
      >
        {caret ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onCaret?.()
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-sidebar-foreground/50 transition hover:text-sidebar-foreground"
          >
            <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
          </span>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <span className="flex shrink-0 items-center justify-center">{icon}</span>
        <span className={cn(
          "text-[12.5px] truncate leading-tight flex-1 min-w-0",
          selected ? "font-semibold text-sidebar-foreground" : "font-medium text-sidebar-foreground/90"
        )}>
          {label}
        </span>
        {meta && <span className="shrink-0 ml-auto">{meta}</span>}
      </button>
      {actions && (
        <SidebarMenuAction className="opacity-0 group-hover/menu:opacity-100 transition-opacity right-2 top-1/2 -translate-y-1/2">
          {actions}
        </SidebarMenuAction>
      )}
    </SidebarMenuItem>
  )
}

// ── TreeCount ────────────────────────────────────────────────────────────────

export function TreeCount({ n, icon }: { n: number; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-[1px] text-[9px] font-medium text-muted-foreground tabular-nums">
      {icon}
      {n}
    </span>
  )
}

// ── OrgAvatar — small gradient avatar for tree items ─────────────────────────

function OrgTreeAvatar({ seed: _seed, label, imageUrl, size = 'sm' }: {
  seed: string
  label: string
  imageUrl?: string | null
  size?: 'sm' | 'xs'
}) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-4 w-4'
  const text = size === 'sm' ? 'text-[9px]' : 'text-[8px]'

  return (
    <Avatar className={cn(dim, "shrink-0")}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={label} className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn("text-white font-bold border-0 bg-foreground/60 dark:bg-foreground/40", text)}
      >
        {initials(label).slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
}

// ── OrgTree ──────────────────────────────────────────────────────────────────

export function OrgTree(props: {
  org: Org
  expanded: Set<string>
  selection: Selection
  members: Member[]
  teams: Team[]
  invites: Invite[]
  teamMembersByTeam: Record<string, TeamMember[]>
  onToggle: (key: string, loadOrg?: string, loadTeam?: string) => void
  onSelect: (sel: Selection) => void
  buildOrgMenu: (org: Org) => ContextMenuItem[]
  buildTeamsFolderMenu: (orgId: string) => ContextMenuItem[]
  buildTeamMenu: (orgId: string, team: Team) => ContextMenuItem[]
  buildPeopleFolderMenu: (orgId: string) => ContextMenuItem[]
  buildMemberMenu: (orgId: string, m: Member) => ContextMenuItem[]
  buildInvitesFolderMenu: (orgId: string) => ContextMenuItem[]
}) {
  const {
    org,
    expanded,
    selection,
    members,
    teams,
    invites,
    teamMembersByTeam,
    onToggle,
    onSelect,
    buildOrgMenu,
    buildTeamsFolderMenu,
    buildTeamMenu,
    buildPeopleFolderMenu,
    buildMemberMenu,
    buildInvitesFolderMenu,
  } = props

  const orgOpen = expanded.has(org.id)
  const isSelected = selection?.kind === 'org' && selection.orgId === org.id

  const teamsKey = `teams:${org.id}`
  const peopleKey = `people:${org.id}`
  const invitesKey = `invites:${org.id}`

  return (
    <SidebarCollapsibleGroup
      title={org.name}
      titleClassName="text-[hsl(var(--color-entity-org))]"
      defaultOpen={orgOpen}
    >
      {/* Org root row */}
      <TreeRow
        level={0}
        caret
        open={orgOpen}
        selected={isSelected}
        onCaret={() => onToggle(org.id, org.id)}
        onClick={() => {
          onToggle(org.id, org.id)
          onSelect({ kind: 'org', orgId: org.id })
        }}
        icon={
          <OrgTreeAvatar
            seed={org.slug || org.name}
            label={org.name}
            imageUrl={org.avatar_url}
            size="sm"
          />
        }
        label={org.name}
        meta={
          <div className="flex items-center gap-1.5 text-[9px] text-sidebar-foreground/40 tabular-nums">
            <span className="inline-flex items-center gap-0.5">
              <Users size={9} />
              {members.length}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <UsersRound size={9} />
              {teams.length}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MailPlus size={9} />
              {invites.length}
            </span>
          </div>
        }
        actions={<OrgDropdown items={buildOrgMenu(org)} />}
      />

      {orgOpen && (
        <>
          {/* Teams folder */}
          <TreeRow
            level={1}
            caret
            open={expanded.has(teamsKey)}
            selected={selection?.kind === 'teams-folder' && selection.orgId === org.id}
            onCaret={() => onToggle(teamsKey)}
            onClick={() => {
              onToggle(teamsKey)
              onSelect({ kind: 'teams-folder', orgId: org.id })
            }}
            icon={<UsersRound size={14} style={{ color: 'hsl(var(--color-entity-teams))' }} />}
            label="Teams"
            meta={<TreeCount n={teams.length} />}
            actions={<OrgDropdown items={buildTeamsFolderMenu(org.id)} />}
          />
          {expanded.has(teamsKey) &&
            teams.map((team) => {
              const teamKey = `team:${team.id}`
              const open = expanded.has(teamKey)
              const selected = selection?.kind === 'team' && selection.teamId === team.id
              return (
                <div key={team.id}>
                  <TreeRow
                    level={2}
                    caret
                    open={open}
                    selected={selected}
                    onCaret={() => onToggle(teamKey, undefined, team.id)}
                    onClick={() => {
                      onToggle(teamKey, undefined, team.id)
                      onSelect({ kind: 'team', orgId: org.id, teamId: team.id })
                    }}
                    icon={
                      <OrgTreeAvatar
                        seed={team.id}
                        label={team.name}
                        imageUrl={team.avatar_url}
                        size="xs"
                      />
                    }
                    label={team.name}
                    meta={<TreeCount n={team.member_count} icon={<Users size={9} />} />}
                    actions={<OrgDropdown items={buildTeamMenu(org.id, team)} />}
                  />
                  {open &&
                    (teamMembersByTeam[team.id] ?? []).map((tm) => (
                      <TreeRow
                        key={tm.user_id}
                        level={3}
                        selected={false}
                        onClick={() =>
                          onSelect({ kind: 'member', orgId: org.id, userId: tm.user_id })
                        }
                        icon={
                          <OrgTreeAvatar
                            seed={tm.email}
                            label={tm.full_name || tm.email}
                            imageUrl={tm.avatar_url}
                            size="xs"
                          />
                        }
                        label={tm.full_name || tm.email}
                        meta={<span className="text-[10px] text-sidebar-foreground/40 capitalize">{tm.role}</span>}
                      />
                    ))}
                </div>
              )
            })}
          {expanded.has(teamsKey) && teams.length === 0 && (
            <div className="pl-[54px] pr-3 pb-1 pt-0.5 text-[10px] text-sidebar-foreground/40">
              No teams yet. Use ⋮ menu on Teams to create one.
            </div>
          )}

          {/* People folder */}
          <TreeRow
            level={1}
            caret
            open={expanded.has(peopleKey)}
            selected={selection?.kind === 'people-folder' && selection.orgId === org.id}
            onCaret={() => onToggle(peopleKey)}
            onClick={() => {
              onToggle(peopleKey)
              onSelect({ kind: 'people-folder', orgId: org.id })
            }}
            icon={<Users size={14} style={{ color: 'hsl(var(--color-entity-people))' }} />}
            label="People"
            meta={<TreeCount n={members.length} />}
            actions={<OrgDropdown items={buildPeopleFolderMenu(org.id)} />}
          />
          {expanded.has(peopleKey) &&
            members.map((m) => {
              const selected = selection?.kind === 'member' && selection.userId === m.user_id
              return (
                <TreeRow
                  key={m.user_id}
                  level={2}
                  selected={selected}
                  onClick={() => onSelect({ kind: 'member', orgId: org.id, userId: m.user_id })}
                  icon={
                    <OrgTreeAvatar
                      seed={m.email}
                      label={m.full_name || m.email}
                      imageUrl={m.avatar_url}
                      size="xs"
                    />
                  }
                  label={m.full_name || m.email}
                  meta={<span className="text-[10px] text-sidebar-foreground/40 capitalize">{m.role}</span>}
                  actions={<OrgDropdown items={buildMemberMenu(org.id, m)} />}
                />
              )
            })}

          {/* Invites folder */}
          <TreeRow
            level={1}
            caret
            open={expanded.has(invitesKey)}
            selected={selection?.kind === 'invites-folder' && selection.orgId === org.id}
            onCaret={() => onToggle(invitesKey)}
            onClick={() => {
              onToggle(invitesKey)
              onSelect({ kind: 'invites-folder', orgId: org.id })
            }}
            icon={<MailPlus size={14} style={{ color: 'hsl(var(--color-entity-invites))' }} />}
            label="Invites"
            meta={<TreeCount n={invites.length} />}
            actions={<OrgDropdown items={buildInvitesFolderMenu(org.id)} />}
          />
          {expanded.has(invitesKey) &&
            invites.map((inv) => (
              <TreeRow
                key={inv.id}
                level={2}
                selected={false}
                onClick={() => onSelect({ kind: 'invites-folder', orgId: org.id })}
                icon={<LogIn size={12} style={{ color: 'hsl(var(--color-entity-invites))' }} />}
                label={inv.email || 'Shareable link'}
                meta={<span className="text-[10px] text-sidebar-foreground/40">{formatRelativeFuture(inv.expires_at)}</span>}
              />
            ))}
        </>
      )}
    </SidebarCollapsibleGroup>
  )
}
