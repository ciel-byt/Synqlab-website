/**
 * Team detail view.
 * Mechanically extracted from OrganizationPage.tsx.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Pencil, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import type { Org, Team, TeamMember } from '../types'
import { initials, formatDate, roleBadgeClass } from '../helpers'
import { DetailShell, BigIcon, SectionTitle, EmptyCallout, OrgAvatar as Avatar } from '../components'
import { PrimaryButton, IconActionButton } from './shared'
import { Button } from '@/components/ui/button'

export function TeamDetail(props: {
  org: Org
  team: Team
  teamMembers: TeamMember[]
  crumb: ReactNode
  onAddMember: () => void
  onRemoveMember: (userId: string) => void
  onRename: () => void
  onRenameInline: (nextName: string) => Promise<void>
  onDelete: () => void
  onUploadLogo: () => void
}) {
  const { team, teamMembers } = props
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(team.name)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (!editingName) setDraftName(team.name)
  }, [team.name, editingName])

  async function commitInlineRename() {
    const next = draftName.trim()
    if (!next) { setDraftName(team.name); setEditingName(false); return }
    if (next === team.name) { setEditingName(false); return }
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
          seed={team.id}
          label={initials(team.name).slice(0, 2)}
          imageUrl={team.avatar_url}
          onClick={props.onUploadLogo}
        />
      }
      title={
        editingName ? (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => { if (!savingName) void commitInlineRename() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void commitInlineRename() }
              if (e.key === 'Escape') { setDraftName(team.name); setEditingName(false) }
            }}
            autoFocus
            disabled={savingName}
            className="w-full max-w-[420px] bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight text-foreground outline-none"
          />
        ) : (
          <span onDoubleClick={() => setEditingName(true)} className="cursor-text select-none" title="Double-click to rename">
            {team.name}
          </span>
        )
      }

      subtitle={
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">created {formatDate(team.created_at)}</span>
        </div>
      }
      actions={
        <>
          <IconActionButton onClick={props.onRename} icon={<Pencil size={14} />} title="Rename team" />
          <IconActionButton onClick={props.onAddMember} icon={<UserPlus size={14} />} title="Add member" variant="primary" />
          <IconActionButton onClick={props.onDelete} icon={<Trash2 size={14} />} title="Delete team" variant="danger" />
        </>
      }
    >
      {team.description && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-foreground/80">
          {team.description}
        </div>
      )}

      <SectionTitle>Members</SectionTitle>
      {teamMembers.length === 0 ? (
        <EmptyCallout
          icon={<Users size={18} className="text-muted-foreground/70" />}
          title="No team members yet"
          description="Add people from your organization to this team."
          action={<PrimaryButton onClick={props.onAddMember}><UserPlus size={12} /> Add member</PrimaryButton>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {teamMembers.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar seed={m.email} label={initials(m.full_name || m.email)} imageUrl={m.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{m.full_name || m.email}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ${roleBadgeClass(m.role)}`}>{m.role}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => props.onRemoveMember(m.user_id)} title="Remove from team">
                <UserMinus size={12} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DetailShell>
  )
}
