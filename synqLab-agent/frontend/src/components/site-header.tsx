/**
 * Site header — top bar with sidebar trigger, theme toggle, and notifications.
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Check, MailPlus, X, PanelLeftClose, PanelLeftOpen, Moon, Sun } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'


import { cn } from '@/lib/utils'
import { api } from '@/api/client'



import { useSidebar } from '@/components/ui/sidebar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { resolved, setTheme } = useTheme()
  const { open, toggleSidebar } = useSidebar()

  // ── Invitations state ────────────────────────────────────────────────────
  const [invites, setInvites] = useState<Array<{
    id: string; org_id: string; org_name: string; role: string;
    direction: string; invitee_email: string | null; invite_url: string;
    created_at: string; expires_at: string; status: string;
  }>>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [seenInviteStatuses, setSeenInviteStatuses] = useState<Record<string, string>>({})

  function seenStorageKey(userId: string) { return `synqlab_invite_seen_${userId}` }
  function readSeenMap(userId: string): Record<string, string> {
    try { const raw = localStorage.getItem(seenStorageKey(userId)); return raw ? JSON.parse(raw) : {} } catch { return {} }
  }
  function writeSeenMap(userId: string, map: Record<string, string>) {
    localStorage.setItem(seenStorageKey(userId), JSON.stringify(map))
  }

  async function loadInvites() {
    if (!user) return
    setInvitesLoading(true)
    try {
      const data = await api.listMyInvites()
      setInvites(data)
      const existing = readSeenMap(user.id)
      if (Object.keys(existing).length === 0 && data.length > 0) {
        const baseline: Record<string, string> = {}
        for (const inv of data) baseline[inv.id] = inv.status
        setSeenInviteStatuses(baseline)
        writeSeenMap(user.id, baseline)
      }
    } catch { setInvites([]) }
    finally { setInvitesLoading(false) }
  }

  useEffect(() => {
    if (!user) { setInvites([]); return }
    setSeenInviteStatuses(readSeenMap(user.id))
    void loadInvites()
  }, [user?.id])

  useEffect(() => {
    const handler = () => { if (user) void loadInvites() }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [user?.id])

  async function acceptInvite(id: string) {
    setBusyInviteId(id)
    try { await api.acceptMyInvite(id); await loadInvites(); navigate('/workspace') }
    finally { setBusyInviteId(null) }
  }
  async function rejectInvite(id: string) {
    setBusyInviteId(id)
    try { await api.rejectMyInvite(id); await loadInvites() }
    finally { setBusyInviteId(null) }
  }

  const pendingIncoming = invites.filter(i => i.direction === 'incoming' && i.status === 'pending').length
  const senderOutcome = invites.filter(i => {
    if (i.direction !== 'outgoing') return false
    if (!['accepted', 'rejected', 'expired'].includes(i.status)) return false
    return seenInviteStatuses[i.id] !== i.status
  }).length
  const pendingCount = pendingIncoming + senderOutcome

  // ── Route-aware breadcrumb ──────────────────────────────────────────────
  // parent2 is optional middle segment for 3-level breadcrumbs
  const SECTION_MAP: Record<string, { label: string; parent: string; parent2?: string; parent2Label?: string }> = {
    // Workspace children
    '/workspace/projects': { label: 'Projects', parent: '/workspace' },
    '/workspace/teams':    { label: 'Teams', parent: '/workspace' },
    '/workspace/members':  { label: 'Members', parent: '/workspace' },
    '/workspace/invites':  { label: 'Invites', parent: '/workspace' },
    '/workspace/settings': { label: 'Settings', parent: '/workspace' },

    // Lab top-level sections
    '/lab/computers':      { label: 'Computers', parent: '/lab' },
    '/lab/pipelines':      { label: 'Pipelines', parent: '/lab' },

    // Agents children — Lab / Agents / …
    '/lab/agents/designer/': { label: 'Canvas', parent: '/lab/agents/designer', parent2: '/lab', parent2Label: 'Pipelines' },
    '/lab/agents/designer': { label: 'Designer', parent: '/lab/pipelines', parent2: '/lab', parent2Label: 'Pipelines' },
    '/lab/agents/console': { label: 'Console', parent: '/lab/agents', parent2: '/lab', parent2Label: 'Agents' },
    '/lab/agents/datasets': { label: 'Storage', parent: '/lab' },
    '/lab/agents/skills': { label: 'Skills', parent: '/lab/agents', parent2: '/lab', parent2Label: 'Agents' },
    '/lab/agents':         { label: 'Agents', parent: '/lab' },

    // Pipelines children — Lab / Pipelines / …
    '/lab/experiments':    { label: 'Experiments', parent: '/lab/pipelines', parent2: '/lab', parent2Label: 'Pipelines' },

    // Computers children — Lab / Computers / …
    '/lab/models':         { label: 'Models', parent: '/lab/computers', parent2: '/lab', parent2Label: 'Computers' },

    // Other Lab pages
    '/docs/flows':          { label: 'Flows', parent: '/docs' },

    // Top-level
    '/docs':               { label: 'Docs', parent: '/' },
    '/chat':               { label: 'Chat', parent: '/' },
    '/database':           { label: 'Database', parent: '/' },
  }

  // Find the most specific matching section
  const currentSection = Object.entries(SECTION_MAP)
    .sort(([a], [b]) => b.length - a.length) // longest match first
    .find(([prefix]) => location.pathname.startsWith(prefix))

  // Determine top-level parent label
  const parentLabel = location.pathname.startsWith('/workspace') ? 'Workspace'
    : location.pathname.startsWith('/docs/flows') ? 'Docs'
    : location.pathname.startsWith('/lab') ? 'Lab'
    : null

  // Only show breadcrumb + X when on a child page (not on overview root)
  const isOnChildPage = currentSection && location.pathname !== currentSection[1].parent
  const has3LevelBreadcrumb = currentSection && currentSection[1].parent2 && currentSection[1].parent2Label

  return (
    <header className="glass-header flex h-14 shrink-0 items-center gap-2 px-4">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        {/* Breadcrumb with X close button */}
        {isOnChildPage && parentLabel && (
          <div className="flex items-center gap-1 ml-1">
            {/* Top-level parent (Lab / Workspace) */}
            <button
              onClick={() => navigate(currentSection[1].parent2 || currentSection[1].parent)}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {parentLabel}
            </button>
            <span className="text-[11px] text-muted-foreground/30">/</span>

            {/* Middle segment for 3-level breadcrumbs */}
            {has3LevelBreadcrumb && (
              <>
                <button
                  onClick={() => navigate(currentSection[1].parent)}
                  className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {currentSection[1].parent2Label}
                </button>
                <span className="text-[11px] text-muted-foreground/30">/</span>
              </>
            )}

            {/* Current section label */}
            <span className="text-[11px] font-medium text-foreground/70">
              {currentSection[1].label}
            </span>
            <button
              onClick={() => navigate(currentSection[1].parent)}
              className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
              title={`Back to ${has3LevelBreadcrumb ? currentSection[1].parent2Label : parentLabel}`}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Right — notifications & theme */}
      {user && (
        <div className="ml-auto flex items-center gap-2">

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                title="Invitations"
              >
                <Bell size={15} />
                {pendingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="end">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="text-sm font-medium">Invitations</div>
                <button onClick={() => void loadInvites()} className="text-xs text-muted-foreground hover:text-foreground">
                  Refresh
                </button>
              </div>
              <div className="max-h-[360px] overflow-auto">
                {invitesLoading ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground">Loading...</div>
                ) : invites.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground">No invitations.</div>
                ) : (
                  invites.map(inv => {
                    const expired = inv.status === 'expired'
                    const pending = inv.direction === 'incoming' && inv.status === 'pending'
                    return (
                      <div key={inv.id} className="border-b border-border px-3 py-2.5 last:border-0">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <MailPlus size={12} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{inv.org_name}</div>
                            <div className="text-xs capitalize text-muted-foreground">
                              {inv.direction === 'incoming'
                                ? `${inv.role} invite for you`
                                : `${inv.role} invite sent${inv.invitee_email ? ` to ${inv.invitee_email}` : ''}`}
                            </div>
                          </div>
                          <span className={cn(
                            'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
                            pending ? 'bg-emerald-50 text-emerald-700'
                              : expired ? 'bg-amber-50 text-amber-700'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            {inv.status}
                          </span>
                        </div>
                        {pending && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              disabled={busyInviteId === inv.id}
                              onClick={() => void acceptInvite(inv.id)}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-card px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <Check size={11} /> Accept
                            </button>
                            <button
                              disabled={busyInviteId === inv.id}
                              onClick={() => void rejectInvite(inv.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-card px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <X size={11} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                title="Toggle theme"
              >
                {resolved === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-[120px]">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun size={14} className="mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon size={14} className="mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  )
}
