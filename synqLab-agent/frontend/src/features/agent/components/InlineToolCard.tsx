/**
 * InlineToolCard — collapsible tool call card rendered inline in the chat stream.
 * Shows status icon + tool name in collapsed state, input/output JSON when expanded.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface ToolCallState {
  id: string
  name: string
  arguments: Record<string, unknown> | string
  result: Record<string, unknown> | null
  success: boolean | null
  isRunning: boolean
}

interface InlineToolCardProps {
  toolCall: ToolCallState
}

export function InlineToolCard({ toolCall }: InlineToolCardProps) {
  const [open, setOpen] = useState(false)

  const StatusIcon = toolCall.isRunning ? Loader2
    : toolCall.success ? CheckCircle2 : XCircle
  const statusColor = toolCall.isRunning ? 'text-blue-500 animate-spin'
    : toolCall.success ? 'text-emerald-500' : 'text-rose-500'
  const borderColor = toolCall.isRunning ? 'border-blue-500/20'
    : toolCall.success ? 'border-emerald-500/20' : 'border-rose-500/20'
  const bgColor = toolCall.isRunning ? 'bg-blue-500/5'
    : toolCall.success ? 'bg-emerald-500/5' : 'bg-rose-500/5'

  const formatArgs = () => {
    if (!toolCall.arguments) return null
    if (typeof toolCall.arguments === 'string') {
      if (toolCall.arguments === '{}' || !toolCall.arguments.trim()) return null
      try {
        return JSON.stringify(JSON.parse(toolCall.arguments), null, 2)
      } catch {
        return toolCall.arguments
      }
    }
    if (Object.keys(toolCall.arguments).length === 0) return null
    return JSON.stringify(toolCall.arguments, null, 2)
  }

  const argsStr = formatArgs()

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`my-1.5 ml-11 rounded-md border ${borderColor} ${bgColor} overflow-hidden`}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
          >
            {open
              ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            }
            <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusColor}`} />
            <span className="truncate font-mono text-[11px] flex-1 text-left">{toolCall.name}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/30 px-3 py-2 space-y-2 bg-muted/10">
            {argsStr && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
                <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap break-all text-foreground/80 bg-muted/30 rounded p-1.5 max-h-[120px] overflow-y-auto">
                  {argsStr}
                </pre>
              </div>
            )}
            {toolCall.result && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
                <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap break-all text-foreground/80 bg-muted/30 rounded p-1.5 max-h-[120px] overflow-y-auto">
                  {JSON.stringify(toolCall.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
