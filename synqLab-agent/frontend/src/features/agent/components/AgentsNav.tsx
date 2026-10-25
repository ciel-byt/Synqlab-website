/**
 * AgentsNav — shared navigation links for the Agents section.
 * Used in Console and Skills sidebars.
 */

import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

type ActiveView = 'console' | 'skills'

export function AgentsNav({
  active,
  onNewChat,
}: {
  active: ActiveView
  onNewChat?: () => void
}) {
  return (
    <SidebarGroup className="pb-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            {onNewChat ? (
              <SidebarMenuButton
                isActive={active === 'console'}
                tooltip="New Chat"
                onClick={onNewChat}
              >
                <Plus size={14} />
                <span>New Chat</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={active === 'console'}
                tooltip="Console"
              >
                <Link to="/lab/agents/console">
                  <Plus size={14} />
                  <span>New Chat</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={active === 'skills'}
              tooltip="Skills"
            >
              <Link to="/lab/agents/skills">
                <Sparkles size={14} />
                <span>Skills</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
