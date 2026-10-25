/**
 * AgentToolProposal — approval card shown in copilot mode when the agent
 * wants to invoke a tool.
 */

import { CheckCircle2, XCircle, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface AgentToolProposalProps {
  toolCallId: string
  toolName: string
  arguments: string
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function AgentToolProposal({ toolCallId, toolName, arguments: args, onApprove, onReject }: AgentToolProposalProps) {
  let parsedArgs: Record<string, unknown> = {}
  try {
    parsedArgs = JSON.parse(args)
  } catch {
    parsedArgs = { raw: args }
  }

  return (
    <Card className="border-2 border-amber-500/40 bg-amber-500/5 backdrop-blur-sm my-2 animate-pulse-slow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
            <Wrench className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Agent wants to call:
          </span>
          <span className="font-mono text-sm font-semibold">{toolName}</span>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Arguments</p>
          <pre className="text-xs bg-background/60 rounded-md p-3 overflow-x-auto font-mono border border-border/30 max-h-[160px] overflow-y-auto">
            {JSON.stringify(parsedArgs, null, 2)}
          </pre>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onApprove(toolCallId)}
            className="gap-1.5 flex-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(toolCallId)}
            className="gap-1.5 flex-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
