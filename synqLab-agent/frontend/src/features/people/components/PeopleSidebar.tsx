import React from 'react'
import {
  Search,
  Users,
  Crown,
  ShieldCheck,
  UserRound,
  X,
  Loader2,
  ChevronDown,
  Mail,
  Link2,
  GraduationCap,
  Plus,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageSidebar } from '@/components/layout/PageSidebar'
import type { Person, PeopleOrg as Org } from '@/features/people/types'
import { cn } from '@/lib/utils'
import { initials } from '@/features/people/helpers'

/* ──────────────── Role meta — chip / icon / accent colors ─────────────── */
export function roleMeta(role?: string): {
  chip: string
  icon: React.ReactNode
  label: string
  dot: string
} {
  const r = (role ?? 'member').toLowerCase()
  if (r === 'owner') {
    return {
      chip: 'bg-primary/10 text-primary border-primary/20',
      icon: <Crown size={11} className="text-primary" />,
      label: 'owner',
      dot: 'bg-primary',
    }
  }
  if (r === 'admin') {
    return {
      chip: 'bg-sidebar-accent text-sidebar-foreground border-border',
      icon: <ShieldCheck size={11} className="text-sidebar-foreground/80" />,
      label: 'admin',
      dot: 'bg-sidebar-foreground/70',
    }
  }
  if (r === 'guest') {
    return {
      chip: 'bg-muted text-muted-foreground border-border',
      icon: <UserRound size={11} className="text-muted-foreground/80" />,
      label: 'guest',
      dot: 'bg-muted-foreground/70',
    }
  }
  return {
    chip: 'bg-sidebar-accent text-sidebar-foreground border-border',
    icon: <UserRound size={11} className="text-sidebar-foreground/80" />,
    label: r,
    dot: 'bg-sidebar-foreground/70',
  }
}

/* ─────────────────────────── Avatar ───────────────────────────────────── */
export function Avatar({ person, size = 30 }: { person: Person; size?: number }) {
  const meta = roleMeta(person.role)
  const bg = (() => {
    if (meta.label === 'owner') return 'bg-foreground dark:bg-foreground/70'
    if (meta.label === 'admin') return 'bg-foreground/80 dark:bg-foreground/50'
    if (meta.label === 'guest') return 'bg-foreground/60 dark:bg-foreground/40'
    return 'bg-foreground/60 dark:bg-foreground/40'
  })()
  return (
    <div
      className={`relative shrink-0 rounded-full ${bg} text-white flex items-center justify-center font-semibold overflow-hidden`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={person.full_name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials(person.full_name)
      )}
    </div>
  )
}

/* ───────────────── Inline person detail (expands under a row) ──────────── */
function PersonInlineDetails({ person, teams }: { person: Person; teams: string[] }) {
  const skills = (person.skills ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  return (
    <div className="px-3 pb-2 pt-0.5 animate-[fadeIn_120ms_ease-out] space-y-1.5">
      {person.short_bio && (
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/60">
          {person.short_bio}
        </p>
      )}

      <div className="flex flex-col gap-0.5 text-[11px] text-sidebar-foreground/50">
        <a
          href={`mailto:${person.email}`}
          className="inline-flex items-center gap-1.5 truncate hover:text-sidebar-foreground"
          onClick={e => e.stopPropagation()}
        >
          <Mail size={11} className="shrink-0" />
          <span className="truncate">{person.email}</span>
        </a>
        {person.linkedin_url && (
          <a
            href={person.linkedin_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 truncate hover:text-sidebar-foreground"
            onClick={e => e.stopPropagation()}
          >
            <Link2 size={11} className="shrink-0" />
            <span className="truncate">LinkedIn</span>
          </a>
        )}
        {person.scholar_url && (
          <a
            href={person.scholar_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 truncate hover:text-sidebar-foreground"
            onClick={e => e.stopPropagation()}
          >
            <GraduationCap size={11} className="shrink-0" />
            <span className="truncate">Scholar</span>
          </a>
        )}
      </div>

      {teams.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {teams.map(name => (
            <span
              key={name}
              className="inline-flex items-center rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-foreground/70"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map(skill => (
            <span
              key={`${person.id}-${skill}`}
              className="inline-flex rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-foreground/50"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="divide-y divide-border group-data-[collapsible=icon]:hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-2 w-44 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ query, hasFilter }: { query: string; hasFilter: boolean }) {
  return (
    <div className="py-12 text-muted-foreground gap-2 flex flex-col items-center justify-center group-data-[collapsible=icon]:hidden">
      <div className="relative h-12 w-12">
        <div
          className="absolute inset-0 rounded-full bg-muted animate-ping"
          style={{ animationDuration: '2.5s' }}
        />
        <div className="absolute inset-0 rounded-full bg-surface border border-border flex items-center justify-center">
          <Users size={22} className="text-muted-foreground/70" />
        </div>
      </div>
      <p className="text-[12px] text-center px-3">
        {query || hasFilter ? (
          <>
            No people match
            {query && (
              <>
                {' '}&ldquo;<span className="font-semibold text-foreground">{query}</span>&rdquo;
              </>
            )}
            {hasFilter && ' with this filter'}.
          </>
        ) : (
          'No members yet. Invite people from the Organization page.'
        )}
      </p>
    </div>
  )
}

interface PeopleSidebarProps {
  orgs: Org[]
  selectedOrgId: string
  setSelectedOrgId: (id: string) => void
  total: number
  query: string
  setQuery: (q: string) => void
  loading: boolean
  loadingMore: boolean
  roleFilter: string | null
  setRoleFilter: (role: string | null) => void
  roleChips: [string, number][]
  members: Person[]
  memberTeams: Record<string, string[]>
  selectedMemberId: string | null
  setSelectedMemberId: React.Dispatch<React.SetStateAction<string | null>>
  rowRefs: React.MutableRefObject<Record<string, HTMLLIElement | null>>
  sentinelRef: React.MutableRefObject<HTMLLIElement | null>
  reachedEnd: boolean
  deferredQuery: string
}

export function PeopleSidebar({
  orgs,
  selectedOrgId,
  setSelectedOrgId,
  total: _total,
  query,
  setQuery,
  loading,
  loadingMore,
  roleFilter,
  setRoleFilter,
  roleChips,
  members,
  memberTeams,
  selectedMemberId,
  setSelectedMemberId,
  rowRefs,
  sentinelRef,
  reachedEnd,
  deferredQuery,
}: PeopleSidebarProps) {
  const selectedOrgLabel = selectedOrgId === '__all__' 
    ? 'All Organizations' 
    : orgs.find(o => o.id === selectedOrgId)?.name ?? 'People'

  const headerContent = (
    <>
      {orgs.length === 1 && (
        <div className="flex items-center justify-between mb-2 group-data-[collapsible=icon]:hidden">
          <h2 className="text-sm font-semibold text-foreground truncate">{selectedOrgLabel}</h2>
        </div>
      )}
      {orgs.length > 1 && (
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue placeholder="Select Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All organizations</SelectItem>
            {orgs.map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="h-8 pl-8 text-xs bg-background pr-8"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground/80">
            <X size={12} />
          </button>
        )}
        {loading && !loadingMore && (
          <Loader2 size={12} className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 animate-spin flex-shrink-0", query ? "right-7" : "right-2")} />
        )}
      </div>

      <div className="mt-1 overflow-x-auto no-scrollbar pb-1 group-data-[collapsible=icon]:hidden">
        <ToggleGroup 
          type="single" 
          value={roleFilter ?? 'all'} 
          onValueChange={(val) => { if (val) setRoleFilter(val === 'all' ? null : val) }}
          className="justify-start gap-1"
        >
          <ToggleGroupItem
            value="all"
            className="h-7 px-2 text-xs font-medium capitalize"
          >
            All
          </ToggleGroupItem>
          {roleChips.map(([role]) => {
            const meta = roleMeta(role)
            return (
              <ToggleGroupItem
                key={role}
                value={role}
                className="h-7 px-2 text-xs font-medium capitalize flex items-center gap-1.5"
              >
                {meta.icon}
                {meta.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>
    </>
  )

  return (
    <PageSidebar 
      title={
        <button
          className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors w-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm group-data-[collapsible=icon]:hidden"
        >
          <Plus size={16} />
          <span>Invite people</span>
        </button>
      }
      headerContent={headerContent}
    >
      <div className="flex-1 overflow-y-auto">
        {loading && members.length === 0 ? (
          <SkeletonList />
        ) : members.length === 0 ? (
          <EmptyState query={deferredQuery} hasFilter={!!roleFilter} />
        ) : (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {members.map(person => {
                  const meta = roleMeta(person.role)
                  const isExpanded = selectedMemberId === person.id
                  const teamsForUser = memberTeams[person.id] ?? []
                  return (
                    <SidebarMenuItem
                      key={person.id}
                      ref={el => { rowRefs.current[person.id] = el }}
                      className="mb-1 last:mb-0"
                    >
                      <button
                        onClick={() =>
                          setSelectedMemberId(prev => (prev === person.id ? null : person.id))
                        }
                        aria-expanded={isExpanded}
                        className={cn(
                          "flex items-center rounded-md transition-all duration-150 w-full text-left px-2.5 py-1.5",
                          isExpanded
                            ? "bg-sidebar-accent"
                            : "hover:bg-sidebar-accent/50",
                        )}
                      >
                        {/* Card content */}
                        <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                          {/* Row 1: avatar + name + chevron */}
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar person={person} size={24} />
                            <span className={cn(
                              "text-[12.5px] font-semibold truncate leading-tight flex-1",
                              isExpanded ? "text-sidebar-foreground" : "text-sidebar-foreground/90"
                            )}>
                              {person.full_name}
                            </span>
                            <ChevronDown
                              size={13}
                              className={cn(
                                "shrink-0 text-muted-foreground/40 transition-transform duration-200",
                                isExpanded && "rotate-180 text-foreground"
                              )}
                            />
                          </div>

                          {/* Row 2: role + teams + title */}
                          <div className="flex items-center gap-1.5 mt-1">
                            {/* Role badge */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0 rounded leading-relaxed capitalize text-muted-foreground/70">
                              {meta.icon}
                              {meta.label}
                            </span>

                            {teamsForUser.length > 0 && (
                              <>
                                <span className="text-sidebar-foreground/20">·</span>
                                <span className="text-[10px] text-sidebar-foreground/50">
                                  {teamsForUser.length} team{teamsForUser.length === 1 ? '' : 's'}
                                </span>
                              </>
                            )}

                            {/* Relative time / title */}
                            {(person.professional_title || person.short_bio) && (
                              <span className="ml-auto text-[10px] text-sidebar-foreground/40 truncate max-w-[90px]">
                                {person.professional_title || person.short_bio}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded inline details */}
                      {isExpanded && (
                        <div className="group-data-[collapsible=icon]:hidden px-1 pb-1">
                          <PersonInlineDetails person={person} teams={teamsForUser} />
                        </div>
                      )}
                    </SidebarMenuItem>
                  )
                })}
                <li ref={sentinelRef} className="h-1" />
                {!reachedEnd && (
                  <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                    <Loader2 size={11} className="animate-spin text-muted-foreground" />
                    Loading more…
                  </div>
                )}
                {reachedEnd && members.length >= 20 && (
                  <div className="py-2 text-center text-[10px] text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                    End of directory · {members.length.toLocaleString()} loaded
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </div>
    </PageSidebar>
  )
}
