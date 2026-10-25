/**
 * ProjectsTab — project list with layout switcher (Table / Board) and filters.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Globe, LayoutGrid, List, Lock, Plus, Clock, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/blocks/EmptyState'
import { EntityCard } from '@/components/ui/entity-card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Org, Project, Team, TeamMember } from '../types'
import { relativeTime } from '../helpers'

import { PageHeader } from '@/components/ui/page-header'

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  active:   { label: 'Active',   dotClass: 'bg-[hsl(var(--status-ok))]',   badgeClass: 'bg-[hsl(var(--status-ok-bg))] text-[hsl(var(--status-ok-text))] border-[hsl(var(--status-ok)/0.2)]' },
  paused:   { label: 'Paused',   dotClass: 'bg-[hsl(var(--status-warn))]', badgeClass: 'bg-[hsl(var(--status-warn-bg))] text-[hsl(var(--status-warn-text))] border-[hsl(var(--status-warn)/0.2)]' },
  archived: { label: 'Archived', dotClass: 'bg-muted-foreground/50',       badgeClass: 'bg-muted text-muted-foreground border-border' },
}

const ALL = '__all__'

export function ProjectsTab(props: {
  org: Org | null
  projects: Project[]
  teams: Team[]
  teamMembers: Record<string, TeamMember[]>
  loading: boolean
  onNewProject: (prefill?: { orgId?: string; teamId?: string | null }) => void
}) {
  const [layout, setLayout] = useState<'table' | 'board'>('table')
  const [teamFilter, setTeamFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)

  const teamMap = useMemo(() => new Map(props.teams.map((t) => [t.id, t])), [props.teams])

  const filtered = useMemo(() => {
    let list = props.projects
    if (teamFilter !== ALL) list = list.filter((p) => p.team_id === teamFilter)
    if (statusFilter !== ALL) list = list.filter((p) => p.status === statusFilter)
    return list
  }, [props.projects, teamFilter, statusFilter])

  if (!props.org) return <EmptyState icon={FolderOpen} title="Select an organization" />
  if (props.loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading projects…</div>

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
      {/* Header row — title + layout toggle + New project */}
      <PageHeader
        title="Projects"
        description={`${props.projects.length} project${props.projects.length === 1 ? '' : 's'} in ${props.org.name}`}
        actions={
          <>
            {/* Layout toggle */}
            <ToggleGroup
              type="single"
              value={layout}
              onValueChange={(v) => { if (v) setLayout(v as 'table' | 'board') }}
              className="h-8 mr-2"
            >
              <ToggleGroupItem value="table" aria-label="Table view" className="h-8 w-8 p-0">
                <List size={14} />
              </ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board view" className="h-8 w-8 p-0">
                <LayoutGrid size={14} />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button size="sm" onClick={() => props.onNewProject({ orgId: props.org!.id })}>
              <Plus size={12} className="mr-1.5" /> New project
            </Button>
          </>
        }
      />

      {/* Filter row */}
      <div className="mb-4 flex items-center gap-3">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>
            {props.teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={teamFilter !== ALL || statusFilter !== ALL ? 'No matching projects' : 'No projects yet'}
          description={teamFilter !== ALL || statusFilter !== ALL ? 'Try changing the filters.' : 'Create your first project to start collaborating.'}
          action={
            teamFilter === ALL && statusFilter === ALL ? (
              <Button variant="link" onClick={() => props.onNewProject({ orgId: props.org!.id })}>
                Create the first one
              </Button>
            ) : undefined
          }
        />
      ) : layout === 'table' ? (
        /* ── Table view ─────────────────────────────────────────────── */
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Project</th>
                  <th className="px-4 py-2.5 font-semibold">Team</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Visibility</th>
                  <th className="px-4 py-2.5 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.archived
                  const team = p.team_id ? teamMap.get(p.team_id) : null
                  return (
                    <tr key={p.id} className="hover:bg-surface/70">
                      <td className="px-4 py-2.5">
                        <Link to={`/workspace/projects/${p.id}`} className="text-sm font-medium text-foreground hover:underline">
                          {p.name}
                        </Link>
                        {p.description && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground max-w-[340px]">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{team?.name ?? p.team_name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.badgeClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                          {p.visibility === 'private' ? <Lock size={10} /> : <Globe size={10} />}
                          {p.visibility || 'public'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{relativeTime(p.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Board view (grouped by status) ─────────────────────────── */
        <div className="grid grid-cols-3 gap-4">
          {(['active', 'paused', 'archived'] as const).map((statusKey) => {
            const cfg = STATUS_CONFIG[statusKey]
            const items = filtered.filter((p) => p.status === statusKey)
            return (
              <div key={statusKey} className="min-h-[200px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/50">{items.length}</span>
                </div>
                <div className="space-y-2">
                {items.map((p) => {
                    const team = p.team_id ? teamMap.get(p.team_id) : null
                    return (
                      <EntityCard
                        key={p.id}
                        layout="horizontal"
                        title={p.name}
                        subtitle={p.description || undefined}
                        href={`/workspace/projects/${p.id}`}
                        icon={{ letter: p.name.charAt(0).toUpperCase(), color: 'hsl(var(--muted))' }}
                        status={{
                          color: p.status === 'active' ? 'green' : p.status === 'paused' ? 'amber' : 'muted',
                          label: cfg.label,
                        }}
                        badges={[
                          ...(team ? [{ icon: UsersRound, count: team.name, title: 'Team' }] : []),
                          { icon: p.visibility === 'private' ? Lock : Globe, count: p.visibility || 'public', title: 'Visibility' },
                          { icon: Clock, count: relativeTime(p.updated_at), title: 'Updated' },
                        ]}
                      />
                    )
                  })}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground/50">
                      No {cfg.label.toLowerCase()} projects
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
