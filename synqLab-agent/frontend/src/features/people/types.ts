/**
 * People feature — shared TypeScript types.
 */

export interface Person {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  professional_title?: string | null
  short_bio?: string | null
  linkedin_url?: string | null
  scholar_url?: string | null
  skills?: string | null
  role?: string
}

export interface PeopleOrg {
  id: string
  name: string
  slug: string
}

export interface MembersPage {
  items: Array<{
    user_id: string
    email: string
    full_name: string
    role: string
    joined_at?: string
    auth_provider?: string
    avatar_url?: string | null
    professional_title?: string | null
    short_bio?: string | null
    linkedin_url?: string | null
    scholar_url?: string | null
    skills?: string | null
  }>
  total: number
  role_counts: Record<string, number>
  limit: number
  offset: number
}

export interface TeamSummary {
  id: string
  org_id: string
  name: string
  description: string | null
  avatar_url: string | null
  member_count: number
}
