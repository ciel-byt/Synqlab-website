/**
 * PipelineNav — shared navigation for the Pipelines section.
 * Items: + New Pipeline (→ pipelines page), Experiments.
 */

import { Link } from 'react-router-dom'
import { Plus, BarChart3 } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

type ActiveView = 'pipelines' | 'experiments'

export function PipelineNav({
  active,
}: {
  active: ActiveView
}) {
  return (
    <SidebarGroup className="pb-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active === 'pipelines'} tooltip="New Pipeline">
              <Link to="/lab/pipelines">
                <Plus size={14} />
                <span>New Pipeline</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active === 'experiments'} tooltip="Experiments">
              <Link to="/lab/experiments">
                <BarChart3 size={14} />
                <span>Experiments</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
