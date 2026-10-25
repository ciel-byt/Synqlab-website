/**
 * Project feature — shared TypeScript types.
 */
import type { Org, Team } from '@/features/organization/types'

export type { Org, Team }

export interface Project {
  id: string
  org_id: string
  team_id: string | null
  team_name: string | null
  name: string
  description: string | null
  status: string
  visibility: string
  created_at: string
  updated_at: string
}

export const PROJECT_STATUS_OPTIONS = ['active', 'paused', 'archived'] as const

export type ScopeKind = 'all' | 'org' | 'team'

export interface Scope {
  kind: ScopeKind
  org?: Org
  team?: Team
}
