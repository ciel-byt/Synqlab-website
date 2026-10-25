/**
 * MembersTab — member directory with role management and rich profile display.
 * Includes List | Graph toggle for the team network visualization.
 */
import { useMemo, useState } from 'react'
import { List, MailPlus, Network, Search, UserMinus, Users, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/blocks/EmptyState'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { OrgAvatar as Avatar } from '@/features/organization/components'

import { TeamGraph } from './TeamGraph'
import type { Org, Member, Team, TeamMember } from '../types'
import type { Person, TeamSummary } from '@/features/people/types'
import { initials, formatJoined } from '../helpers'

import { PageHeader } from '@/components/ui/page-header'

export function MembersTab(props: {
  org: Org | null
  members: Member[]
  teams: Team[]
  teamMembers: Record<string, TeamMember[]>
  currentUserId: string
  onInvite: () => void
  onChangeRole: (userId: string, role: string) => void
  onRemove: (userId: string, label: string) => void
  onAssignTeams: (userId: string, label: string) => void
}) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'list' | 'graph'>('list')

  const filtered = useMemo(() => {
    if (!query.trim()) return props.members
    const lower = query.toLowerCase()
    return props.members.filter(
      (m) => m.email.toLowerCase().includes(lower) || m.full_name.toLowerCase().includes(lower),
    )
  }, [props.members, query])

  if (!props.org) return <EmptyState icon={Users} title="Select an organization" />

  // Build team lookup for each member
  const memberTeams = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const team of props.teams) {
      for (const tm of (props.teamMembers[team.id] ?? [])) {
        if (!map[tm.user_id]) map[tm.user_id] = []
        map[tm.user_id].push(team.name)
      }
    }
    return map
  }, [props.teams, props.teamMembers])

  // Bridge workspace Member[] → People Person[] for graph
  const graphPersons: Person[] = useMemo(() =>
    props.members.map((m) => ({
      id: m.user_id,
      email: m.email,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
      professional_title: m.professional_title,
      short_bio: m.short_bio,
      linkedin_url: m.linkedin_url,
      scholar_url: m.scholar_url,
      skills: m.skills,
      role: m.role,
    })),
    [props.members],
  )

  // Bridge workspace Team[] → People TeamSummary[] for graph
  const graphTeams: TeamSummary[] = useMemo(() =>
    props.teams.map((t) => ({
      id: t.id,
      org_id: t.org_id,
      name: t.name,
      description: t.description,
      avatar_url: t.avatar_url,
      member_count: t.member_count,
    })),
    [props.teams],
  )

  // Build member team mapping by user_id → team names (graph needs id-based lookup)
  const graphMemberTeams = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const team of props.teams) {
      for (const tm of (props.teamMembers[team.id] ?? [])) {
        if (!map[tm.user_id]) map[tm.user_id] = []
        map[tm.user_id].push(team.name)
      }
    }
    return map
  }, [props.teams, props.teamMembers])

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto flex flex-col h-full w-full">
      <PageHeader
        title="Members"
        description={`${props.members.length} member${props.members.length === 1 ? '' : 's'} in ${props.org.name}`}
        actions={
          <>
            {/* View toggle */}
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => { if (v) setView(v as 'list' | 'graph') }}
              className="h-8 mr-2"
            >
              <ToggleGroupItem value="list" aria-label="List view" className="h-8 w-8 p-0">
                <List size={14} />
              </ToggleGroupItem>
              <ToggleGroupItem value="graph" aria-label="Graph view" className="h-8 w-8 p-0">
                <Network size={14} />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" onClick={props.onInvite}>
              <MailPlus size={12} className="mr-1.5" /> Invite member
            </Button>
          </>
        }
      />

      {view === 'graph' ? (
        /* ── Graph view ──────────────────────────────────────────────── */
        <TeamGraph
          teams={graphTeams}
          members={graphPersons}
          memberTeams={graphMemberTeams}
          searchTerm={query}
          autoFit
          className="flex-1 min-h-[400px]"
        />
      ) : (
        /* ── List view ───────────────────────────────────────────────── */
        <>
          {/* Search */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or email…"
                className="w-full rounded-md border border-border bg-card py-1.5 pl-7 pr-7 text-xs outline-none focus:border-ring"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query ? 'No matching members' : 'No members yet'}
              description={query ? 'Try a different search.' : 'Invite people to start collaborating.'}
              action={!query ? <Button variant="link" onClick={props.onInvite}>Invite member</Button> : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-left">
                  <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Member</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold">Teams</th>
                      <th className="px-4 py-2.5 font-semibold">Joined</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((m) => {
                      const isSelf = m.user_id === props.currentUserId
                      const mTeams = memberTeams[m.user_id] ?? []
                      return (
                        <tr key={m.user_id} className="hover:bg-surface/70 group">
                          <td className="px-4 py-3">
                            <Link to={`/workspace/members/${m.user_id}`} className="flex items-center gap-2.5 group/link">
                              <Avatar seed={m.email} label={initials(m.full_name || m.email)} imageUrl={m.avatar_url} />
                              <span className="text-sm font-medium text-foreground group-hover/link:underline">{m.full_name || m.email}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{m.role}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {mTeams.length === 0 ? (
                                <span className="text-xs text-muted-foreground/40 italic">No teams</span>
                              ) : (
                                <>
                                  {mTeams.slice(0, 3).map((name) => (
                                    <span key={name} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/80">{name}</span>
                                  ))}
                                  {mTeams.length > 3 && <span className="text-[10px] text-muted-foreground/50">+{mTeams.length - 3}</span>}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatJoined(m.joined_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => props.onAssignTeams(m.user_id, m.full_name || m.email)}
                                disabled={isSelf}
                                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                title="Assign teams"
                              >
                                <UsersRound size={13} />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => props.onRemove(m.user_id, m.full_name || m.email)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Remove member"
                                >
                                  <UserMinus size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
