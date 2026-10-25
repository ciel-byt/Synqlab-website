/**
 * AgentSessionList — sidebar listing agent sessions with create/delete.
 */

import { Bot, Plus, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AgentSession } from '@/features/agent/types'

const AGENT_TYPES = [
  { type: 'general', label: 'General Research', icon: '🔬' },
] as const

interface AgentSessionListProps {
  sessions: AgentSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
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

export function AgentSessionList({ sessions, activeSessionId, onSelect, onCreate, onDelete }: AgentSessionListProps) {
  return (
    <div className="flex flex-col h-full w-[280px] border-r border-border/40 bg-background/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Agent Sessions</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {AGENT_TYPES.map(({ type, label, icon }) => (
              <DropdownMenuItem key={type} onSelect={() => onCreate(type)}>
                <span className="mr-2">{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bot className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">
              No sessions yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click <strong>+</strong> to start a new agent session.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={`
                  w-full text-left rounded-lg px-3 py-2.5 transition-colors group
                  ${s.id === activeSessionId
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/50 border border-transparent'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {s.title || 'Untitled Session'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        🔬 {s.agent_type}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {s.autonomy_mode === 'copilot' ? '🤝' : s.autonomy_mode === 'supervised' ? '👁️' : '🚀'} {s.autonomy_mode}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(s.updated_at)}
                      </span>
                    </div>
                    {(s.total_input_tokens + s.total_output_tokens) > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {(s.total_input_tokens + s.total_output_tokens).toLocaleString()} tokens
                        {s.total_tool_calls > 0 && ` · ${s.total_tool_calls} tool calls`}
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
