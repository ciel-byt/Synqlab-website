/**
 * Teams folder detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import type { ReactNode } from 'react'
import { FolderOpen, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import type { Org, Team, TeamMember } from '../types'
import { formatDate } from '../helpers'
import { DetailShell, EmptyCallout } from '../components'
import { PrimaryButton, InlineTeamName, InlineTeamDescription, TeamMembersPreview } from './shared'
import { Button } from '@/components/ui/button'

export function TeamsFolderDetail(props: {
  org: Org
  teams: Team[]
  crumb: ReactNode
  onNewTeam: () => void
  onSelectTeam: (teamId: string) => void
  onRenameTeam: (teamId: string, current: string) => void
  onRenameTeamInline: (teamId: string, nextName: string) => Promise<void>
  onUpdateTeamDescriptionInline: (teamId: string, nextDescription: string) => Promise<void>
  onDeleteTeam: (teamId: string, label: string) => void
  teamMembersByTeam: Record<string, TeamMember[]>
}) {
  const sortedTeams = [...props.teams].sort((a, b) => {
    if (b.member_count !== a.member_count) return b.member_count - a.member_count
    return a.name.localeCompare(b.name)
  })

  return (
    <DetailShell
      crumb={props.crumb}
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'hsl(var(--color-entity-teams) / 0.12)', color: 'hsl(var(--color-entity-teams))' }}>
          <UsersRound size={28} />
        </div>
      }
      title="Teams"
      subtitle={`${props.teams.length} team${props.teams.length === 1 ? '' : 's'} in ${props.org.name}`}
      actions={
        <PrimaryButton onClick={props.onNewTeam}>
          <Plus size={12} /> New team
        </PrimaryButton>
      }
    >
      {props.teams.length === 0 ? (
        <EmptyCallout
          icon={<UsersRound size={18} className="text-muted-foreground/70" />}
          title="No teams in this organization"
          description="Teams help group members around shared goals and projects."
          action={<PrimaryButton onClick={props.onNewTeam}><Plus size={12} /> Create team</PrimaryButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[60vh] overflow-auto">
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
                {sortedTeams.map((t) => (
                  <tr key={t.id} className="hover:bg-surface/70">
                    <td className="px-4 py-2.5">
                      <InlineTeamName team={t} onOpen={() => props.onSelectTeam(t.id)} onRenameInline={(nextName) => props.onRenameTeamInline(t.id, nextName)} />
                    </td>
                    <td className="max-w-[340px] px-4 py-2.5 text-xs text-muted-foreground">
                      <InlineTeamDescription team={t} onUpdateDescription={(d) => props.onUpdateTeamDescriptionInline(t.id, d)} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground/80">
                      <TeamMembersPreview members={props.teamMembersByTeam[t.id] ?? []} total={t.member_count} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => props.onSelectTeam(t.id)} title="Open team"><FolderOpen size={13} /></Button>
                        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => props.onRenameTeam(t.id, t.name)} title="Rename team"><Pencil size={13} /></Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => props.onDeleteTeam(t.id, t.name)} title="Delete team"><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DetailShell>
  )
}
