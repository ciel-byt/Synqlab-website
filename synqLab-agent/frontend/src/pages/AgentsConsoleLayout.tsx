/**
 * AgentsConsoleLayout — Console layout with session state + Outlet.
 *
 * Provides lean session state to children via Outlet context.
 * Single route: /lab/agents/console renders AgentConsoleView.
 */

import { useState, useEffect, useCallback } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import type { AgentSession } from '@/features/agent/types'
import { AgentsSidebar } from '@/features/agent/components/AgentsSidebar'
import { PipelineWorkshopProvider } from '@/features/agent/contexts/PipelineWorkshopContext'

const MOCK_SESSIONS_KEY = 'agents-console-mock-sessions-v1'

/**
 * Lean context provided to child routes via useOutletContext().
 */
export interface AgentsConsoleOutletContext {
  sessions: AgentSession[]
  activeSessionId: string | null
  loading: boolean
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  registerCreatedSession: (session: AgentSession) => void
  onNewChat: () => void
  updateSessionTitle: (id: string, title: string) => void
  pipelineMode: boolean
  setPipelineMode: (v: boolean) => void
}

export function AgentsConsoleLayout() {
  // Session state
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()

  // Pipeline workshop mode
  const [pipelineMode, setPipelineMode] = useState(() => searchParams.get('pipeline') === 'new')

  // Load sessions on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listAgentSessions()
        let localMocks: AgentSession[] = []
        try {
          const raw = localStorage.getItem(MOCK_SESSIONS_KEY)
          if (raw) localMocks = JSON.parse(raw) as AgentSession[]
        } catch {
          // ignore malformed local storage
        }
        const merged = [...localMocks, ...data]
        if (!cancelled) {
          setSessions(merged)
          setLoading(false)
        }
      } catch (err) {
        console.error('[AgentsConsoleLayout] Failed to fetch sessions:', err)
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    // Local-only mock demo sessions are not persisted in backend.
    if (id.startsWith('mock-gfp11-')) {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== id)
        try {
          const localOnly = next.filter(s => s.id.startsWith('mock-gfp11-'))
          localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(localOnly))
        } catch {
          // ignore storage failures
        }
        return next
      })
      if (activeSessionId === id) setActiveSessionId(null)
      return
    }
    try {
      await api.deleteAgentSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }, [activeSessionId])

  // Register a newly created session
  const registerCreatedSession = useCallback((session: AgentSession) => {
    setSessions(prev => {
      const next = [session, ...prev.filter(s => s.id !== session.id)]
      if (session.id.startsWith('mock-gfp11-')) {
        try {
          const localOnly = next.filter(s => s.id.startsWith('mock-gfp11-'))
          localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(localOnly))
        } catch {
          // ignore storage failures
        }
      }
      return next
    })
    setActiveSessionId(session.id)
  }, [])

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null)
  }, [])

  const updateSessionTitle = useCallback((id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }, [])

  const outletContext: AgentsConsoleOutletContext = {
    sessions,
    activeSessionId,
    loading,
    onSelectSession: handleSelectSession,
    onDeleteSession: handleDeleteSession,
    registerCreatedSession,
    onNewChat: handleNewChat,
    updateSessionTitle,
    pipelineMode,
    setPipelineMode,
  }

  return (
    <PipelineWorkshopProvider defaultEnabled={pipelineMode}>
    <ModularPageLayout
      contentClassName="!flex-col !min-w-0"
      sidebar={
        <AgentsSidebar
          view="console"
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCreate={handleNewChat}
          onDelete={handleDeleteSession}
        />
      }
    >
      <Outlet context={outletContext} />
    </ModularPageLayout>
    </PipelineWorkshopProvider>
  )
}
