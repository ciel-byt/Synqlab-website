/**
 * Organization sidebar — uses PageSidebar to match Chat/Projects layout.
 *
 * Header pattern mirrors Chat/Projects:
 *   title  = "+ New organization" primary CTA
 *   headerContent = sort Select + search Input
 *   content = SidebarCollapsibleGroup per org
 */
import { Search, Plus, ArrowUpDown } from 'lucide-react'
import type { Org, Member, Team, Invite, TeamMember, Selection, ContextMenuItem } from '../types'
import { TreeSkeleton } from '../components'
import { OrgTree } from './OrgTreeNode'
import { EmptyTree } from './shared'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export function OrgSidebar(props: {
  loading: boolean
  filteredOrgs: Org[]
  expanded: Set<string>
  selection: Selection
  members: Record<string, Member[]>
  teams: Record<string, Team[]>
  invites: Record<string, Invite[]>
  teamMembers: Record<string, TeamMember[]>
  search: string
  orgSort: string
  onSearchChange: (v: string) => void
  onSortChange: (v: string) => void
  onToggle: (key: string, loadOrg?: string, loadTeam?: string) => void
  onSelect: (sel: Selection) => void
  onNewOrg: () => void
  buildOrgMenu: (org: Org) => ContextMenuItem[]
  buildTeamsFolderMenu: (orgId: string) => ContextMenuItem[]
  buildTeamMenu: (orgId: string, team: Team) => ContextMenuItem[]
  buildPeopleFolderMenu: (orgId: string) => ContextMenuItem[]
  buildMemberMenu: (orgId: string, m: Member) => ContextMenuItem[]
  buildInvitesFolderMenu: (orgId: string) => ContextMenuItem[]
}) {
  const headerContent = (
    <>
      {/* Sort select — compact inline */}
      <Select value={props.orgSort} onValueChange={props.onSortChange}>
        <SelectTrigger className="h-8 text-xs bg-background">
          <ArrowUpDown size={12} className="text-muted-foreground/70 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_desc">Newest</SelectItem>
          <SelectItem value="created_asc">Oldest</SelectItem>
          <SelectItem value="name_asc">A-Z</SelectItem>
          <SelectItem value="name_desc">Z-A</SelectItem>
        </SelectContent>
      </Select>

      {/* Search input — matches Chat/Projects */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Search organizations…"
          className="h-8 pl-8 text-xs bg-background"
        />
      </div>
    </>
  )

  return (
    <PageSidebar
      title={
        <button
          onClick={props.onNewOrg}
          className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors w-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm group-data-[collapsible=icon]:hidden"
        >
          <Plus size={16} />
          <span>New organization</span>
        </button>
      }
      headerContent={headerContent}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 pt-2">
        {props.loading ? (
          <TreeSkeleton />
        ) : props.filteredOrgs.length === 0 ? (
          <EmptyTree onCreate={props.onNewOrg} query={props.search} />
        ) : (
          props.filteredOrgs.map((org) => (
            <OrgTree
              key={org.id}
              org={org}
              expanded={props.expanded}
              selection={props.selection}
              members={props.members[org.id] ?? []}
              teams={props.teams[org.id] ?? []}
              invites={props.invites[org.id] ?? []}
              teamMembersByTeam={props.teamMembers}
              onToggle={props.onToggle}
              onSelect={props.onSelect}
              buildOrgMenu={props.buildOrgMenu}
              buildTeamsFolderMenu={props.buildTeamsFolderMenu}
              buildTeamMenu={props.buildTeamMenu}
              buildPeopleFolderMenu={props.buildPeopleFolderMenu}
              buildMemberMenu={props.buildMemberMenu}
              buildInvitesFolderMenu={props.buildInvitesFolderMenu}
            />
          ))
        )}
      </div>
    </PageSidebar>
  )
}
