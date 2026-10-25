import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'

interface PageSidebarProps {
  title?: ReactNode
  headerContent?: ReactNode
  headerBadge?: ReactNode
  /** Optional actions rendered in the sidebar header (e.g. refresh button). */
  actions?: ReactNode
  children: ReactNode
}

export function PageSidebar({ title, headerContent, headerBadge, actions, children }: PageSidebarProps) {
  const { toggleSidebar, state } = useSidebar()

  return (
    <Sidebar collapsible="icon" className="absolute h-full border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-border pt-4 pb-2 px-3">
        <div className="flex items-center justify-between mb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:pb-2">
          <div className="text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">{title}</div>
          <div className="flex items-center gap-1 relative">
            {actions && (
              <div className="group-data-[collapsible=icon]:hidden flex items-center">
                {actions}
              </div>
            )}
            <button
              onClick={toggleSidebar}
              title={state === "expanded" ? "Collapse panel" : "Expand panel"}
              className="h-7 w-7 rounded-md flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              {state === "expanded" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            {headerBadge}
          </div>
        </div>
        
        {headerContent && (
          <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
            {headerContent}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="p-2 flex flex-col gap-4 group-data-[collapsible=icon]:hidden flex-1 min-h-0 overflow-y-auto">
        {children}
      </SidebarContent>
    </Sidebar>
  )
}
