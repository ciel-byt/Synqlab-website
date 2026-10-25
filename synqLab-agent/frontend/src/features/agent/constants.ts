/**
 * Shared constants for Agent features.
 */

import { FlaskConical, type LucideIcon } from 'lucide-react'

export interface AgentTypeConfig {
  type: string
  label: string
  icon: LucideIcon
}

export const AGENT_TYPES: AgentTypeConfig[] = [
  { type: 'general', label: 'Research Assistant', icon: FlaskConical },
]

export type AgentType = 'general'
