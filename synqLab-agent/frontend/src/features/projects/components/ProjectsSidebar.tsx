import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Lock, FolderOpen, Plus, Search, X, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import {
  SidebarGroupLabel,
} from '@/components/ui/sidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import type { Project, Team, Org } from '@/features/projects/types'
import { relativeTime } from '@/features/projects/helpers'


interface ProjectsSidebarProps {
  orgs: Org[]
  selectedOrgId: string
  onOrgChange: (id: string) => void
  query: string
  setQuery: (q: string) => void
  projects: Project[]
  activeProjectId?: string
  teams: Record<string, Team[]>
  onNewProject?: (prefill?: { orgId?: string; teamId?: string | null }) => void
}

export function ProjectsSidebar({ orgs, selectedOrgId, onOrgChange, query, setQuery, projects, activeProjectId, teams, onNewProject }: ProjectsSidebarProps) {
  const navigate = useNavigate()
  function getTeamById(orgId: string, teamId: string | null): Team | undefined {
    if (!teamId) return undefined
    return (teams[orgId] ?? []).find((team) => team.id === teamId)
  }

  const [activeTab, setActiveTab] = useState<'all' | 'team' | 'private'>('all')

  const groupedProjects = useMemo(() => {
    // Record<orgId, { orgName: string, teams: Record<teamName, Project[]> }>
    const groups: Record<string, { orgName: string, teams: Record<string, Project[]> }> = {}
    const q = query.trim().toLowerCase()
    
    let filtered = projects
    if (activeTab === 'team') {
      filtered = filtered.filter(p => p.team_id !== null && p.visibility !== 'private')
    } else if (activeTab === 'private') {
      filtered = filtered.filter(p => p.visibility === 'private')
    }
    
    if (q) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q))
    }
    
    filtered.forEach(project => {
      const org = orgs.find(o => o.id === project.org_id)
      const orgName = org?.name ?? 'Unknown Organization'
      const team = getTeamById(project.org_id, project.team_id)
      const teamName = team?.name ?? project.team_name ?? 'Unassigned'
      
      if (!groups[project.org_id]) {
        groups[project.org_id] = { orgName, teams: {} }
      }
      if (!groups[project.org_id].teams[teamName]) {
        groups[project.org_id].teams[teamName] = []
      }
      groups[project.org_id].teams[teamName].push(project)
    })
    return groups
  }, [projects, teams, query, activeTab, orgs])

  const headerContent = (
    <>
      <Select value={selectedOrgId} onValueChange={onOrgChange}>
        <SelectTrigger className="h-8 text-xs bg-background">
          <SelectValue placeholder="Select Organization" />
        </SelectTrigger>
        <SelectContent>
          {orgs.length > 1 && <SelectItem value="__all__">All organizations</SelectItem>}
          {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
      
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="h-8 pl-8 text-xs bg-background pr-8"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground/80">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="mt-1 overflow-x-auto no-scrollbar pb-1 group-data-[collapsible=icon]:hidden">
        <ToggleGroup 
          type="single" 
          value={activeTab} 
          onValueChange={(val) => { if (val) setActiveTab(val as 'all' | 'team' | 'private') }}
          className="justify-start gap-1"
        >
          {([
            { id: 'all', label: 'All' },
            { id: 'team', label: 'Team' },
            { id: 'private', label: 'Private' },
          ] as const).map(tab => (
            <ToggleGroupItem
              key={tab.id}
              value={tab.id}
              className="h-7 px-2 text-xs font-medium capitalize"
            >
              {tab.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  )

  return (
    <PageSidebar 
      title={
        <button
          onClick={() => onNewProject?.()}
          className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors w-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm group-data-[collapsible=icon]:hidden"
        >
          <Plus size={16} />
          <span>New project</span>
        </button>
      }
      headerContent={headerContent}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 pt-2">

        {Object.keys(groupedProjects).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            <FolderOpen size={20} className="text-sidebar-foreground/30" />
            <p>No projects found.</p>
          </div>
        ) : (
          Object.entries(groupedProjects).map(([orgId, orgGroup]) => (
            <div key={orgId} className="mb-4 last:mb-0">
              {selectedOrgId === '__all__' && (
                <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-1 px-2 group-data-[collapsible=icon]:hidden bg-transparent shrink-0">
                  {orgGroup.orgName}
                </SidebarGroupLabel>
              )}
              {Object.entries(orgGroup.teams).map(([teamName, teamProjects]) => (
                <SidebarCollapsibleGroup
                  key={`${orgId}-${teamName}`}
                  title={teamName}
                  titleClassName="text-teal-600 dark:text-teal-300/80"
                  action={
                    <button
                      title={`Add to ${teamName}`} 
                      onClick={(e) => {
                        e.stopPropagation()
                        onNewProject?.({ orgId: teamProjects[0]?.org_id, teamId: teamProjects[0]?.team_id })
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-sidebar-accent/50 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                    >
                      <Plus size={14} />
                      <span className="sr-only">Add Project</span>
                    </button>
                  }
                >
                  {teamProjects.map(project => (
                    <SidebarListItem
                      key={project.id}
                      active={activeProjectId === project.id}
                      title={project.name}
                      icon={<FlaskConical size={13} className={cn(
                        'shrink-0 transition-colors',
                        activeProjectId === project.id ? 'text-primary' : 'text-sidebar-foreground/50'
                      )} />}
                      subtitle={
                        <span className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-sidebar-foreground/50">
                            {project.visibility === 'private' ? <Lock size={9} /> : <Globe size={9} />}
                            <span className="capitalize">{project.visibility}</span>
                          </span>
                          <span className="ml-auto text-[10px] text-sidebar-foreground/40 tabular-nums shrink-0">
                            {relativeTime(project.updated_at)}
                          </span>
                        </span>
                      }
                      onClick={() => navigate(`/workspace/projects/${project.id}`)}
                    />
                  ))}
                </SidebarCollapsibleGroup>
              ))}
            </div>
          ))
        )}
      </div>
    </PageSidebar>
  )
}
