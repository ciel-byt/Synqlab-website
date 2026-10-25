import React, { useRef, useState, useEffect } from 'react'
import {
  Bot,
  Briefcase,
  ChevronRight,
  Info,
  Loader2,
  MessageSquare,
  Send,
  User as UserIcon,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserPicker, type PickedUser } from '@/components/shared/UserPicker'

import type { Session, Message, Participant } from '@/features/chat/types'
import { initials } from '@/features/chat/helpers'
import { MessageBubble } from '@/features/chat/components/MessageBubble'

interface ChatAreaProps {
  activeSession: Session
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  loadingMessages: boolean
  activeParticipants: Participant[]
  chatError: string
  setChatError: (err: string) => void
  onMessageSent: () => void
  onAddParticipant: (user: PickedUser) => Promise<void>
}

export function ChatArea({
  activeSession,
  messages,
  setMessages,
  loadingMessages,
  activeParticipants,
  chatError,
  setChatError,
  onMessageSent,
  onAddParticipant,
}: ChatAreaProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isAiChat = activeSession.kind === 'ai'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    // Optimistic bubble
    const tempId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId,
      session_id: activeSession.id,
      role: 'user',
      sender_id: user?.id ?? null,
      sender_name: user?.full_name ?? null,
      sender_avatar: user?.avatar_url ?? null,
      content,
      tool_calls: null,
      tool_results: null,
      created_at: new Date().toISOString(),
    }])

    try {
      const reply = await api.sendChatMessage(activeSession.id, { content })

      setMessages(prev => {
        const without = prev.filter(m => m.id !== tempId)
        return [...without, reply]
      })

      onMessageSent()
      setChatError('')
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setChatError('Failed to send message.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card px-5 py-2.5">
        <div className="flex items-center gap-3">
        {isAiChat ? (
          <Bot size={15} className="text-muted-foreground/70" />
        ) : activeSession.kind === 'dm' ? (
          <UserIcon size={15} className="text-muted-foreground/70" />
        ) : (
          <Users size={15} className="text-muted-foreground/70" />
        )}
        <Popover open={showInfoPanel} onOpenChange={setShowInfoPanel}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="text-sm font-medium text-foreground truncate flex-1 flex items-center justify-start gap-2 px-2 py-1 -ml-2 rounded-md transition-colors outline-none h-auto focus-visible:ring-1 focus-visible:ring-ring">
              <span className="truncate">
                {activeSession.title || (isAiChat ? 'AI Assistant' : activeSession.kind === 'dm' ? 'Direct Message' : 'Group Chat')}
              </span>
              {activeSession.project_name && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                  <Briefcase size={10} />
                  {activeSession.project_name}
                </span>
              )}
              <ChevronRight size={14} className={cn("text-muted-foreground/50 transition-transform shrink-0", showInfoPanel && "rotate-90")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0" sideOffset={8}>
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold text-foreground text-sm">Chat Details</h3>
              {activeSession.project_name ? (
                <p className="text-xs text-muted-foreground mt-1">Project: {activeSession.project_name}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No project assigned</p>
              )}
            </div>
            {!isAiChat && (
              <div className="p-2 max-h-60 overflow-y-auto">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Participants ({activeParticipants.length})
                </div>
                {activeParticipants.map(p => (
                  <div key={p.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.full_name} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                        {initials(p.full_name)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-foreground truncate">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{p.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isAiChat && (
              <div className="p-2 border-t border-border">
                <Popover open={showAddParticipant} onOpenChange={setShowAddParticipant}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-2 py-1.5 text-sm text-primary hover:text-primary hover:bg-primary/5 rounded-md transition-colors h-auto">
                      <UserPlus size={14} />
                      Add someone
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-72 p-0" sideOffset={8}>
                    <UserPicker
                      orgId={activeSession.org_id}
                      onSelect={(user) => {
                        void onAddParticipant(user)
                        setShowAddParticipant(false)
                      }}
                      excluded={activeParticipants.map(p => p.user_id)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Top-right Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className="h-8 w-8 text-muted-foreground/70 hover:text-foreground"
          >
            <Info size={16} />
          </Button>
        </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-2">
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={16} className="animate-spin text-muted-foreground/50" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center max-w-sm mx-auto gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare size={20} className="text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Send a message below to start the conversation.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-8 max-w-4xl mx-auto w-full">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                myId={user?.id ?? ''}
                isAiChat={isAiChat}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 sm:p-6 pt-0 max-w-4xl mx-auto w-full flex-shrink-0 relative">
        <div className={cn(
          "rounded-xl border border-input bg-card shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow flex items-end p-1.5",
          sending && "opacity-70 pointer-events-none"
        )}>
          <Textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isAiChat ? "Message AI Assistant... (Markdown supported)" : "Type a message..."}
            className="flex-1 max-h-32 min-h-[36px] resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            style={{ height: input ? `${Math.min(input.split('\n').length * 20 + 16, 128)}px` : '36px' }}
          />
          <Button
            size="icon"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || sending}
            className="h-8 w-8 flex-shrink-0 mb-0.5 ml-1"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} className="ml-0.5" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-[10px] text-muted-foreground">
            {isAiChat ? "AI can make mistakes. Consider verifying important information." : <span><strong>Shift + Enter</strong> to add a new line</span>}
          </p>
          {chatError && <p className="text-[10px] text-red-500 font-medium">{chatError}</p>}
        </div>
      </div>
    </>
  )
}
