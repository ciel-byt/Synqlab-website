/**
 * Root app layout — uses shadcn/ui SidebarProvider + SidebarInset.
 *
 * Mobile drawer, keyboard shortcut (Cmd+B), icon-collapse, and
 * responsive behavior are all handled by the Sidebar primitive.
 */
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'

export function Layout() {
  return (
    <WorkspaceProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden">
          <div
            className="depth-inset page-enter content-glow flex-1 min-h-0 overflow-hidden bg-surface"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
            }}
          >
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </WorkspaceProvider>
  )
}
