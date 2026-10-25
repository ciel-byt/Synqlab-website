/**
 * ToolsPage — hub shell for the tools section.
 *
 * Provides a shared ToolsContext (tools, categories, health, compute, caches)
 * so both the grid view and detail view share one data fetch.
 * Renders child routes via Outlet.
 */
import { createContext, useContext } from 'react'
import { Outlet } from 'react-router-dom'
import { useToolsData } from '@/features/tools/hooks/useToolsData'
import type { UseToolsData } from '@/features/tools/hooks/useToolsData'

const ToolsContext = createContext<UseToolsData | null>(null)

export function useToolsContext(): UseToolsData {
  const ctx = useContext(ToolsContext)
  if (!ctx) throw new Error('useToolsContext must be used within ToolsPage')
  return ctx
}

export function ToolsPage() {
  const data = useToolsData()

  return (
    <ToolsContext.Provider value={data}>
      <div className="flex flex-col h-full overflow-hidden">
        <Outlet />
      </div>
    </ToolsContext.Provider>
  )
}
