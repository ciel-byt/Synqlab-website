/**
 * ToolMiniPalette — compact, collapsible tool palette for pipeline canvases.
 *
 * Shared between PipelineCanvasPanel (Agent Console),
 * InlineCanvasEditor, and AgentDesignerCanvasPage (Pipeline Editor).
 * Groups tools by category with drag-and-drop support.
 * Shows availability status per tool when health data is provided.
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, GripVertical, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolIcon, catAccent, sortByAvailability } from '@/features/tools/helpers'
import type { Tool } from '@/types'

interface ToolMiniPaletteProps {
  tools: Tool[]
  collapsed?: boolean
  onToggle?: () => void
  onDragStart: (e: React.DragEvent, tool: Tool) => void
  /** Full-height mode for standalone sidebar (e.g. Pipeline Editor page) */
  fullHeight?: boolean
  /** Show search box */
  showSearch?: boolean
  /** Health status per tool ID */
  health?: Record<string, { available: boolean }>
}

export function ToolMiniPalette({
  tools,
  collapsed: controlledCollapsed,
  onToggle: controlledToggle,
  onDragStart,
  fullHeight = false,
  showSearch = false,
  health,
}: ToolMiniPaletteProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const collapsed = controlledCollapsed ?? internalCollapsed
  const onToggle = controlledToggle ?? (() => setInternalCollapsed(c => !c))

  const filtered = search.trim()
    ? tools.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.category_label ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tools

  // Sort available tools first when health data is present
  const sorted = useMemo(() => {
    if (!health || Object.keys(health).length === 0) return filtered
    return sortByAvailability(filtered, health)
  }, [filtered, health])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Tool[]>()
    for (const t of sorted) {
      const list = map.get(t.category) || []
      list.push(t)
      map.set(t.category, list)
    }
    return map
  }, [sorted])

  const hasHealth = health && Object.keys(health).length > 0

  return (
    <div className={cn(
      'border-l border-border bg-card flex flex-col transition-all duration-200',
      collapsed ? 'w-8' : fullHeight ? 'w-56' : 'w-44',
      fullHeight && 'h-full',
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="h-8 flex items-center justify-center border-b border-border hover:bg-muted/50 transition-colors flex-shrink-0"
      >
        {collapsed
          ? (fullHeight ? <ChevronLeft size={12} /> : <ChevronLeft size={12} />)
          : (fullHeight ? <ChevronRight size={12} /> : <ChevronRight size={12} />)
        }
      </button>

      {!collapsed && showSearch && (
        <div className="px-2 py-1.5 border-b border-border/50">
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tools…"
              className="w-full h-6 rounded border border-border/50 bg-transparent pl-6 pr-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-1.5 space-y-2 no-scrollbar">
          {Array.from(grouped.entries()).map(([cat, catTools]) => {
            const accent = catAccent(cat)
            return (
              <div key={cat}>
                <div className={cn(
                  'text-[8px] font-bold uppercase tracking-widest px-1 mb-0.5',
                  accent.titleColor || 'text-muted-foreground/50',
                )}>
                  {catTools[0]?.category_label || cat}
                </div>
                {catTools.map(tool => {
                  const isAvailable = !hasHealth || (health[tool.id]?.available ?? false)
                  return (
                    <div
                      key={tool.id}
                      draggable={isAvailable}
                      onDragStart={e => isAvailable && onDragStart(e, tool)}
                      title={isAvailable ? tool.description : `${tool.name} — offline`}
                      className={cn(
                        'flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] select-none',
                        isAvailable
                          ? 'text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing'
                          : 'text-muted-foreground/40 cursor-not-allowed opacity-50',
                      )}
                    >
                      {/* Health dot */}
                      {hasHealth && (
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          isAvailable ? 'bg-emerald-500' : 'bg-rose-400/60',
                        )} />
                      )}
                      {!hasHealth && (
                        <GripVertical size={8} className="text-muted-foreground/30 flex-shrink-0" />
                      )}
                      <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0', accent.iconBg)}>
                        <ToolIcon toolId={tool.id} category={tool.category} size={9} className={accent.iconText} />
                      </div>
                      <span className="truncate font-medium">{tool.name}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
