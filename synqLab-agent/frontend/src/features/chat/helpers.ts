/**
 * Chat feature — shared helpers.
 */
import type { ChatTab } from './types'

// ── Re-exports from canonical lib modules ────────────────────────────────────

export { relativeTime } from '@/lib/dates'
export { initials } from '@/lib/initials'

// ── Sender palette ───────────────────────────────────────────────────────────

const SENDER_PALETTES = [
  { bubble: 'bg-muted border-border', label: 'text-foreground/80', avatar: 'bg-foreground/80', chip: 'bg-muted border-border text-foreground/80' },
  { bubble: 'bg-blue-50 border-blue-200', label: 'text-blue-800', avatar: 'bg-blue-700', chip: 'bg-blue-50 border-blue-200 text-blue-800' },
  { bubble: 'bg-zinc-100 border-zinc-200', label: 'text-zinc-700', avatar: 'bg-zinc-700', chip: 'bg-zinc-100 border-zinc-200 text-zinc-700' },
  { bubble: 'bg-sky-50 border-sky-200', label: 'text-sky-800', avatar: 'bg-sky-700', chip: 'bg-sky-50 border-sky-200 text-sky-800' },
  { bubble: 'bg-stone-100 border-stone-200', label: 'text-stone-700', avatar: 'bg-stone-700', chip: 'bg-stone-100 border-stone-200 text-stone-700' },
  { bubble: 'bg-surface border-border', label: 'text-muted-foreground', avatar: 'bg-foreground/70', chip: 'bg-surface border-border text-foreground/80' },
]

export function paletteForSender(key: string | null | undefined) {
  const safe = key ?? 'unknown'
  let hash = 0
  for (let i = 0; i < safe.length; i += 1) hash = (hash * 31 + safe.charCodeAt(i)) | 0
  return SENDER_PALETTES[Math.abs(hash) % SENDER_PALETTES.length]
}

// ── UI persistence ───────────────────────────────────────────────────────────

interface ChatUiState {
  activeTab?: ChatTab
  selectedOrgId?: string
  activeSessionId?: string | null
  sidebarOpen?: boolean
}

function chatUiStorageKey(userId: string): string {
  return `synqlab_chat_ui_${userId}`
}

export function readChatUi(userId: string): ChatUiState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(chatUiStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ChatUiState
    return parsed ?? {}
  } catch {
    return {}
  }
}

export function writeChatUi(userId: string, next: ChatUiState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chatUiStorageKey(userId), JSON.stringify(next))
}
