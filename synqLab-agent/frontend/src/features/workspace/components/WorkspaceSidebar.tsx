/**
 * WorkspaceSidebar — nav-only sidebar with org selector and route links.
 */
import { Building2, FolderOpen, Home, MailPlus, Plus, Settings, Users, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { WORKSPACE_TABS, type Org } from '../types'

const TAB_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  projects: FolderOpen,
  teams: UsersRound,
  members: Users,
  invites: MailPlus,
  settings: Settings,
}

interface Props {
  orgs: Org[]
  activeOrgId: string
  onOrgChange: (id: string) => void
  onNewOrg: () => void
  counts: { projects: number; teams: number; members: number; invites: number }
}

export function WorkspaceSidebar({ orgs, activeOrgId, onOrgChange, onNewOrg, counts }: Props) {
  const location = useLocation()
  const isDesktop = location.pathname === '/workspace' || location.pathname === '/workspace/'

  return (
    <PageSidebar
      title={
        <button
          onClick={onNewOrg}
          className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors w-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm group-data-[collapsible=icon]:hidden"
        >
          <Plus size={16} />
          <span>New organization</span>
        </button>
      }
    >
      {/* Org selector */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px]">Organization</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Select value={activeOrgId} onValueChange={onOrgChange}>
                <SelectTrigger className="h-9 w-full text-sm font-medium border-border">
                  <div className="flex items-center gap-2 truncate">
                    <Building2 size={14} className="shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Select organization" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Navigation tabs — route links */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px]">Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Desktop / Home link */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isDesktop} tooltip="Overview">
                <Link to="/workspace">
                  <Home size={14} />
                  <span className="flex-1">Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {WORKSPACE_TABS.map(({ key, label, path }) => {
              const Icon = TAB_ICONS[key]
              const isActive = !isDesktop && location.pathname.startsWith(path)
              const count = key !== 'settings' ? counts[key as keyof typeof counts] : undefined
              return (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={label}
                  >
                    <Link to={path}>
                      <Icon size={14} />
                      <span className="flex-1">{label}</span>
                      {count !== undefined && (
                        <span className="text-[10px] tabular-nums text-sidebar-foreground/40">{count}</span>
                      )}
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
