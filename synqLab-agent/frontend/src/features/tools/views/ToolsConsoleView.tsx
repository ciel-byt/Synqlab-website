/**
 * ToolsConsoleView — Multi-session tabbed workbench for tools.
 *
 * Replaces the separate grid + detail views with a unified console:
 * - Tab bar at the top with open tool sessions
 * - "New Session" dropdown (shadcn Popover + Command combobox) to add tools
 * - Each tab wraps ToolDetail with its own input/result state
 * - Welcome screen when no tabs are open (category-grouped tool browser)
 * - Running jobs show animated indicator on their tab
 * - Max 8 concurrent tabs
 */
import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Loader2, Cpu, Zap, ArrowRightLeft, Brain } from 'lucide-react'
import { useToolsContext } from '@/pages/ToolsPage'
import { ToolDetail } from '../components/ToolDetail'
import { ToolCombobox } from '../components/ToolCombobox'
import { EntityCard, CARD_GRID_CLASS } from '@/components/ui/entity-card'
import { AnimatedAvatar, sortByAvailability } from '../helpers'
import type { ResultEntry } from '../hooks/useToolsData'

const MAX_TABS = 8

/* ── Tab status indicator ──────────────────────────────────────────── */

function TabIndicator({ results }: { results: ResultEntry[] }) {
  const running = results.some(r => r.result === null)
  const lastResult = results[0]?.result

  if (running) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-blue-400 opacity-60 animate-ping" style={{ animationDuration: '1.5s' }} />
        <span className="relative rounded-full h-2 w-2 bg-blue-500" />
      </span>
    )
  }
  if (lastResult?.success) {
    return <span className="h-2 w-2 rounded-full bg-emerald-500" />
  }
  if (lastResult && !lastResult.success) {
    return <span className="h-2 w-2 rounded-full bg-rose-500" />
  }
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
}

/* ── Welcome screen (no tabs open) ─────────────────────────────────── */

function WelcomeScreen({
  tools,
  health,
  healthLoading,
  onOpenTool,
}: {
  tools: Array<{ id: string; name: string; category: string; category_label: string; description?: string; resource_profile?: { gpu?: string; cpu?: string; estimated_time_per_call?: string }; links?: Record<string, string>; inputs?: Array<{ name: string }>; outputs?: Array<{ name: string }>; tags?: string[] }>
  health: Record<string, { available: boolean }>
  healthLoading: boolean
  onOpenTool: (toolId: string) => void
}) {
  return (
    <div className="p-6 md:p-8 lg:p-10 overflow-y-auto flex-1">
      <div className="max-w-5xl mx-auto w-full">

        {/* Hero section with dropdown */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-lg font-semibold text-foreground tracking-tight mb-1">Computers</h1>
          <p className="text-[11px] text-muted-foreground/60 mb-6">
            Select a computer to start a session. Run multiple computers in parallel tabs.
          </p>

          {/* Tool selector — shadcn Popover + Command */}
          <div className="inline-block w-full max-w-md">
            <ToolCombobox
              tools={tools}
              health={health}
              healthLoading={healthLoading}
              onSelect={onOpenTool}
              variant="hero"
            />
          </div>
        </div>

        {/* Quick-access cards — rich grid */}
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">Quick Access</h2>
          <div className={CARD_GRID_CLASS}>
            {sortByAvailability(tools, health).map(tool => {
              const h = health[tool.id]
              const isAvailable = h?.available ?? false
              const inputCount = tool.inputs?.length ?? 0
              const outputCount = tool.outputs?.length ?? 0

              const badges = []
              if (tool.resource_profile?.gpu && tool.resource_profile.gpu !== 'none') {
                badges.push({ icon: Zap, count: 'GPU', title: 'Requires GPU' })
              } else {
                badges.push({ icon: Cpu, count: 'CPU', title: 'Runs on CPU' })
              }
              if (inputCount > 0 || outputCount > 0) {
                badges.push({ icon: ArrowRightLeft, count: `${inputCount} in / ${outputCount} out` })
              }
              const isBrightness = tool.id === 'brightness_model'

              return (
                <div
                  key={tool.id}
                  className={`relative h-full ${!isAvailable && !healthLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <EntityCard
                    onClick={isAvailable || healthLoading ? () => onOpenTool(tool.id) : undefined}
                    title={tool.name}
                    description={tool.description}
                    label={tool.category_label}
                    icon={{ node: <AnimatedAvatar category={tool.category} /> }}
                    status={h ? {
                      color: healthLoading ? 'amber' : isAvailable ? 'green' : 'red',
                      label: healthLoading ? 'CHECKING' : isAvailable ? 'READY' : 'OFFLINE'
                    } : undefined}
                    badges={badges}
                    layout="compact"
                    className={`h-full ${!isAvailable && !healthLoading ? 'pointer-events-none' : ''}`}
                  />
                  {isBrightness && (
                    <a
                      href="/lab/models"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                    >
                      <Brain size={10} />
                      Finetune
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}



/* ── Main Console View ─────────────────────────────────────────────── */

interface TabState {
  toolId: string
}

export function ToolsConsoleView() {
  const data = useToolsContext()
  const { toolId: routeToolId } = useParams<{ toolId?: string }>()
  const navigate = useNavigate()

  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  const { healthLoading } = data

  // Auto-open tab from URL route param
  useEffect(() => {
    if (!routeToolId || data.tools.length === 0) return
    const tool = data.tools.find(t => t.id === routeToolId)
    if (!tool) return

    const existingIdx = tabs.findIndex(t => t.toolId === routeToolId)
    if (existingIdx >= 0) {
      setActiveTabIndex(existingIdx)
    } else if (tabs.length < MAX_TABS) {
      setTabs(prev => [...prev, { toolId: routeToolId }])
      setActiveTabIndex(tabs.length)
    }
    // Clear the route param — console manages its own state
    navigate('/lab/computers', { replace: true })
  }, [routeToolId, data.tools]) // eslint-disable-line react-hooks/exhaustive-deps

  function openTool(toolId: string) {
    const existingIdx = tabs.findIndex(t => t.toolId === toolId)
    if (existingIdx >= 0) {
      setActiveTabIndex(existingIdx)
      return
    }
    if (tabs.length >= MAX_TABS) return
    setTabs(prev => [...prev, { toolId }])
    setActiveTabIndex(tabs.length)
  }

  function closeTab(index: number) {
    setTabs(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
    if (activeTabIndex >= index && activeTabIndex > 0) {
      setActiveTabIndex(activeTabIndex - 1)
    } else if (tabs.length <= 1) {
      setActiveTabIndex(0)
    }
  }

  const openTabIds = useMemo(() => new Set(tabs.map(t => t.toolId)), [tabs])
  const activeTab = tabs[activeTabIndex]
  const activeTool = activeTab ? data.tools.find(t => t.id === activeTab.toolId) : null

  // Loading state
  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2">
        <Loader2 size={14} className="animate-spin text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground/50">Loading tools…</span>
      </div>
    )
  }

  // No tabs open — show welcome screen
  if (tabs.length === 0) {
    return (
      <WelcomeScreen
        tools={data.tools}
        health={data.health}
        healthLoading={healthLoading}
        onOpenTool={openTool}
      />
    )
  }

  // Console with tabs
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-0 border-b border-border bg-background/50 shrink-0 relative z-30">
        {/* New session button — shadcn Popover + Command */}
        <ToolCombobox
          tools={data.tools}
          health={data.health}
          healthLoading={healthLoading}
          openTabIds={openTabIds}
          onSelect={openTool}
          variant="compact"
        />

        <div className="w-px h-5 bg-border/50 mx-1" />

        {/* Tabs */}
        {tabs.map((tab, i) => {
          const tool = data.tools.find(t => t.id === tab.toolId)
          const results = data.resultsCache[tab.toolId] ?? []
          const isActive = i === activeTabIndex

          return (
            <button
              key={tab.toolId}
              onClick={() => setActiveTabIndex(i)}
              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition-all border border-b-0 ${
                isActive
                  ? 'bg-card border-border text-foreground -mb-px'
                  : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <TabIndicator results={results} />
              <span className="truncate max-w-[100px]">{tool?.name ?? tab.toolId}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(i) }}
                className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <X size={10} />
              </span>
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      {activeTool && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ToolDetail
            key={activeTool.id}
            tool={activeTool}
            health={data.health[activeTool.id]}
            compute={data.compute}
            inputs={
              data.inputsCache[activeTool.id] ??
              Object.fromEntries(
                (activeTool.inputs || []).map(inp => [
                  inp.name,
                  inp.default !== undefined ? String(inp.default) : '',
                ]),
              )
            }
            onInputsChange={inputs => data.updateInputsForTool(activeTool.id, inputs)}
            results={data.resultsCache[activeTool.id] ?? []}
            onAddResult={entry => data.addResultForTool(activeTool.id, entry)}
            onUpdateResult={(jobId, result) => data.updateResultForTool(activeTool.id, jobId, result)}
          />
        </div>
      )}
    </div>
  )
}
