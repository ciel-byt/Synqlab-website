/**
 * AgentsSidebar — sidebar navigation and session list for Agents section.
 */

import { useState, useMemo } from 'react'
import { Bot, Trash2, Search } from 'lucide-react'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import { AgentsNav } from '@/features/agent/components/AgentsNav'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { Input } from '@/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/components/ui/sidebar'
import type { AgentSession } from '@/features/agent/types'

type View = 'console' | 'skills'

interface AgentsSidebarProps {
  view: View
  sessions: AgentSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreate: (agentType: string) => void
  onDelete: (id: string) => void
}

function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr)
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function AgentsSidebar({
  view,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreate,
  onDelete,
}: AgentsSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q)
    )
  }, [sessions, search])

  return (
    <PageSidebar title="Agents">
      {/* Navigation */}
      <AgentsNav active={view} onNewChat={() => onCreate('general')} />

      {/* Session list (Console view only) */}
      {view === 'console' && (
        <SidebarGroup className="flex-1 min-h-0 flex flex-col pt-2">
          <SidebarGroupLabel className="text-[10px]">Sessions ({filtered.length})</SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
            {/* Search */}
            {sessions.length > 0 && (
              <div className="px-1 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sessions..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bot className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-[11px] text-muted-foreground">
                  {sessions.length === 0 ? 'No sessions yet' : 'No matching sessions'}
                </p>
                {sessions.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Click + to start
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((s) => (
                  <SidebarListItem
                    key={s.id}
                    active={s.id === activeSessionId}
                    title={s.title || 'Untitled Session'}
                    onClick={() => onSelectSession(s.id)}
                    subtitle={
                      <span className="text-[9px] text-muted-foreground">
                        {formatRelativeTime(s.updated_at)}
                      </span>
                    }
                    hoverActions={
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                        className="p-1.5 text-muted-foreground/50 hover:text-status-red hover:bg-status-red/10 rounded transition-all"
                        title="Delete session"
                      >
                        <Trash2 size={13} />
                      </button>
                    }
                    hoverActionsAlign="bottom"
                  />
                ))}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </PageSidebar>
  )
}
