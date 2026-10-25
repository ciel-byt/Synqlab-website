/**
 * useToolsAndHealth — shared hook for loading tool list + health status.
 *
 * Centralises the duplicated pattern of fetching tools (blocking) and health
 * (non-blocking background) that was repeated across PipelinePage,
 * AgentDesignerCanvasPage, AgentConsoleView, and useToolsData.
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { Tool, Category, HealthMap } from '@/types'

interface UseToolsAndHealthOptions {
  /** Also fetch categories (needed by AgentDesignerCanvasPage). */
  withCategories?: boolean
  /** Lazy-load: don't fetch until this becomes true (for AgentConsoleView). */
  enabled?: boolean
}

export function useToolsAndHealth(opts: UseToolsAndHealthOptions = {}) {
  const { withCategories = false, enabled = true } = opts

  const [tools, setTools] = useState<Tool[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [health, setHealth] = useState<HealthMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return

    const fetches: Promise<unknown>[] = [api.getAllTools().then(setTools)]
    if (withCategories) {
      fetches.push(api.getAllCategories().then(setCategories))
    }

    Promise.all(fetches)
      .catch(() => {})
      .finally(() => setLoading(false))

    // Health check in background — don't block page render
    api.getHealth().catch(() => ({} as HealthMap)).then(setHealth)
  }, [enabled, withCategories])

  const healthLoading = Object.keys(health).length === 0 && tools.length > 0

  return { tools, categories, health, healthLoading, loading }
}
