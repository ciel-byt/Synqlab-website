/**
 * Chat feature — shared TypeScript types.
 */
import type { Org } from '@/features/organization/types'

/** Re-export Org as ChatOrg for backward compatibility. */
export type ChatOrg = Org

export interface Session {
  id: string
  org_id: string
  kind: 'ai' | 'dm' | 'group'
  title: string | null
  created_at: string
  updated_at: string
  project_id: string | null
  project_name: string | null
  participant_ids: string[]
}

export interface OrgProject {
  id: string
  name: string
  org_id: string
  team_id: string | null
  team_name: string | null
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'tool'
  sender_id: string | null
  sender_name: string | null
  sender_avatar: string | null
  content: string
  tool_calls: ToolCall[] | null
  tool_results: unknown[] | null
  created_at: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface Participant {
  user_id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export type ChatTab = 'all' | 'dm' | 'group' | 'ai'
