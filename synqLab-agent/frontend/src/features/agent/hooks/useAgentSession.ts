/**
 * useAgentSession — React hook for managing an agent conversation.
 *
 * Handles message state, WebSocket streaming, autonomy mode approval, and abort.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/api/client'
import type { AgentSession, AgentMessage, AgentEvent, AgentTask, AgentArtifact } from '@/features/agent/types'

/** Expose the module-scoped auth token for WS query param. */
function getAuthToken(): string | null {
  // Read from localStorage — mirrors AuthContext's token persistence.
  return localStorage.getItem('token')
}

interface ToolCallState {
  id: string
  name: string
  arguments: string
  result: Record<string, unknown> | null
  success: boolean | null
  isRunning: boolean
}

export interface ProposalState {
  id: string
  name: string
  arguments: string
}

export interface CheckpointState {
  id: string
  message: string
  toolCallsSoFar: number
}

interface UseAgentSessionReturn {
  session: AgentSession | null
  messages: AgentMessage[]
  toolCalls: Map<string, ToolCallState>
  isStreaming: boolean
  streamingText: string
  error: string | null
  pendingProposals: ProposalState[]
  pendingCheckpoints: CheckpointState[]
  tasks: AgentTask[]
  artifacts: AgentArtifact[]
  sendMessage: (content: string, pipelineCtx?: { pipeline_mode: boolean; canvas_state: string }) => void
  abort: () => void
  approveToolCall: (id: string) => void
  rejectToolCall: (id: string) => void
  continueCheckpoint: (id: string) => void
  stopCheckpoint: (id: string) => void
  refreshArtifacts: (sid: string) => Promise<void>
}

export function useAgentSession(sessionId: string | null): UseAgentSessionReturn {
  const [session, setSession] = useState<AgentSession | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallState>>(new Map())
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingProposals, setPendingProposals] = useState<ProposalState[]>([])
  const [pendingCheckpoints, setPendingCheckpoints] = useState<CheckpointState[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const streamingTextRef = useRef('')

  const refreshArtifacts = useCallback(async (sid: string) => {
    try {
      const data = await api.listArtifacts(sid)
      setArtifacts(data)
    } catch (err) {
      console.error('Failed to load artifacts:', err)
    }
  }, [])

  /**
   * Rebuild the toolCalls Map from a persisted message history so that tool
   * cards (and any inline artifact chips) reappear after a page reload.
   *
   * Walks messages in order: assistant rows seed entries from `tool_calls`,
   * tool rows merge their JSON-parsed `content` in as the result.
   */
  const reconstructToolCalls = (msgs: AgentMessage[]): Map<string, ToolCallState> => {
    const map = new Map<string, ToolCallState>()
    for (const m of msgs) {
      if (m.role === 'assistant' && m.tool_calls) {
        for (const tc of m.tool_calls) {
          map.set(tc.id, {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
            result: null,
            success: null,
            isRunning: false,
          })
        }
      } else if (m.role === 'tool' && m.tool_call_id) {
        let result: Record<string, unknown> | null = null
        let success: boolean | null = true
        try {
          const parsed = m.content ? JSON.parse(m.content) : null
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            result = parsed as Record<string, unknown>
          } else {
            result = parsed === null ? null : { value: parsed }
          }
        } catch {
          // content stored as raw "Error: ..." text or non-JSON.
          result = { error: m.content ?? '' }
          success = false
        }
        const existing = map.get(m.tool_call_id)
        if (existing) {
          map.set(m.tool_call_id, { ...existing, result, success, isRunning: false })
        } else {
          map.set(m.tool_call_id, {
            id: m.tool_call_id,
            name: m.tool_name ?? 'unknown',
            arguments: '{}',
            result,
            success,
            isRunning: false,
          })
        }
      }
    }
    return map
  }

  // Load existing session + messages + artifacts on sessionId change.
  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setMessages([])
      setToolCalls(new Map())
      setStreamingText('')
      setPendingProposals([])
      setPendingCheckpoints([])
      setArtifacts([])
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const [data, arts] = await Promise.all([
          api.getAgentSession(sessionId),
          api.listArtifacts(sessionId).catch(() => [] as AgentArtifact[]),
        ])
        if (cancelled) return
        setSession(data.session)
        setMessages(data.messages)
        setArtifacts(arts)
        setToolCalls(reconstructToolCalls(data.messages))
        setError(null)
      } catch (err) {
        if (!cancelled) setError(String(err))
      }
    })()

    return () => { cancelled = true }
  }, [sessionId])

  // Cleanup WS on unmount.
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const sendMessage = useCallback((content: string, pipelineCtx?: { pipeline_mode: boolean; canvas_state: string }) => {
    if (!sessionId || isStreaming) return

    // Add user message optimistically.
    const userMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      tool_calls: null,
      tool_call_id: null,
      tool_name: null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingText('')
    streamingTextRef.current = ''
    // Keep historical toolCalls so cards/chips from earlier turns stay rendered;
    // new tool_use_* events from this turn merge into the same Map.
    setPendingProposals([])
    setPendingCheckpoints([])
    setError(null)

    // Open WebSocket.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = getAuthToken()
    const wsUrl = `${proto}//${window.location.host}/api/agents/ws/${sessionId}${token ? `?token=${token}` : ''}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'message',
        content,
        ...(pipelineCtx || {}),
      }))
    }

    ws.onmessage = (evt) => {
      try {
        const event: AgentEvent = JSON.parse(evt.data)
        handleEvent(event)
      } catch {
        // Ignore malformed events.
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection failed')
      setIsStreaming(false)
    }

    ws.onclose = () => {
      setIsStreaming(false)
      wsRef.current = null
    }
  }, [sessionId, isStreaming])

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'text_delta':
        streamingTextRef.current += event.content ?? ''
        setStreamingText(streamingTextRef.current)
        break

      case 'text_done': {
        const finalText = event.content ?? streamingTextRef.current
        const assistantMsg: AgentMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: finalText,
          tool_calls: null,
          tool_call_id: null,
          tool_name: null,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
        setStreamingText('')
        streamingTextRef.current = ''
        break
      }

      case 'tool_proposal':
        setPendingProposals(prev => [...prev, {
          id: event.tool_call_id ?? '',
          name: event.tool_name ?? '',
          arguments: event.arguments ?? '{}',
        }])
        break

      case 'checkpoint':
        setPendingCheckpoints(prev => [...prev, {
          id: event.checkpoint_id ?? `checkpoint-${Date.now()}`,
          message: event.message ?? 'Checkpoint reached. Continue?',
          toolCallsSoFar: event.tool_calls_so_far ?? 0,
        }])
        break

      case 'tool_use_start': {
        const tcId = event.tool_call_id ?? ''
        const tcName = event.tool_name ?? ''
        const tcArgs = event.arguments ?? '{}'
        setToolCalls(prev => {
          const next = new Map(prev)
          next.set(tcId, {
            id: tcId,
            name: tcName,
            arguments: tcArgs,
            result: null,
            success: null,
            isRunning: true,
          })
          return next
        })
        // Attach this tool call to the most recent assistant message so it
        // renders inline with the turn that produced it (same behaviour as
        // post-reload reconstruction).
        setMessages(prev => {
          let lastIdx = -1
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === 'assistant') { lastIdx = i; break }
          }
          // If there's no assistant message yet (agent called tools without
          // text preamble), create a synthetic one so tool cards have an anchor.
          if (lastIdx === -1) {
            const syntheticMsg: AgentMessage = {
              id: `synthetic-${Date.now()}`,
              role: 'assistant',
              content: null,
              tool_calls: [{ id: tcId, function: { name: tcName, arguments: tcArgs } }],
              tool_call_id: null,
              tool_name: null,
              created_at: new Date().toISOString(),
            }
            return [...prev, syntheticMsg]
          }
          const last = prev[lastIdx]
          // Guard against duplicate tool_call IDs
          if (last.tool_calls?.some(tc => tc.id === tcId)) return prev
          const updated: AgentMessage = {
            ...last,
            tool_calls: [
              ...(last.tool_calls ?? []),
              { id: tcId, function: { name: tcName, arguments: tcArgs } },
            ],
          }
          return [...prev.slice(0, lastIdx), updated, ...prev.slice(lastIdx + 1)]
        })
        break
      }

      case 'tool_use_done':
        setToolCalls(prev => {
          const next = new Map(prev)
          const existing = next.get(event.tool_call_id ?? '')
          if (existing) {
            next.set(event.tool_call_id ?? '', {
              ...existing,
              result: event.result ?? null,
              success: event.success ?? null,
              isRunning: false,
            })
          }
          return next
        })
        // Remove from proposals if it was there (approved).
        setPendingProposals(prev => prev.filter(p => p.id !== event.tool_call_id))
        // If the tool produced a persisted artifact, pull the updated list.
        if (sessionId && event.success && event.result && typeof event.result.artifact_id === 'string') {
          refreshArtifacts(sessionId)
        }
        break

      case 'task_spawned':
        if (event.task) {
          setTasks(prev => [...prev, event.task!])
        }
        break

      case 'task_updated':
      case 'task_completed':
        if (event.task) {
          setTasks(prev => prev.map(t => t.id === event.task!.id ? event.task! : t))
        }
        break

      case 'turn_done':
      case 'session_done':
        setIsStreaming(false)
        setPendingProposals([])
        setPendingCheckpoints([])
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        break

      case 'title_updated':
        // Auto-title from first user message — update session in state.
        if (event.title) {
          setSession(prev => prev ? { ...prev, title: event.title! } : prev)
        }
        break

      case 'error':
        setError(event.message ?? event.error ?? 'Agent error')
        setIsStreaming(false)
        break
    }
  }, [sessionId, refreshArtifacts])

  const abort = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'abort' }))
      }
      // Immediately close the WebSocket and reset state
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
    setPendingProposals([])
    setPendingCheckpoints([])
  }, [])

  const approveToolCall = useCallback((id: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'approve', tool_call_id: id }))
    }
    setPendingProposals(prev => prev.filter(p => p.id !== id))
  }, [])

  const rejectToolCall = useCallback((id: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reject', tool_call_id: id }))
    }
    setPendingProposals(prev => prev.filter(p => p.id !== id))
  }, [])

  const continueCheckpoint = useCallback((id: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'approve', tool_call_id: id }))
    }
    setPendingCheckpoints(prev => prev.filter(c => c.id !== id))
  }, [])

  const stopCheckpoint = useCallback((id: string) => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop', checkpoint_id: id }))
      }
      // Immediately close the WebSocket and reset state
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
    setPendingProposals([])
    setPendingCheckpoints([])
  }, [])

  return {
    session, messages, toolCalls, isStreaming, streamingText, error,
    pendingProposals, pendingCheckpoints, tasks, artifacts,
    sendMessage, abort, approveToolCall, rejectToolCall, continueCheckpoint, stopCheckpoint,
    refreshArtifacts,
  }
}
