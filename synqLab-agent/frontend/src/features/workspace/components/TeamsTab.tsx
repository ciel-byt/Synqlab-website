/**
 * TeamsTab — teams list with member avatars and CRUD.
 * Team name is clickable → navigates to /workspace/teams/:teamId.
 */
import { Link } from 'react-router-dom'
import { ImagePlus, Pencil, Plus, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/blocks/EmptyState'
import { OrgAvatar as Avatar } from '@/features/organization/components'
import type { Org, Team, TeamMember } from '../types'
import { initials, formatDate } from '../helpers'

import { PageHeader } from '@/components/ui/page-header'

export function TeamsTab(props: {
  org: Org | null
  teams: Team[]
  teamMembers: Record<string, TeamMember[]>
  onNewTeam: () => void
  onRenameTeam: (teamId: string, current: string) => void
  onRenameTeamInline: (teamId: string, name: string) => Promise<void>
  onUpdateTeamDescriptionInline: (teamId: string, desc: string) => Promise<void>
  onDeleteTeam: (teamId: string, label: string) => void
  onAddTeamMember: (teamId: string) => void
  onRemoveTeamMember: (teamId: string, userId: string) => void
  onUploadTeamLogo: (teamId: string) => void
}) {
  if (!props.org) return <EmptyState icon={UsersRound} title="Select an organization" />

  const sorted = [...props.teams].sort((a, b) => {
    if (b.member_count !== a.member_count) return b.member_count - a.member_count
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
      <PageHeader
        title="Teams"
        description={`${props.teams.length} team${props.teams.length === 1 ? '' : 's'} in ${props.org.name}`}
        actions={
          <Button size="sm" onClick={props.onNewTeam}>
            <Plus size={12} className="mr-1.5" /> New team
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          description="Group members into teams to scope projects and share work."
          action={<Button variant="link" onClick={props.onNewTeam}>Create a team</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Team</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 font-semibold">Members</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((t) => {
                  const tMembers = props.teamMembers[t.id] ?? []
                  return (
                    <tr key={t.id} className="hover:bg-surface/70 group">
                      <td className="px-4 py-3">
                        <Link to={`/workspace/teams/${t.id}`} className="flex items-center gap-2.5 group/link">
                          <div className="relative group/avatar shrink-0">
                            <Avatar seed={t.id} label={initials(t.name)} imageUrl={t.avatar_url} />
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onUploadTeamLogo(t.id) }}
                              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                              title="Change avatar"
                            >
                              <ImagePlus size={12} className="text-white" />
                            </button>
                          </div>
                          <span className="text-sm font-medium text-foreground group-hover/link:underline">{t.name}</span>
                        </Link>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-xs text-muted-foreground truncate">
                        {t.description || <span className="italic text-muted-foreground/50">No description</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {/* Stacked avatar group */}
                          <div className="flex -space-x-1.5">
                            {tMembers.slice(0, 5).map((m) => (
                              m.avatar_url ? (
                                <img
                                  key={m.user_id}
                                  src={m.avatar_url}
                                  alt={m.full_name || m.email}
                                  title={m.full_name || m.email}
                                  className="h-6 w-6 rounded-full object-cover ring-2 ring-card"
                                />
                              ) : (
                                <div
                                  key={m.user_id}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground ring-2 ring-card"
                                  title={m.full_name || m.email}
                                >
                                  {initials(m.full_name || m.email).slice(0, 2)}
                                </div>
                              )
                            ))}
                          </div>
                          {t.member_count > 5 && (
                            <span className="ml-2 text-[10px] text-muted-foreground/60">+{t.member_count - 5}</span>
                          )}
                          {t.member_count === 0 && (
                            <span className="text-xs text-muted-foreground/50 italic">No members</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => props.onAddTeamMember(t.id)} title="Add member" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><UserPlus size={13} /></button>
                          <button onClick={() => props.onRenameTeam(t.id, t.name)} title="Rename" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => props.onDeleteTeam(t.id, t.name)} title="Delete" className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
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
    </div>
  )
}
