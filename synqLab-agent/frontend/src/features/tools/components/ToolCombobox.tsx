/**
 * ToolCombobox — shared searchable tool-selector built on shadcn Popover + Command.
 *
 * Replaces the two hand-rolled dropdowns (NewSessionDropdown + WelcomeScreen)
 * in ToolsConsoleView.tsx. Features:
 *   - Searchable by name, category, or description
 *   - Grouped by tool category with accent icons
 *   - Health indicator dot per tool
 *   - Shows estimated run time
 *   - Supports disabling already-open tools
 */
import { useState, useMemo } from 'react'
import { Plus, Clock, ChevronDown, Search } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { catAccent, CatIcon, sortByAvailability } from '../helpers'

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface ToolComboboxTool {
  id: string
  name: string
  category: string
  category_label: string
  description?: string
  resource_profile?: {
    compute?: string
    estimated_time_per_call?: string
  }
}

interface ToolComboboxProps {
  tools: ToolComboboxTool[]
  health: Record<string, { available: boolean }>
  healthLoading: boolean
  /** Tool IDs that are already open (shown as disabled) */
  openTabIds?: Set<string>
  onSelect: (toolId: string) => void
  /** Visual variant: 'compact' for tab-bar button, 'hero' for welcome-screen large selector */
  variant?: 'compact' | 'hero'
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function ToolCombobox({
  tools,
  health,
  healthLoading,
  openTabIds = new Set(),
  onSelect,
  variant = 'compact',
}: ToolComboboxProps) {
  const [open, setOpen] = useState(false)

  const healthReady = Object.values(health).filter(h => h.available).length

  // Group tools by category for display
  const grouped = useMemo(() => {
    const groups = new Map<string, ToolComboboxTool[]>()
    for (const t of tools) {
      const g = groups.get(t.category) || []
      g.push(t)
      groups.set(t.category, g)
    }
    return [...groups.entries()].map(([catId, catTools]) => ({
      catId,
      catLabel: catTools[0]?.category_label ?? catId,
      tools: catTools,
    }))
  }, [tools])

  function handleSelect(toolId: string) {
    if (openTabIds.has(toolId)) return
    if (!healthLoading && !health[toolId]?.available) return
    onSelect(toolId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'hero' ? (
          <button
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm text-left transition-all ${
              open
                ? 'border-primary bg-card shadow-lg'
                : 'border-border bg-card hover:border-foreground/20 shadow-sm hover:shadow-md'
            }`}
          >
            <Search size={14} className="text-muted-foreground/40 shrink-0" />
            <span className="flex-1 text-muted-foreground/60">Select a tool…</span>
            <ChevronDown size={14} className={`text-muted-foreground/40 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <button
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              open
                ? 'border-primary bg-card text-foreground shadow-md'
                : 'border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            <Plus size={12} />
            New Session
            <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className={`p-0 ${variant === 'hero' ? 'w-[var(--radix-popover-trigger-width)]' : 'w-[22rem]'}`}
        align={variant === 'hero' ? 'center' : 'start'}
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Filter tools…" className="h-9" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty className="py-6 text-xs text-muted-foreground/50">
              No tools match your filter
            </CommandEmpty>
            {grouped.map(({ catId, catLabel, tools: catTools }) => {
              const accent = catAccent(catId)
              return (
                <CommandGroup
                  key={catId}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <span className={`flex items-center justify-center h-4 w-4 rounded ${accent.iconBg}`}>
                        <CatIcon cat={catId} size={8} />
                      </span>
                      {catLabel}
                    </span>
                  }
                >
                  {sortByAvailability(catTools, health).map(tool => {
                    const isOpen = openTabIds.has(tool.id)
                    const h = health[tool.id]
                    const isAvailable = h?.available ?? false
                    const isDisabled = isOpen || (!isAvailable && !healthLoading)
                    const time = tool.resource_profile?.estimated_time_per_call
                    return (
                      <CommandItem
                        key={tool.id}
                        value={`${tool.name} ${tool.category_label} ${tool.description ?? ''}`}
                        onSelect={() => handleSelect(tool.id)}
                        disabled={isDisabled}
                        className={`flex items-center gap-2.5 px-2 py-2 ${isDisabled && !isOpen ? 'opacity-50' : ''}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          healthLoading ? 'bg-muted-foreground/20 animate-pulse' :
                          isAvailable ? 'bg-emerald-500' : 'bg-rose-400/60'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-foreground truncate">{tool.name}</div>
                          {tool.description && (
                            <div className="text-[10px] text-muted-foreground/60 truncate">{tool.description}</div>
                          )}
                        </div>
                        {isOpen && <span className="text-[9px] text-muted-foreground/40 shrink-0">open</span>}
                        {!isOpen && !isAvailable && !healthLoading && <span className="text-[9px] text-rose-400/60 shrink-0">offline</span>}
                        {!isOpen && isAvailable && time && (
                          <span className="text-[9px] text-muted-foreground/40 shrink-0 flex items-center gap-0.5">
                            <Clock size={8} />
                            {time}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-border/30 text-[9px] text-muted-foreground/40">
            {tools.length} tools · {healthLoading ? 'checking…' : `${healthReady} ready`}
            {openTabIds.size > 0 && ` · ${openTabIds.size} open`}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
