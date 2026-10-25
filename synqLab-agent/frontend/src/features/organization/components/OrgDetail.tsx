/**
 * Org overview detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  FolderOpen,
  MailPlus,
  Pencil,
  Plus,
  Trash2,
  UserCircle2,
  Users,
  UsersRound,
} from 'lucide-react'
import type { Org, Member, Team, Invite, TeamMember } from '../types'
import { initials, formatDate, formatJoined, roleBadgeClass } from '../helpers'
import { DetailShell, BigIcon, StatChip, OrgAvatar as Avatar, SectionTitle, EmptyCallout } from '../components'
import {
  PrimaryButton,
  IconActionButton,
  InlineTeamName,
  InlineTeamDescription,
  TeamMembersPreview,
} from './shared'
import { Button } from '@/components/ui/button'

export function OrgDetail(props: {
  org: Org
  members: Member[]
  teams: Team[]
  invites: Invite[]
  crumb: ReactNode
  onNewTeam: () => void
  onInvite: () => void
  onRename: () => void
  onRenameInline: (nextName: string) => Promise<void>
  onDelete: () => void
  onUploadLogo: () => void
  onSelectTeam: (teamId: string) => void
  onRenameTeam: (teamId: string, current: string) => void
  onRenameTeamInline: (teamId: string, nextName: string) => Promise<void>
  onUpdateTeamDescriptionInline: (teamId: string, nextDescription: string) => Promise<void>
  onDeleteTeam: (teamId: string, label: string) => void
  onOpenTeams: () => void
  onOpenMembers: () => void
  onOpenInvites: () => void
  teamMembersByTeam: Record<string, TeamMember[]>
}) {
  const { org, members, teams, invites, teamMembersByTeam } = props
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(org.name)
  const [savingName, setSavingName] = useState(false)
  const sortedMembers = [...members].sort((a, b) => {
    const rank = (role: string) => (role === 'owner' ? 0 : role === 'admin' ? 1 : role === 'member' ? 2 : 3)
    const rr = rank(a.role) - rank(b.role)
    if (rr !== 0) return rr
    return (a.full_name || a.email).localeCompare(b.full_name || b.email)
  })
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.member_count !== a.member_count) return b.member_count - a.member_count
    return a.name.localeCompare(b.name)
  })

  useEffect(() => {
    if (!editingName) setNameDraft(org.name)
  }, [org.name, editingName])

  async function commitOrgRename() {
    const next = nameDraft.trim()
    if (!next || next === org.name) {
      setNameDraft(org.name)
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      await props.onRenameInline(next)
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <DetailShell
      crumb={props.crumb}
      icon={
        <BigIcon
          seed={org.slug || org.name}
          label={initials(org.name).slice(0, 2)}
          imageUrl={org.avatar_url}
          onClick={props.onUploadLogo}
        />
      }
      title={
        editingName ? (
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (!savingName) void commitOrgRename()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commitOrgRename()
              }
              if (e.key === 'Escape') {
                setNameDraft(org.name)
                setEditingName(false)
              }
            }}
            autoFocus
            disabled={savingName}
            className="min-w-[180px] bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditingName(true)
            }}
            className="bg-transparent p-0 text-left text-2xl font-semibold tracking-tight text-foreground"
            title="Double-click to rename"
          >
            {org.name}
          </button>
        )
      }

      subtitle={
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">@{org.slug}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="capitalize text-muted-foreground">{org.plan_tier}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">created {formatDate(org.created_at)}</span>
        </div>
      }
      actions={
        <>
          <IconActionButton onClick={props.onUploadLogo} icon={<UserCircle2 size={14} />} title="Upload organization logo" />
          <IconActionButton onClick={props.onRename} icon={<Pencil size={14} />} title="Rename organization" />
          <IconActionButton onClick={props.onNewTeam} icon={<UsersRound size={14} />} title="New team" />
          <IconActionButton onClick={props.onInvite} icon={<MailPlus size={14} />} title="Invite member" variant="primary" />
          <IconActionButton onClick={props.onDelete} icon={<Trash2 size={14} />} title="Delete organization" variant="danger" />
        </>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <StatChip icon={<Users size={11} />} value={members.length} label="members" onClick={props.onOpenMembers} />
        <StatChip icon={<UsersRound size={11} />} value={teams.length} label="teams" onClick={props.onOpenTeams} />
        <StatChip icon={<MailPlus size={11} />} value={invites.length} label="open invites" onClick={props.onOpenInvites} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Teams</h2>
        <Button variant="secondary" size="sm" onClick={props.onNewTeam}>
          <Plus size={11} /> Add team
        </Button>
      </div>
      {teams.length === 0 ? (
        <EmptyCallout
          icon={<UsersRound size={18} className="text-muted-foreground/70" />}
          title="No teams yet"
          description="Group members into teams to scope projects and share work."
          action={
            <PrimaryButton onClick={props.onNewTeam}>
              <Plus size={12} /> Create team
            </PrimaryButton>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[45vh] overflow-auto">
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
                      <InlineTeamName
                        team={t}
                        onOpen={() => props.onSelectTeam(t.id)}
                        onRenameInline={(nextName) => props.onRenameTeamInline(t.id, nextName)}
                      />
                    </td>
                    <td className="max-w-[340px] px-4 py-2.5 text-xs text-muted-foreground">
                      <InlineTeamDescription
                        team={t}
                        onUpdateDescription={(nextDescription) =>
                          props.onUpdateTeamDescriptionInline(t.id, nextDescription)
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground/80">
                      <TeamMembersPreview members={teamMembersByTeam[t.id] ?? []} total={t.member_count} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => props.onSelectTeam(t.id)} title="Open team" aria-label={`Open ${t.name}`}><FolderOpen size={13} /></Button>
                        <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => props.onRenameTeam(t.id, t.name)} title="Rename team" aria-label={`Rename ${t.name}`}><Pencil size={13} /></Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => props.onDeleteTeam(t.id, t.name)} title="Delete team" aria-label={`Delete ${t.name}`}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8">
        <SectionTitle>Recent members</SectionTitle>
        {members.length === 0 ? (
          <EmptyCallout
            icon={<Users size={18} className="text-muted-foreground/70" />}
            title="No members yet"
            description="Invite people to start collaborating."
            action={<PrimaryButton onClick={props.onInvite}><MailPlus size={12} /> Invite member</PrimaryButton>}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {members.slice(0, 5).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-2">
                <Avatar seed={m.email} label={initials(m.full_name || m.email)} imageUrl={m.avatar_url} />
                <div className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-foreground">{m.full_name || m.email}</span>
                  <span className="text-muted-foreground/50"> · </span>
                  <span className="text-muted-foreground">{m.email}</span>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ${roleBadgeClass(m.role)}`}>{m.role}</span>
                <span className="text-[10px] text-muted-foreground/70">{formatJoined(m.joined_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Users &amp; roles</SectionTitle>
          <span className="text-xs text-muted-foreground">{members.length} user{members.length === 1 ? '' : 's'}</span>
        </div>
        {members.length === 0 ? (
          <EmptyCallout
            icon={<Users size={18} className="text-muted-foreground/70" />}
            title="No users yet"
            description="Invite users to assign organization roles."
            action={<PrimaryButton onClick={props.onInvite}><MailPlus size={12} /> Invite member</PrimaryButton>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="max-h-[40vh] overflow-auto">
              <table className="min-w-full text-left">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">User</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Role</th>
                    <th className="px-4 py-2.5 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedMembers.map((m) => (
                    <tr key={m.user_id} className="hover:bg-surface/70">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar seed={m.email} label={initials(m.full_name || m.email)} imageUrl={m.avatar_url} />
                          <span className="text-sm font-medium text-foreground">{m.full_name || m.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ${roleBadgeClass(m.role)}`}>{m.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatJoined(m.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DetailShell>
  )
}
