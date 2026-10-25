import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/features/chat/types'
import { initials, paletteForSender } from '@/features/chat/helpers'
import { ToolCallCard } from './ToolCallCard'

export interface MessageBubbleProps {
  msg: Message
  myId: string
  isAiChat: boolean
}

export function MessageBubble({ msg, myId, isAiChat }: MessageBubbleProps) {
  const isMe = msg.sender_id === myId || (isAiChat && msg.role === 'user')
  const isAI = msg.role === 'assistant'
  const senderPalette = paletteForSender(msg.sender_id ?? msg.sender_name ?? msg.id)
  
  const senderName = isMe ? 'You' : isAI ? 'SynqLab Assistant' : (msg.sender_name || 'User')

  return (
    <div className={cn(
      'flex gap-2.5 py-1.5 group max-w-[85%]',
      isMe ? 'ml-auto flex-row-reverse' : 'mr-auto',
    )}>
      {/* Avatar */}
      {isAI ? (
        <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={14} className="text-primary" />
        </div>
      ) : !isMe ? (
        <div className={cn(
          'h-7 w-7 rounded-full text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5',
          senderPalette.avatar,
        )}>
          {msg.sender_avatar
            ? <img src={msg.sender_avatar} alt={senderName} className="h-7 w-7 rounded-full object-cover" />
            : initials(senderName)}
        </div>
      ) : null}

      <div className={cn(
        'space-y-0.5 min-w-0',
        isMe ? 'items-end' : '',
      )}>
        {/* Sender name — hidden for own messages */}
        {!isMe && (
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[11px] font-semibold text-foreground/70">
              {senderName}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          'rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
          isMe
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : isAI
              ? 'bg-muted/60 text-foreground rounded-tl-sm'
              : 'bg-muted/60 text-foreground rounded-tl-sm',
        )}>
          {msg.content || <span className="opacity-40 italic">…</span>}

          {/* Timestamp inside bubble */}
          {msg.created_at && (
            <span className={cn(
              'block text-[9px] mt-1 text-right',
              isMe ? 'text-primary-foreground/50' : 'text-muted-foreground/40',
            )}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {msg.tool_calls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
          </div>
        )}
      </div>
    </div>
  )
}
