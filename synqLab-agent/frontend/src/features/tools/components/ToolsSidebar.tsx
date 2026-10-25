/**
 * ToolsSidebar — sidebar listing all tools grouped by category.
 * Uses shadcn components and bordered card items matching Chat/People sidebars.
 */
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import { Input } from '@/components/ui/input'
import { catAccent, COMPUTE_LABEL, ToolIcon } from '../helpers'
import type { Tool, Category, HealthMap } from '@/types'

interface ToolsSidebarProps {
  groupedByCategory: { cat: Category; tools: Tool[] }[]
  health: HealthMap
  search: string
  setSearch: (v: string) => void
  collapsed: Set<string>
  toggleCategory: (catId: string) => void
  selectedToolId: string | null
  selectTool: (toolId: string) => void
}

export function ToolsSidebar({
  groupedByCategory,
  health,
  search,
  setSearch,
  collapsed,
  toggleCategory: _toggleCategory,
  selectedToolId,
  selectTool,
}: ToolsSidebarProps) {
  return (
    <PageSidebar
      title="Computers"
      headerContent={
        <>
          {/* Search — matches Chat/People pattern */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </>
      }
    >
      {groupedByCategory.map(({ cat, tools }) => {
        const accent = catAccent(cat.id)

        return (
          <SidebarCollapsibleGroup
            key={cat.id}
            title={`${cat.label} (${tools.length})`}
            titleClassName={accent.titleColor}
            defaultOpen={!collapsed.has(cat.id)}
          >
            {tools.map(tool => {
              const h = health[tool.id]
              const compute = (tool.resource_profile?.gpu && tool.resource_profile.gpu !== 'none') ? 'gpu' : 'cpu'

              return (
                <SidebarListItem
                  key={tool.id}
                  active={tool.id === selectedToolId}
                  title={tool.name}
                  icon={
                    <ToolIcon
                      toolId={tool.id}
                      category={tool.category}
                      size={13}
                      className={cn('shrink-0 transition-colors', accent.titleColor)}
                    />
                  }
                  trailing={
                    h ? (
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        h.available ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                      )} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted" />
                    )
                  }
                  subtitle={
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                      <span className="font-mono text-[8px] uppercase">{COMPUTE_LABEL[compute] ?? compute.toUpperCase()}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="truncate">{tool.description || tool.category_label}</span>
                    </span>
                  }
                  onClick={() => selectTool(tool.id)}
                />
              )
            })}
          </SidebarCollapsibleGroup>
        )
      })}

      {groupedByCategory.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Search size={16} className="text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No models match your search</p>
        </div>
      )}
    </PageSidebar>
  )
}
