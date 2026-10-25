/**
 * AgentToolCall — expandable card showing a tool invocation's status, inputs, and outputs.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface AgentToolCallProps {
  toolName: string
  arguments: string
  result: Record<string, unknown> | null
  success: boolean | null
  isRunning: boolean
}

export function AgentToolCall({ toolName, arguments: args, result, success, isRunning }: AgentToolCallProps) {
  const [expanded, setExpanded] = useState(false)

  // Parse arguments for display.
  let parsedArgs: Record<string, unknown> = {}
  try {
    parsedArgs = JSON.parse(args)
  } catch {
    parsedArgs = { raw: args }
  }

  const statusBadge = isRunning ? (
    <Badge variant="outline" className="gap-1 border-blue-500/50 text-blue-400 bg-blue-500/10">
      <Loader2 className="h-3 w-3 animate-spin" />
      Running
    </Badge>
  ) : success ? (
    <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
      <CheckCircle2 className="h-3 w-3" />
      Success
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-red-500/50 text-red-400 bg-red-500/10">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  )

  return (
    <Card className="border-border/40 bg-muted/30 backdrop-blur-sm my-2 min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-mono font-medium truncate">{toolName}</span>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Input</p>
            <pre className="text-xs bg-background/60 rounded-md p-3 font-mono border border-border/30 whitespace-pre-wrap break-words">
              {JSON.stringify(parsedArgs, null, 2)}
            </pre>
          </div>

          {result && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
              <pre className="text-xs bg-background/60 rounded-md p-3 font-mono border border-border/30 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
