/**
 * AgentChat — main chat interface for interacting with an AI agent session.
 *
 * Renders messages, tool calls, copilot proposals, supervised checkpoints,
 * streaming text, and input bar.
 */

import { useState, useRef, useEffect, Fragment, type KeyboardEvent } from 'react'
import { Send, StopCircle, Bot, User, PauseCircle, PlayCircle, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useAgentSession } from '@/features/agent/hooks/useAgentSession'
import { AgentToolProposal } from '@/features/agent/components/AgentToolProposal'
import { InlineToolCard } from '@/features/agent/components/InlineToolCard'
import { InlineArtifactChip } from '@/features/agent/components/InlineArtifactChip'
import { ChatDropZone, type ChatDropZoneHandle } from '@/features/agent/components/ChatDropZone'
import { MarkdownContent } from '@/components/blocks/MarkdownContent'
import { usePipelineWorkshopOptional } from '@/features/agent/contexts/PipelineWorkshopContext'
import { cn } from '@/lib/utils'

interface AgentChatProps {
  sessionId: string
  /** If set, auto-sends this message once the session loads. */
  initialMessage?: string
  /** Called when the session title is updated (e.g. auto-titled from first message). */
  onTitleChange?: (title: string) => void
}

export function AgentChat({ sessionId, initialMessage, onTitleChange }: AgentChatProps) {
  const {
    session, messages, toolCalls, isStreaming, streamingText, error,
    pendingProposals, pendingCheckpoints, artifacts,
    sendMessage, abort, approveToolCall, rejectToolCall,
    continueCheckpoint, stopCheckpoint, refreshArtifacts,
  } = useAgentSession(sessionId)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const dropZoneRef = useRef<ChatDropZoneHandle>(null)
  const initialSentRef = useRef(false)
  const pipelineSyncedRef = useRef<Set<string>>(new Set())
  const canvasRestoredRef = useRef(false)

  // Pipeline workshop integration
  const workshop = usePipelineWorkshopOptional()

  // Pipeline tool names that should auto-open the canvas
  const PIPELINE_TOOLS = new Set([
    'create_pipeline', 'run_pipeline', 'add_canvas_node',
    'connect_canvas_nodes', 'save_pipeline', 'open_canvas',
  ])

  // Restore canvas state from DB-persisted session on load
  useEffect(() => {
    if (!workshop || !session || canvasRestoredRef.current) return
    const saved = session.canvas_state
    if (saved && Array.isArray(saved.nodes) && saved.nodes.length > 0) {
      canvasRestoredRef.current = true
      workshop.loadState(saved)
      workshop.setEnabled(true)
    }
  }, [session, workshop])

  // Watch for pipeline tool results and apply to canvas
  useEffect(() => {
    if (!workshop) return
    for (const tc of toolCalls.values()) {
      if (!tc.result || !tc.success || pipelineSyncedRef.current.has(tc.id)) continue
      if (!PIPELINE_TOOLS.has(tc.name)) continue

      // Auto-open canvas split when any pipeline tool fires
      if (!workshop.enabled) {
        workshop.setEnabled(true)
      }

      pipelineSyncedRef.current.add(tc.id)
      const result = tc.result as Record<string, any>

      if (tc.name === 'create_pipeline' || tc.name === 'run_pipeline') {
        // Full template → replace canvas
        const nodes = result?.nodes || result?.data?.nodes
        if (Array.isArray(nodes) && nodes.length > 0) {
          workshop.clearAll()
          if (result.name) workshop.setName(result.name)
          for (const [idx, n] of nodes.entries()) {
            workshop.addNode({
              id: n.id || `node-${idx}`,
              tool_name: n.tool_name || n.tool || '',
              label: n.label || n.tool_name || '',
              parameters: n.parameters || {},
              depends_on: n.depends_on || [],
              position: n.position || { x: 100 + idx * 220, y: 120 },
            })
          }
        }
      } else if (tc.name === 'add_canvas_node' && result.action === 'add_node') {
        // Single node add → append to canvas
        const n = result.node
        if (n) {
          const existingNodes = workshop.state.nodes
          const lastX = existingNodes.length > 0
            ? Math.max(...existingNodes.map(en => (en.position?.x ?? 0))) + 220
            : 100
          workshop.addNode({
            id: n.id,
            tool_name: n.tool_name,
            label: n.label || n.tool_name,
            parameters: n.parameters || {},
            depends_on: n.depends_on || [],
            position: n.position || { x: lastX, y: 120 },
          })
          if (result.edge) {
            workshop.connectNodes(result.edge.source, result.edge.target)
          }
        }
      } else if (tc.name === 'connect_canvas_nodes' && result.action === 'connect_nodes') {
        if (result.edge) {
          workshop.connectNodes(result.edge.source, result.edge.target)
        }
      }
    }
  }, [toolCalls, workshop])

  // Auto-send initial message once session is loaded
  useEffect(() => {
    if (initialMessage && session && !initialSentRef.current && !isStreaming && messages.length === 0) {
      initialSentRef.current = true
      sendMessage(initialMessage, buildPipelineCtx())
    }
  }, [initialMessage, session, isStreaming, messages.length, sendMessage])

  // Stable ref for onTitleChange to avoid infinite effect loops
  // (parent passes an inline arrow that changes every render).
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange

  // Bubble up title changes to the parent (sidebar sync).
  useEffect(() => {
    if (session?.title && onTitleChangeRef.current) {
      onTitleChangeRef.current(session.title)
    }
  }, [session?.title])

  // Auto-scroll on new messages or streaming text.
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, streamingText, pendingProposals.length, pendingCheckpoints.length])

  const buildPipelineCtx = () => {
    if (!workshop?.enabled) return undefined
    // Build a human-readable summary of canvas state
    const { nodes, edges, name } = workshop.state
    let canvasState = ''
    if (nodes.length > 0) {
      const nodeList = nodes.map((n: { label?: string; tool_name: string; id: string }) =>
        `${n.label || n.tool_name} (${n.id})`
      ).join(' → ')
      canvasState = `Nodes on canvas: ${nodeList}`
      if (name) canvasState = `Pipeline name: "${name}"\n${canvasState}`
      if (edges.length > 0) {
        const connList = edges.map((e: { source: string; target: string }) =>
          `${e.source} → ${e.target}`
        ).join(', ')
        canvasState += `\nConnections: ${connList}`
      }
    } else {
      canvasState = 'Canvas is empty — no nodes yet.'
    }
    return {
      pipeline_mode: true,
      canvas_state: canvasState,
      // Structured JSON for DB persistence (saved at end of chat turn).
      canvas_state_json: workshop.toJSON(),
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage(text, buildPipelineCtx())
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }



  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* ── Message area ───────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center pt-16 pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-primary/50" />
                </div>
                <p className="text-sm text-muted-foreground/50">
                  Send a message to begin
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // Tool-role messages are rendered inline via tool cards — skip here.
              if (msg.role === 'tool') return null

              // Assistant messages with no text content (tool-call-only turns) — skip the empty bubble,
              // but still render the tool cards below.
              const hasContent = msg.content && msg.content.trim().length > 0

              return (
                <Fragment key={msg.id}>
                  {/* Only render the message bubble if there's actual content */}
                  {hasContent && (
                    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role !== 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed overflow-x-auto ${
                          msg.role === 'user'
                            ? 'max-w-[75%] bg-primary text-primary-foreground'
                            : 'flex-1 min-w-0 bg-muted/50 text-foreground border border-border/30'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        ) : (
                          <MarkdownContent content={msg.content ?? ''} className="prose-sm prose-slate dark:prose-invert max-w-none" />
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline tool call cards + artifact chips — anchored to this assistant turn */}
                  {msg.role === 'assistant' && msg.tool_calls?.map((tc: { id: string }) => {
                    const state = toolCalls.get(tc.id)
                    if (!state) return null
                    const result = state.result as Record<string, unknown> | null
                    const artifactId = result && typeof result.artifact_id === 'string' ? result.artifact_id : null
                    const art = artifactId ? artifacts.find((a: { id: string }) => a.id === artifactId) : null
                    return (
                      <Fragment key={tc.id}>
                        <InlineToolCard toolCall={state} />
                        {art && <InlineArtifactChip sessionId={sessionId} artifact={art} />}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}

            {/* Copilot mode: pending proposals */}
            {pendingProposals.map((p) => (
              <AgentToolProposal
                key={p.id}
                toolCallId={p.id}
                toolName={p.name}
                arguments={p.arguments}
                onApprove={approveToolCall}
                onReject={rejectToolCall}
              />
            ))}

            {/* Supervised mode: checkpoints */}
            {pendingCheckpoints.map((cp) => (
              <Card key={cp.id} className="border-2 border-blue-500/40 bg-blue-500/5 my-2">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <PauseCircle className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Checkpoint
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{cp.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {cp.toolCallsSoFar} tool calls completed so far
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => continueCheckpoint(cp.id)}
                      className="gap-1.5 flex-1"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => stopCheckpoint(cp.id)}
                      className="gap-1.5 flex-1 text-destructive hover:text-destructive"
                    >
                      <StopCircle className="h-4 w-4" />
                      Stop Here
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Streaming text */}
            {isStreaming && streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed bg-muted/50 text-foreground border border-border/30 overflow-x-auto">
                  <MarkdownContent content={streamingText} className="prose-sm prose-slate dark:prose-invert max-w-none" />
                  <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* Streaming indicator */}
            {isStreaming && !streamingText && pendingProposals.length === 0 && pendingCheckpoints.length === 0 && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 text-sm bg-muted/50 border border-border/30 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span>Agent is thinking…</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Input bar ────────────────────────────────────────── */}
        <ChatDropZone
          ref={dropZoneRef}
          sessionId={sessionId}
          onUploaded={() => refreshArtifacts(sessionId)}
        >
          <div className="border-t border-border/40 bg-background/80 backdrop-blur-sm px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the agent anything…"
                rows={1}
                className="min-h-[44px] max-h-[160px] resize-none bg-muted/30 border-border/40 focus-visible:ring-primary/30"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button variant="destructive" size="icon" onClick={abort} className="flex-shrink-0 h-[44px] w-[44px]">
                  <StopCircle className="h-5 w-5" />
                </Button>
              ) : (
                <Button size="icon" onClick={handleSend} disabled={!input.trim()} className="flex-shrink-0 h-[44px] w-[44px]">
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Pipeline toggle */}
            {workshop && (
              <div className="flex justify-center mt-1.5">
                <button
                  onClick={() => workshop.setEnabled(!workshop.enabled)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-300',
                    workshop.enabled
                      ? 'bg-primary/20 border border-primary/30 text-primary shadow-[0_0_8px_rgba(var(--primary-rgb,99,102,241),0.3)]'
                      : 'bg-foreground text-background border border-foreground/80 hover:bg-foreground/85',
                  )}
                >
                  <Puzzle className={cn('h-3 w-3', !workshop.enabled && 'animate-pulse')} />
                  Pipeline
                </button>
              </div>
            )}
          </div>
        </ChatDropZone>
      </div>


    </div>
  )
}
