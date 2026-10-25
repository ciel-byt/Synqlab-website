/**
 * Organization feature — shared TypeScript types.
 */
import type { ReactNode } from 'react'

export type Org = {
  id: string
  name: string
  slug: string
  avatar_url: string | null
  plan_tier: string
  created_at: string
}

export type Member = {
  user_id: string
  email: string
  full_name: string
  role: string
  joined_at: string
  auth_provider: string
  avatar_url: string | null
  professional_title?: string | null
  short_bio?: string | null
  linkedin_url?: string | null
  scholar_url?: string | null
  skills?: string | null
}

export type Invite = {
  id: string
  token: string
  invite_url: string
  role: string
  email: string | null
  expires_at: string
  accepted_at: string | null
}

export type Team = {
  id: string
  org_id: string
  name: string
  description: string | null
  avatar_url: string | null
  created_at: string
  member_count: number
}

export type TeamMember = {
  user_id: string
  email: string
  full_name: string
  role: string
  joined_at: string
  avatar_url: string | null
}

export type Selection =
  | { kind: 'org'; orgId: string }
  | { kind: 'teams-folder'; orgId: string }
  | { kind: 'team'; orgId: string; teamId: string }
  | { kind: 'people-folder'; orgId: string }
  | { kind: 'member'; orgId: string; userId: string }
  | { kind: 'invites-folder'; orgId: string }
  | null

export type ContextMenuItem =
  | {
      kind: 'action'
      label: string
      icon: ReactNode
      onClick: () => void
      destructive?: boolean
      disabled?: boolean
    }
  | { kind: 'divider' }

export type ContextMenu = { x: number; y: number; items: ContextMenuItem[] } | null
