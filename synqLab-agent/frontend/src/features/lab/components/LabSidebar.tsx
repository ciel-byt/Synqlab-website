/**
 * LabSidebar — nav-only sidebar for the Lab hub.
 *
 * Mirrors the WorkspaceSidebar pattern: pure navigation links,
 * active-state highlighting, and optional count badges.
 */
import {
  Home,
  Zap,
  GitBranch,
  Workflow,
  BarChart3,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { LAB_TABS } from '../types'

const TAB_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  tools:       Zap,
  pipelines:   GitBranch,
  agents:      Workflow,
  experiments: BarChart3,
}

export function LabSidebar() {
  const location = useLocation()
  const isOverview = location.pathname === '/lab' || location.pathname === '/lab/'

  return (
    <PageSidebar title="Lab">
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px]">Lab</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Overview / Home */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isOverview} tooltip="Overview">
                <Link to="/lab">
                  <Home size={14} />
                  <span className="flex-1">Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {LAB_TABS.map(({ key, label, path }) => {
              const Icon = TAB_ICONS[key]
              const isActive = !isOverview && location.pathname.startsWith(path)
              return (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                    <Link to={path}>
                      <Icon size={14} />
                      <span className="flex-1">{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </PageSidebar>
  )
}
