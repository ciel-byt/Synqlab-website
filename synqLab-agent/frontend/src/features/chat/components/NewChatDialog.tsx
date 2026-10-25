import { useEffect, useMemo, useState } from 'react'
import { Bot, Briefcase, Check, Loader2, Search, UserIcon, Users, X } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PickedUser } from '@/components/shared/UserPicker'
import type { Org } from '@/features/organization/types'
import type { Session, OrgProject } from '@/features/chat/types'
import { initials } from '@/features/chat/helpers'

export interface OrgMember {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role?: string
}

export interface OrgTeam {
  id: string
  org_id: string
  name: string
  description: string | null
  avatar_url: string | null
  member_count: number
}

export interface NewChatDialogProps {
  open: boolean
  inPage?: boolean
  orgs: Org[]
  defaultOrgId: string
  defaultProjectId?: string | null
  myId: string
  onCreated: (session: Session) => void
  onClose: () => void
}

export type NewChatKind = 'ai' | 'dm' | 'group' | 'team'

export function NewChatDialog({ open, orgs, defaultOrgId, defaultProjectId, myId, onCreated, onClose }: NewChatDialogProps) {
  // ChatPage passes "__all__" as the sidebar filter sentinel — that's not a
  // real org id, so fall back to the first available org for new-chat creation.
  const resolveDefaultOrgId = (val: string) =>
    val && val !== '__all__' ? val : (orgs[0]?.id ?? '')
  const [orgId, setOrgId] = useState(() => resolveDefaultOrgId(defaultOrgId))
  const [kind, setKind] = useState<NewChatKind>('ai')
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '')
  const [projects, setProjects] = useState<OrgProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [participants, setParticipants] = useState<PickedUser[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Inline lists
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')

  const [teams, setTeams] = useState<OrgTeam[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<OrgTeam | null>(null)

  // Reset state every time the drawer is opened
  useEffect(() => {
    if (!open) return
    setOrgId(resolveDefaultOrgId(defaultOrgId))
    setProjectId(defaultProjectId ?? '')
    setKind('ai')
    setParticipants([])
    setSelectedTeam(null)
    setGroupName('')
    setMemberQuery('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultOrgId, defaultProjectId, orgs])

  // Load org members whenever the modal opens or org changes (always shown for DM/Group/Team).
  useEffect(() => {
    if (!open || !orgId) return
    let cancelled = false
    setLoadingMembers(true)
    api.searchPeople(orgId, '', 100)
      .then((data) => {
        if (!cancelled) setMembers(data.filter(m => m.id !== myId) as OrgMember[])
      })
      .catch(() => { if (!cancelled) setMembers([]) })
      .finally(() => { if (!cancelled) setLoadingMembers(false) })
    return () => { cancelled = true }
  }, [open, orgId, myId])

  // Load projects for the selected org
  useEffect(() => {
    if (!open || !orgId) return
    let cancelled = false
    setLoadingProjects(true)
    api.listProjects(orgId)
      .then((data) => { if (!cancelled) setProjects(data as OrgProject[]) })
      .catch(() => { if (!cancelled) setProjects([]) })
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  }, [open, orgId])

  // Load teams when switching to team kind, or when org changes while team is active.
  useEffect(() => {
    if (kind !== 'team' || !orgId) return
    let cancelled = false
    setLoadingTeams(true)
    api.listTeams(orgId)
      .then((data) => {
        if (!cancelled) setTeams(data as OrgTeam[])
      })
      .catch(() => { if (!cancelled) setTeams([]) })
      .finally(() => { if (!cancelled) setLoadingTeams(false) })
    setSelectedTeam(null)
    return () => { cancelled = true }
  }, [kind, orgId])

  // Reset selection when kind/org changes
  useEffect(() => {
    setParticipants([])
    setError('')
  }, [kind, orgId])

  function toggleMember(m: OrgMember) {
    if (kind === 'dm') {
      setParticipants([{ id: m.id, email: m.email, full_name: m.full_name, avatar_url: m.avatar_url }])
    } else {
      setParticipants(prev => prev.find(p => p.id === m.id)
        ? prev.filter(p => p.id !== m.id)
        : [...prev, { id: m.id, email: m.email, full_name: m.full_name, avatar_url: m.avatar_url }],
      )
    }
  }

  async function selectTeam(team: OrgTeam) {
    setSelectedTeam(team)
    setGroupName(team.name)
    setError('')
    try {
      const teamMembers = await api.listTeamMembers(team.id)
      const picked: PickedUser[] = teamMembers
        .filter(m => m.user_id !== myId)
        .map(m => ({ id: m.user_id, email: m.email, full_name: m.full_name, avatar_url: m.avatar_url }))
      setParticipants(picked)
    } catch {
      setError('Failed to load team members.')
    }
  }

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q),
    )
  }, [members, memberQuery])

  const isSelected = (id: string) => participants.some(p => p.id === id)

  async function handleCreate() {
    if (!orgId || orgId === '__all__') {
      setError('Pick an organization.')
      return
    }
    if (kind === 'dm' && participants.length !== 1) {
      setError('Pick exactly one person for a DM.')
      return
    }
    if (kind === 'group' && participants.length < 1) {
      setError('Add at least one person for a group chat.')
      return
    }
    if (kind === 'team') {
      if (!selectedTeam) { setError('Pick a team.'); return }
      if (participants.length < 1) { setError('Selected team has no other members.'); return }
    }
    setCreating(true)
    setError('')
    try {
      // Team chats are stored as 'group' sessions on the backend, titled with the team name.
      const sessionKind = kind === 'team' ? 'group' : kind
      const title = (kind === 'team' && selectedTeam)
        ? selectedTeam.name
        : (kind === 'group' && groupName.trim() ? groupName.trim() : undefined)
      // The "No project" select item uses the sentinel value "__none__"; map it
      // to undefined so the backend doesn't try to look up a project with that id.
      const realProjectId = projectId && projectId !== '__none__' ? projectId : undefined
      const session = await api.createChatSession({
        org_id: orgId,
        kind: sessionKind,
        title,
        participant_ids: participants.map(p => p.id),
        project_id: realProjectId,
      })
      onCreated(session)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create chat')
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div className="mx-auto max-w-2xl w-full py-12 px-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">How can SynqLab help you today?</h2>
        <p className="text-muted-foreground mt-2">Pick a chat type to start collaborating with your team or the AI.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {(orgs.length > 1 || projects.length > 0) && (
            <div className="flex gap-4">
              {orgs.length > 1 && (
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Organization</label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Project tie-in */}
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  Project <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none z-10" />
                  <Select value={projectId} onValueChange={setProjectId} disabled={loadingProjects}>
                    <SelectTrigger className="w-full bg-card pl-9">
                      <SelectValue placeholder="No project · general chat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project · general chat</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.team_name ? ` · ${p.team_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Kind selector */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Chat Type</label>
            <div className="grid grid-cols-4 gap-2">
            {([
              { value: 'ai',    label: 'AI Assistant', icon: Bot },
              { value: 'dm',    label: 'Direct Msg',   icon: UserIcon },
              { value: 'group', label: 'Group Chat',   icon: Users },
              { value: 'team',  label: 'Team Chat',    icon: Users },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setKind(value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-all hover:shadow-sm',
                  kind === value 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                )}
              >
                <Icon size={20} className={kind === value ? 'text-primary' : 'text-muted-foreground/70'} />
                {label}
              </button>
            ))}
            </div>
          </div>

          {/* AI */}
          {kind === 'ai' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80">
              Start a conversation with the SynqLab AI assistant. It can query your experiments, explain results, and help design peptides.
            </div>
          )}

          {/* Group name (only for ad-hoc group, not for team chats which use the team name) */}
          {kind === 'group' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Group name (optional)</label>
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. GFP11 Crew"
              />
            </div>
          )}

          {/* Team picker */}
          {kind === 'team' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Pick a team</label>
              {loadingTeams ? (
                <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground/70" /></div>
              ) : teams.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No teams in this organization yet. Create a team first from the Organization page.
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card">
                  {teams.map(t => {
                    const sel = selectedTeam?.id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void selectTeam(t)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors rounded-md',
                          sel ? 'bg-primary/10 text-primary' : 'hover:bg-surface',
                        )}
                      >
                        <span className={cn(
                          'h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden',
                          sel ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                        )}>
                          {t.avatar_url ? <img src={t.avatar_url} alt={t.name} className="h-8 w-8 object-cover" /> : <Users size={14} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={cn('block font-medium truncate', sel ? 'text-primary' : 'text-foreground')}>{t.name}</span>
                          <span className={cn('block text-xs truncate', sel ? 'text-primary/70' : 'text-muted-foreground/70')}>
                            {t.member_count} member{t.member_count !== 1 ? 's' : ''}
                            {t.description ? ` · ${t.description}` : ''}
                          </span>
                        </span>
                        {sel && <Check size={16} className="text-primary" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* People picker — inline always-visible list */}
          {(kind === 'dm' || kind === 'group' || kind === 'team') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  {kind === 'dm' ? 'Who do you want to message?' : kind === 'team' ? 'Members in this team' : 'Add people'}
                </label>
                {kind !== 'dm' && participants.length > 0 && (
                  <span className="text-xs text-muted-foreground/70">{participants.length} selected</span>
                )}
              </div>

              {/* Search */}
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-muted-foreground/70 flex-shrink-0" />
                <Input
                  value={memberQuery}
                  onChange={e => setMemberQuery(e.target.value)}
                  placeholder="Filter by name or email…"
                  className="pl-9 pr-8"
                />
                {memberQuery && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setMemberQuery('')} 
                    className="absolute right-1 h-6 w-6 text-muted-foreground/70 hover:text-foreground/80"
                  >
                    <X size={12} />
                  </Button>
                )}
              </div>

              {/* Inline member list */}
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-card">
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground/70" /></div>
                ) : filteredMembers.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {members.length === 0 ? 'No other members in this organization yet.' : 'No members match your search.'}
                  </div>
                ) : (
                  <ul>
                    {filteredMembers.map(m => {
                      const sel = isSelected(m.id)
                      const disabled = kind === 'team'
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => !disabled && toggleMember(m)}
                            disabled={disabled}
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0',
                              disabled
                                ? 'cursor-default'
                                : sel
                                ? 'bg-primary/10'
                                : 'hover:bg-surface',
                            )}
                          >
                            <span className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
                              {m.avatar_url
                                ? <img src={m.avatar_url} alt={m.full_name} className="h-8 w-8 rounded-full object-cover" />
                                : initials(m.full_name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-foreground truncate">{m.full_name}</span>
                              <span className="block text-xs text-muted-foreground/70 truncate">{m.email}</span>
                            </span>
                            {kind !== 'dm' && (
                              <span className={cn(
                                'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                                sel ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                              )}>
                                {sel && <Check size={10} strokeWidth={3} />}
                              </span>
                            )}
                            {kind === 'dm' && sel && (
                              <Check size={16} className="text-primary flex-shrink-0" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Selected chips for groups */}
              {(kind === 'group' || kind === 'team') && participants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {participants.map(p => (
                    <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted pl-3 pr-1.5 py-1 text-xs text-foreground/80">
                      {p.full_name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setParticipants(prev => prev.filter(x => x.id !== p.id))}
                        className="h-5 w-5 rounded-full"
                      >
                        <X size={10} />
                      </Button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2 rounded-md transition-colors"
          >
            {creating ? 'Starting…' : 'Start conversation'}
          </Button>
        </div>
      </div>
    </div>
  )
}
