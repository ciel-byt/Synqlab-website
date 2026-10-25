import { useMemo, useState } from 'react'
import {
  Bot,
  Edit2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Trash2,
  User as UserIcon,
  Users,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { ChatOrg as Org, Session, ChatTab } from '@/features/chat/types'
import { relativeTime } from '@/features/chat/helpers'

// ── Kind display helpers ─────────────────────────────────────────────────────

const KIND_CONFIG: Record<string, {
  label: string
  Icon: typeof Bot
  avatarBg: string
  avatarText: string
}> = {
  ai:    { label: 'AI Assistant',    Icon: Bot,      avatarBg: 'bg-primary',   avatarText: 'text-primary-foreground' },
  dm:    { label: 'Direct message',  Icon: UserIcon, avatarBg: 'bg-muted',     avatarText: 'text-muted-foreground' },
  group: { label: 'Group chat',      Icon: Users,    avatarBg: 'bg-secondary',  avatarText: 'text-secondary-foreground' },
}

function getKindConfig(kind: string) {
  return KIND_CONFIG[kind] ?? KIND_CONFIG.dm
}

interface ChatSidebarProps {
  orgs: Org[]
  sessions: Session[]
  activeSession: Session | null
  loadingSessions: boolean
  viewedAt: Record<string, string>
  onSessionSelect: (s: Session) => void
  onSessionDelete: (s: Session) => void
  onSessionRename: (s: Session, nextTitle: string) => Promise<void>
  onNewChat: () => void
}

export function ChatSidebar({
  orgs,
  sessions,
  activeSession,
  loadingSessions,
  viewedAt,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewChat,
}: ChatSidebarProps) {
  const [selectedOrgId, setSelectedOrgId] = useState('__all__')
  const [sessionQuery, setSessionQuery] = useState('')
  const [activeTab, setActiveTab] = useState<ChatTab>('all')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedOrgId !== '__all__' && s.org_id !== selectedOrgId) return false
      if (activeTab !== 'all' && s.kind !== activeTab) return false
      if (!sessionQuery.trim()) return true
      const q = sessionQuery.trim().toLowerCase()
      const title = (s.title || (s.kind === 'dm' ? 'direct message' : s.kind === 'group' ? 'group chat' : 'ai assistant')).toLowerCase()
      const orgName = (orgs.find(o => o.id === s.org_id)?.name || '').toLowerCase()
      return title.includes(q) || orgName.includes(q)
    })
  }, [sessions, selectedOrgId, activeTab, sessionQuery, orgs])

  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {}
    for (const s of filteredSessions) {
      const pid = s.project_id || 'unassigned'
      if (!groups[pid]) groups[pid] = []
      groups[pid].push(s)
    }
    return groups
  }, [filteredSessions])

  const unreadCount = useMemo(() => {
    return sessions.filter((s) => {
      const viewed = viewedAt[s.id]
      if (!viewed) return s.id !== activeSession?.id
      return new Date(s.updated_at).getTime() > new Date(viewed).getTime()
    }).length
  }, [sessions, viewedAt, activeSession?.id])

  async function handleRenameCommit(s: Session) {
    const next = renameValue.trim()
    setRenamingId(null)
    if (!next || next === s.title) return
    await onSessionRename(s, next)
  }

  const headerBadge = unreadCount > 0 ? (
    <span className="absolute -top-1 -right-1 rounded-full bg-primary text-primary-foreground text-[8px] font-semibold px-1 py-0.5 hidden group-data-[collapsible=icon]:block z-20 pointer-events-none">
      {unreadCount}
    </span>
  ) : null

  const headerContent = (
    <>
      <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
        <SelectTrigger className="h-8 text-xs bg-background">
          <SelectValue placeholder="Select Organization" />
        </SelectTrigger>
        <SelectContent>
          {orgs.length > 1 && <SelectItem value="__all__">All organizations</SelectItem>}
          {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
      
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={sessionQuery}
          onChange={(e) => setSessionQuery(e.target.value)}
          placeholder="Search chats…"
          className="h-8 pl-8 text-xs bg-background"
        />
      </div>

      <div className="mt-1 overflow-x-auto no-scrollbar pb-1">
        <ToggleGroup 
          type="single" 
          value={activeTab} 
          onValueChange={(val) => { if(val) setActiveTab(val as ChatTab) }}
          className="justify-start gap-1"
        >
          {([
            { id: 'all', label: 'All' },
            { id: 'dm', label: 'DM' },
            { id: 'group', label: 'Groups' },
            { id: 'ai', label: 'AI' },
          ] as const).map(tab => (
            <ToggleGroupItem
              key={tab.id}
              value={tab.id}
              className="h-7 px-2 text-xs font-medium capitalize"
            >
              {tab.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  )

  return (
    <PageSidebar 
      title={
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors w-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm group-data-[collapsible=icon]:hidden"
        >
          <Plus size={16} />
          <span>New chat</span>
        </button>
      } 
      headerBadge={headerBadge} 
      headerContent={headerContent}
    >
        {loadingSessions ? (
          <div className="flex justify-center py-8">
            <Loader2 size={14} className="animate-spin text-sidebar-foreground/50" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center text-xs text-sidebar-foreground/50">
            <MessageSquare size={20} className="text-sidebar-foreground/30" />
            <p>No chats found.</p>
            <Button
              variant="link"
              onClick={onNewChat}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Start one
            </Button>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([projectId, projSessions]) => {
            const projectName = projectId === 'unassigned' ? 'Unassigned' : (projSessions[0]?.project_name || 'Project')
            return (
              <SidebarCollapsibleGroup key={projectId} title={projectName} titleClassName="text-sky-600 dark:text-sky-300/80">
                {projSessions.map(s => {
                  const orgName = orgs.find(o => o.id === s.org_id)?.name ?? 'Org'
                  const title = s.title || (s.kind === 'ai' ? 'AI Assistant' : s.kind === 'dm' ? 'Direct message' : 'Group chat')
                  const unread = viewedAt[s.id] ? new Date(s.updated_at) > new Date(viewedAt[s.id]) : s.id !== activeSession?.id
                  const isRenaming = renamingId === s.id
                  const isActive = activeSession?.id === s.id
                  const kindCfg = getKindConfig(s.kind)
                  const KindIcon = kindCfg.Icon

                  return (
                    <SidebarMenuItem key={s.id} className="mb-0.5 last:mb-0 relative">
                      {/* Telegram-style row: avatar | title+subtitle | time+badge */}
                      <button
                        onClick={() => { if (!isRenaming) onSessionSelect(s) }}
                        className={cn(
                          "flex items-center gap-3 rounded-lg transition-all duration-150 w-full text-left px-2.5 py-2",
                          isActive
                            ? "bg-sidebar-accent"
                            : "hover:bg-sidebar-accent/50",
                        )}
                      >
                        {/* Avatar */}
                        <Avatar className={cn("h-10 w-10 shrink-0", kindCfg.avatarBg)}>
                          <AvatarFallback className={cn("bg-transparent", kindCfg.avatarText)}>
                            <KindIcon size={18} />
                          </AvatarFallback>
                        </Avatar>

                        {/* Title + subtitle (center, Telegram-like) */}
                        <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                          {/* Row 1: title + time */}
                          <div className="flex items-center gap-1 min-w-0">
                            {isRenaming ? (
                              <Input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => void handleRenameCommit(s)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); void handleRenameCommit(s) }
                                  if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 text-[13px] font-semibold px-1 py-0 flex-1 min-w-0"
                              />
                            ) : (
                              <span className={cn(
                                "text-[13px] truncate leading-tight flex-1 min-w-0",
                                unread ? "font-bold text-sidebar-foreground" : "font-medium text-sidebar-foreground/90"
                              )}>
                                {title}
                              </span>
                            )}
                            <span className="text-[10px] text-sidebar-foreground/40 tabular-nums shrink-0 ml-auto">
                              {relativeTime(s.updated_at)}
                            </span>
                          </div>

                          {/* Row 2: subtitle + unread badge */}
                          <div className="flex items-center gap-1 mt-0.5 min-w-0">
                            <span className={cn(
                              "text-[11.5px] truncate flex-1",
                              unread ? "text-sidebar-foreground/70" : "text-sidebar-foreground/45"
                            )}>
                              {selectedOrgId === '__all__' && orgName ? `${orgName} · ` : ''}
                              {kindCfg.label}
                            </span>
                            {unread && (
                              <Badge variant="default" className="h-[18px] min-w-[18px] px-1 text-[9px] rounded-full justify-center shrink-0">
                                1
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Icon-only collapsed view */}
                        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full py-2 relative">
                          <KindIcon size={16} className="text-sidebar-foreground/70" />
                          {unread && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      </button>

                      {/* Dropdown menu — positioned top-right */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="absolute right-2 top-2 h-5 w-5 flex items-center justify-center rounded-sm text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors opacity-0 group-hover/menu:opacity-100 focus:opacity-100 z-10">
                            <MoreHorizontal size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.title ?? '') }}>
                            <Edit2 className="mr-2 h-4 w-4 text-muted-foreground" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSessionDelete(s) }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarCollapsibleGroup>
            )
          })
        )}
    </PageSidebar>
  )
}
