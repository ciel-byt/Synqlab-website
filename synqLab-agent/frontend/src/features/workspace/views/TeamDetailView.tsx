/**
 * TeamDetailView — routed view for /workspace/teams/:teamId.
 *
 * Minimal layout aligned with the workspace design language.
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import { useWorkspace } from '@/pages/WorkspacePage'
import { initials, formatDate } from '../helpers'
import { entityColorHsl } from '@/lib/entity-colors'

export function TeamDetailView() {
  const d = useWorkspace()
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  const team = d.activeTeams.find((t) => t.id === teamId)
  const members = teamId ? d.teamMembers[teamId] ?? [] : []

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Team not found</p>
        <button onClick={() => navigate('/workspace/teams')} className="text-xs text-primary hover:underline">
          ← Back to teams
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
      {/* Header — matches workspace list page style */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/workspace/teams')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={11} /> Teams
        </button>

        <div className="flex items-start gap-3">
          <div className="relative group/avatar shrink-0">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: team.avatar_url ? undefined : entityColorHsl(team.id) }}
            >
              {team.avatar_url ? (
                <img src={team.avatar_url} alt={team.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                initials(team.name).slice(0, 2)
              )}
            </div>
            <button
              onClick={() => d.triggerTeamAvatarUpload(d.activeOrgId, team.id)}
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
              title="Change avatar"
            >
              <ImagePlus size={14} className="text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{team.name}</h1>
            <p className="text-sm text-muted-foreground">
              {team.description || 'No description'}
              <span className="text-muted-foreground/40"> · </span>
              Created {formatDate(team.created_at)}
              <span className="text-muted-foreground/40"> · </span>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Subtle inline actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => d.openAddMemberModal(d.activeOrgId, team.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Add member"
            >
              <UserPlus size={14} />
            </button>
            <button
              onClick={() => {
                d.setRenameCtx({ kind: 'team', orgId: d.activeOrgId, teamId: team.id, current: team.name })
                d.setRenameValue(team.name)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Rename"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => d.setDeleteCtx({ kind: 'team', orgId: d.activeOrgId, teamId: team.id, label: team.name })}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete team"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Members table */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">No members in this team yet.</p>
          <button
            onClick={() => d.openAddMemberModal(d.activeOrgId, team.id)}
            className="text-xs text-primary hover:underline"
          >
            Add first member
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="min-w-full text-left">
            <thead className="bg-surface/95 backdrop-blur-sm">
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Member</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.user_id} className="hover:bg-surface/70 group">
                  <td className="px-4 py-2.5">
                    <Link to={`/workspace/members/${m.user_id}`} className="flex items-center gap-2 group/link">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                          style={{ backgroundColor: entityColorHsl(m.email) }}
                        >
                          {initials(m.full_name || m.email).slice(0, 2)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground group-hover/link:underline">{m.full_name || m.email}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">{m.role}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => d.removeTeamMember(d.activeOrgId, team.id, m.user_id)}
                      className="rounded p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from team"
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
