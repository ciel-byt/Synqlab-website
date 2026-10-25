/**
 * MemberDetailView — routed view for /workspace/members/:userId.
 *
 * Minimal layout aligned with the workspace design language.
 */
import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { useWorkspace } from '@/pages/WorkspacePage'
import { RoleSelector } from '@/features/organization/components/shared'
import { initials, formatDate, roleBadgeClass } from '../helpers'
import { entityColorHsl } from '@/lib/entity-colors'

export function MemberDetailView() {
  const d = useWorkspace()
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const member = d.activeMembers.find((m) => m.user_id === userId)

  // Teams this member belongs to
  const memberTeams = useMemo(() => {
    if (!userId) return []
    return d.activeTeams.filter((t) => {
      const tm = d.teamMembers[t.id] ?? []
      return tm.some((m) => m.user_id === userId)
    })
  }, [userId, d.activeTeams, d.teamMembers])

  // Projects in teams this member belongs to
  const memberProjects = useMemo(() => {
    if (!userId) return []
    const teamIds = new Set(memberTeams.map((t) => t.id))
    return d.projects.filter((p) => p.team_id && teamIds.has(p.team_id))
  }, [userId, memberTeams, d.projects])

  const isSelf = userId === d.user?.id

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Member not found</p>
        <button onClick={() => navigate('/workspace/members')} className="text-xs text-primary hover:underline">
          ← Back to members
        </button>
      </div>
    )
  }

  const hasLinks = member.linkedin_url || member.scholar_url

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/workspace/members')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={11} /> Members
        </button>

        <div className="flex items-start gap-3">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: entityColorHsl(member.email) }}
            >
              {initials(member.full_name || member.email).slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {member.full_name || member.email}
              </h1>
              {isSelf && <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">you</span>}
              {isSelf ? (
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ${roleBadgeClass(member.role)}`}>{member.role}</span>
              ) : (
                <RoleSelector role={member.role} onChange={(r) => d.changeMemberRole(d.activeOrgId, member.user_id, r)} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {member.professional_title || member.email}
              <span className="text-muted-foreground/40"> · </span>
              Joined {formatDate(member.joined_at)}
              {memberTeams.length > 0 && (
                <>
                  <span className="text-muted-foreground/40"> · </span>
                  {memberTeams.length} team{memberTeams.length !== 1 ? 's' : ''}
                </>
              )}
            </p>
            {member.short_bio && (
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[500px]">{member.short_bio}</p>
            )}
            {hasLinks && (
              <div className="flex items-center gap-3 mt-1.5">
                {member.linkedin_url && (
                  <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
                    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </a>
                )}
                {member.scholar_url && (
                  <a href={member.scholar_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
                    <GraduationCap size={10} /> Scholar
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Teams section */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Teams ({memberTeams.length})
        </h2>

        {memberTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Not assigned to any teams yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="min-w-full text-left">
              <thead className="bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Team</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 font-semibold">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {memberTeams.map((t) => {
                  const tMembers = d.teamMembers[t.id] ?? []
                  return (
                    <tr key={t.id} className="hover:bg-surface/70">
                      <td className="px-4 py-2.5">
                        <Link to={`/workspace/teams/${t.id}`} className="flex items-center gap-2 group/link">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: entityColorHsl(t.id) }}
                          >
                            {initials(t.name).slice(0, 1)}
                          </div>
                          <span className="text-sm font-medium text-foreground group-hover/link:underline">{t.name}</span>
                        </Link>
                      </td>
                      <td className="max-w-[200px] px-4 py-2.5 text-xs text-muted-foreground truncate">
                        {t.description || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex -space-x-1.5">
                          {tMembers.slice(0, 4).map((m) => (
                            m.avatar_url ? (
                              <img key={m.user_id} src={m.avatar_url} alt="" title={m.full_name || m.email}
                                className="h-5 w-5 rounded-full object-cover ring-2 ring-card" />
                            ) : (
                              <div key={m.user_id} title={m.full_name || m.email}
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[7px] font-semibold text-muted-foreground ring-2 ring-card">
                                {initials(m.full_name || m.email).slice(0, 1)}
                              </div>
                            )
                          ))}
                          {tMembers.length > 4 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/50">+{tMembers.length - 4}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Projects section */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Projects ({memberProjects.length})
        </h2>

        {memberProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">No projects in this member's teams.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="min-w-full text-left">
              <thead className="bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Project</th>
                  <th className="px-4 py-2.5 font-semibold">Team</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {memberProjects.map((p) => {
                  const team = p.team_id ? d.activeTeams.find((t) => t.id === p.team_id) : null
                  return (
                    <tr key={p.id} className="hover:bg-surface/70">
                      <td className="px-4 py-2.5">
                        <Link to={`/workspace/projects/${p.id}`} className="text-sm font-medium text-foreground hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{team?.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] capitalize text-muted-foreground">{p.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
