/**
 * useToolsData — custom hook for the Tools feature data layer.
 *
 * Manages: tool list, categories, health, compute info,
 * search/filter state, selected tool, and per-tool results/input caches.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useToolsAndHealth } from './useToolsAndHealth'
import type { ComputeInfo } from '@/types'

export function useToolsData() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Core data (delegated to shared hook) ───────────────────────────────────
  const { tools, categories, health, healthLoading, loading } = useToolsAndHealth({
    withCategories: true,
  })

  // ── Compute info (Tools-page only) ─────────────────────────────────────────
  const [compute, setCompute] = useState<ComputeInfo | null>(null)
  useEffect(() => {
    api.getCompute().then(setCompute).catch(() => {})
  }, [])

  // ── Sidebar state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [readyOnly, setReadyOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedToolId, setSelectedToolId] = useState<string | null>(
    () => searchParams.get('tool') ?? null,
  )

  // ── Per-tool caches (Option B: persist across switches) ────────────────────
  const [inputsCache, setInputsCache] = useState<Record<string, Record<string, string>>>({})
  const [resultsCache, setResultsCache] = useState<Record<string, ResultEntry[]>>({})

  // ── Sync selection to URL ──────────────────────────────────────────────────
  useEffect(() => {
    if (selectedToolId) {
      setSearchParams({ tool: selectedToolId }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [selectedToolId, setSearchParams])

  // ── Resolve selection from URL on tools load ──────────────────────────────
  useEffect(() => {
    if (tools.length === 0) return
    const urlToolId = searchParams.get('tool')
    if (urlToolId && tools.some(t => t.id === urlToolId)) {
      setSelectedToolId(urlToolId)
    }
  }, [tools]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: filtered + grouped ────────────────────────────────────────────
  const q = search.toLowerCase()
  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      if (readyOnly && !health[t.id]?.available) return false
      return (
        q === '' ||
        t.name.toLowerCase().includes(q) ||
        t.category_label.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [tools, search, readyOnly, health, q])

  const catOrder = useMemo(
    () => [...new Set([...categories.map(c => c.id), ...tools.map(t => t.category)])],
    [categories, tools],
  )
  const catMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories],
  )
  const groupedByCategory = useMemo(
    () =>
      catOrder
        .map(id => ({
          cat: catMap[id] ?? {
            id,
            label: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: '',
            tool_count: 0,
          },
          tools: filteredTools.filter(t => t.category === id),
        }))
        .filter(g => g.tools.length > 0),
    [catOrder, catMap, filteredTools],
  )

  // ── Stats ──────────────────────────────────────────────────────────────────
  const readyCount = useMemo(
    () => Object.values(health).filter(h => h.available).length,
    [health],
  )

  // ── Active tool ────────────────────────────────────────────────────────────
  const activeTool = useMemo(
    () => tools.find(t => t.id === selectedToolId) ?? null,
    [tools, selectedToolId],
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  function selectTool(toolId: string) {
    setSelectedToolId(toolId)
  }

  function toggleCategory(catId: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  function updateInputsForTool(toolId: string, inputs: Record<string, string>) {
    setInputsCache(prev => ({ ...prev, [toolId]: inputs }))
  }

  function addResultForTool(toolId: string, entry: ResultEntry) {
    setResultsCache(prev => ({
      ...prev,
      [toolId]: [entry, ...(prev[toolId] ?? [])],
    }))
  }

  function updateResultForTool(toolId: string, jobId: string, result: JobResult) {
    setResultsCache(prev => ({
      ...prev,
      [toolId]: (prev[toolId] ?? []).map(r =>
        r.jobId === jobId ? { ...r, result } : r,
      ),
    }))
  }

  return {
    // Core data
    tools,
    categories,
    health,
    compute,
    loading,

    // Sidebar state
    search,
    setSearch,
    readyOnly,
    setReadyOnly,
    collapsed,
    toggleCategory,

    // Selection
    activeTool,
    selectedToolId,
    selectTool,

    // Derived
    filteredTools,
    groupedByCategory,
    readyCount,
    healthLoading,
    totalCount: tools.length,

    // Caches
    inputsCache,
    resultsCache,
    updateInputsForTool,
    addResultForTool,
    updateResultForTool,
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ResultEntry {
  id: string
  jobId: string
  result: JobResult | null // null = still polling
  ts: string
}

export interface JobResult {
  status: string
  success: boolean
  error_message?: string
  outputs: Record<string, unknown>
}

export type UseToolsData = ReturnType<typeof useToolsData>
