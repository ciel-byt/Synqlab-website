/**
 * Workspace feature — unified types.
 * Re-exports org/project types and defines workspace-specific types.
 */
export type {
  Org,
  Member,
  Invite,
  Team,
  TeamMember,
  ContextMenuItem,
} from '@/features/organization/types'

export type { Project } from '@/features/projects/types'

export type WorkspaceTab = 'projects' | 'teams' | 'members' | 'invites' | 'settings'

export const WORKSPACE_TABS: { key: WorkspaceTab; label: string; path: string }[] = [
  { key: 'projects', label: 'Projects', path: '/workspace/projects' },
  { key: 'teams', label: 'Teams', path: '/workspace/teams' },
  { key: 'members', label: 'Members', path: '/workspace/members' },
  { key: 'invites', label: 'Invites', path: '/workspace/invites' },
  { key: 'settings', label: 'Settings', path: '/workspace/settings' },
]
