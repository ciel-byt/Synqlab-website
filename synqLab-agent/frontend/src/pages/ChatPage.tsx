import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bot,
} from 'lucide-react'
import { api } from '@/api/client'
import { EmptyState } from '@/components/blocks/EmptyState'
import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

import type { Org } from '@/features/organization/types'
import type { Session, Message, Participant } from '@/features/chat/types'
import { NewChatDialog } from '@/features/chat/components/NewChatDialog'
import { ChatSidebar } from '@/features/chat/components/ChatSidebar'
import { ChatArea } from '@/features/chat/components/ChatArea'

export function ChatPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialProjectId = searchParams.get('project_id')
  const initialSessionId = searchParams.get('session_id')
  
  const [orgs, setOrgs] = useState<Org[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [activeParticipants, setActiveParticipants] = useState<Participant[]>([])
  const [viewedAt, setViewedAt] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [chatError, setChatError] = useState('')
  const [persistedSessionId, setPersistedSessionId] = useState<string | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────
  async function fetchSessions() {
    return api.listChatSessions()
  }

  async function loadSessions(keepSelection = true, silent = false) {
    if (!silent) setLoadingSessions(true)
    try {
      const data = await fetchSessions()
      setSessions(data)
      setChatError('')
      if (activeSession) {
        const refreshedActive = data.find(s => s.id === activeSession.id)
        if (keepSelection && refreshedActive) {
          setActiveSession(refreshedActive)
        } else if (!refreshedActive) {
          setActiveSession(null)
          setMessages([])
          setActiveParticipants([])
        }
      } else if (persistedSessionId) {
        const remembered = data.find(s => s.id === persistedSessionId)
        if (remembered) {
          void openSession(remembered)
        }
      }
    } catch {
      if (!silent) setChatError('Failed to load chats.')
    } finally {
      if (!silent) setLoadingSessions(false)
    }
  }

  async function loadMessages(sessionId: string, initial = false) {
    if (initial) setLoadingMessages(true)
    try {
      const data = await api.listChatMessages(sessionId)
      setMessages(data)
      setViewedAt(prev => ({ ...prev, [sessionId]: new Date().toISOString() }))
    } catch {
      if (initial) setMessages([])
    } finally {
      if (initial) setLoadingMessages(false)
    }
  }

  async function loadParticipants(sessionId: string) {
    try {
      setActiveParticipants(await api.listChatParticipants(sessionId))
    } catch {
      setActiveParticipants([])
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    api.listOrgs()
      .then(setOrgs)
      .catch(() => setOrgs([]))
  }, [])

  useEffect(() => {
    void loadSessions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialSessionId && sessions.length > 0) {
      const target = sessions.find(s => s.id === initialSessionId)
      if (target) {
        void openSession(target)
        searchParams.delete('session_id')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [initialSessionId, sessions, searchParams, setSearchParams])

  useEffect(() => {
    if (initialProjectId && orgs.length > 0) {
      setActiveSession(null)
      searchParams.delete('project_id')
      searchParams.delete('org_id')
      setSearchParams(searchParams, { replace: true })
    }
  }, [initialProjectId, orgs.length, searchParams, setSearchParams])

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState !== 'visible') return
      void loadSessions(true, true)
      if (activeSession && activeSession.kind !== 'ai') {
        void loadMessages(activeSession.id)
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [activeSession?.id])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function openSession(session: Session) {
    setActiveSession(session)
    setPersistedSessionId(session.id)
    setViewedAt(prev => ({ ...prev, [session.id]: new Date().toISOString() }))
    await loadMessages(session.id, true)
    if (session.kind === 'ai') {
      setActiveParticipants([])
    } else {
      await loadParticipants(session.id)
    }
  }

  async function handleDelete(s: Session) {
    try {
      await api.deleteChatSession(s.id)
      if (activeSession?.id === s.id) {
        setActiveSession(null)
        setMessages([])
        setActiveParticipants([])
      }
      setSessions(prev => prev.filter(x => x.id !== s.id))
    } catch {
      setChatError('Failed to delete chat.')
    }
  }

  return (
    <ModularPageLayout
      contentClassName="!flex-col !min-w-0"
      sidebar={
        <ChatSidebar
          orgs={orgs}
          sessions={sessions}
          activeSession={activeSession}
          loadingSessions={loadingSessions}
          onNewChat={() => setShowNewChat(true)}
          viewedAt={viewedAt}
          onSessionSelect={openSession}
          onSessionDelete={handleDelete}
          onSessionRename={async (s, next) => {
            try {
              const updated = await api.updateChatSession(s.id, { title: next })
              setSessions(prev => prev.map(x => x.id === s.id ? updated : x))
              if (activeSession?.id === s.id) setActiveSession(updated)
            } catch {
              setChatError('Failed to rename chat.')
            }
          }}
        />
      }
    >
      {showNewChat ? (
        <NewChatDialog
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          orgs={orgs}
          defaultOrgId="__all__"
          myId={user?.id ?? ''}
          onCreated={(session) => {
            setShowNewChat(false)
            void loadSessions(true, true)
            void openSession(session)
          }}
        />
      ) : activeSession ? (
        <ChatArea
          activeSession={activeSession}
          messages={messages}
          setMessages={setMessages}
          loadingMessages={loadingMessages}
          activeParticipants={activeParticipants}
          chatError={chatError}
          setChatError={setChatError}
          onMessageSent={() => {
            if (activeSession.kind === 'ai') void loadMessages(activeSession.id)
            void loadSessions(true, true)
          }}
          onAddParticipant={async (userToAdd) => {
            try {
              await api.addChatParticipant(activeSession.id, { user_id: userToAdd.id })
              await loadParticipants(activeSession.id)
              void loadSessions(true, true)
            } catch (err) {
              setChatError(err instanceof Error ? err.message : 'Failed to add participant.')
            }
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Bot}
            title="AI & Team Chat"
            description="Select a chat from the sidebar or start a new one."
            action={
              <Button onClick={() => setShowNewChat(true)}>Start Chat</Button>
            }
          />
        </div>
      )}
    </ModularPageLayout>
  )
}
