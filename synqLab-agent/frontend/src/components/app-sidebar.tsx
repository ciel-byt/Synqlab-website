/**
 * Application sidebar — built on shadcn/ui Sidebar primitives.
 *
 * Uses `collapsible="icon"` for desktop rail mode and Sheet for mobile drawer.
 * Workspace and Lab sections expand with SidebarMenuSub tree-lines.
 * Chat and Database remain flat top-level items.
 */
import React from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Check, ChevronRight, Plus } from 'lucide-react'
import {
  OrgIcon,
  ChatIcon,
  DatabaseIcon,
  SettingsIcon,
  AdminIcon,
  LogOutIcon,
  ExpandIcon,
  LabIcon,
} from '@/lib/icons'
import {
  FolderOpen, UsersRound, Users,
  Zap, GitBranch, Workflow, GitPullRequestArrow, HardDrive, Dna,
  ChevronsUpDown, Building2,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { entityColorHsl } from '@/lib/entity-colors'
import { cn } from '@/lib/utils'

import { LogoMark } from '@/components/Logo'

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ── Navigation structure ─────────────────────────────────────────────────────

interface NavItem {
  title: string
  icon: React.ComponentType<{ size?: number }>
  href: string
  children?: { title: string; icon: React.ComponentType<{ size?: number }>; href: string; group?: string; inGroup?: boolean; soon?: boolean; spaceBefore?: boolean }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Workspace',
    icon: OrgIcon,
    href: '/workspace',
    children: [
      { title: 'Projects',  icon: FolderOpen,  href: '/workspace/projects' },
      { title: 'Teams',     icon: UsersRound,  href: '/workspace/teams' },
      { title: 'Members',   icon: Users,       href: '/workspace/members' },
    ],
  },
  {
    title: 'Lab',
    icon: LabIcon,
    href: '/lab',
    children: [
      { title: 'SynqLab agent',    icon: Workflow,    href: '/lab/agents' },
      { title: 'Aria',             icon: Dna,         href: '/lab/aria', group: 'Specialist agents', inGroup: true },
      { title: 'Lyra',             icon: Dna,         href: '/lab/lyra', soon: true, inGroup: true },
      { title: 'Pipelines',        icon: GitBranch,   href: '/lab/pipelines', spaceBefore: true },
      { title: 'Computers',       icon: Zap,         href: '/lab/computers' },
      { title: 'Storage',          icon: HardDrive,   href: '/lab/agents/datasets' },
    ],
  },
  { title: 'Chat',     icon: ChatIcon,     href: '/chat' },
  {
    title: 'Docs',
    icon: GitPullRequestArrow,
    href: '/docs',
    children: [
      { title: 'Flows', icon: GitPullRequestArrow, href: '/docs/flows' },
    ],
  },
  { title: 'Database', icon: DatabaseIcon,  href: '/database' },
]

import { initials } from '@/lib/initials'

// ── Component ────────────────────────────────────────────────────────────────

// Quick-action events for workspace sub-items (+  buttons)
const WORKSPACE_QUICK_ACTIONS: Record<string, { event: string; label: string }> = {
  '/workspace/projects': { event: 'synqlab:new-project', label: 'New project' },
  '/workspace/teams':    { event: 'synqlab:new-team',    label: 'New team' },
  '/workspace/members':  { event: 'synqlab:new-invite',  label: 'Invite member' },
}

/* ── Theme toggle (compact dropdown) ──────────────────────────────────────── */


export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { open } = useSidebar()
  const d = useWorkspace()

  // Controlled collapsible state — derive initial from current URL
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const item of NAV_ITEMS) {
      if (item.children) {
        initial[item.href] = location.pathname.startsWith(item.href)
      }
    }
    return initial
  })

  // Auto-expand section when navigating into it or deeper within it
  const prevPathRef = React.useRef(location.pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = location.pathname
    for (const item of NAV_ITEMS) {
      if (!item.children) continue
      const nowInside = location.pathname.startsWith(item.href)
      const wasInside = prev.startsWith(item.href)
      const pathChanged = prev !== location.pathname
      // Auto-expand when: entering from outside, OR navigating to a different child
      if (nowInside && pathChanged && (!wasInside || !(openSections[item.href] ?? true))) {
        setOpenSections(p => ({ ...p, [item.href]: true }))
      }
    }
  }, [location.pathname])

  // "Specialist agents" group (Aria, Lyra): closed by default, opens when you are on one of its pages.
  const inSpecialist = location.pathname.startsWith('/lab/aria') || location.pathname.startsWith('/lab/lyra')
  const [specOpen, setSpecOpen] = React.useState(inSpecialist)
  React.useEffect(() => { if (inSpecialist) setSpecOpen(true) }, [inSpecialist])

  // Routes that belong to the Pipelines family in the sidebar
  // even though their URL doesn't start with /lab/pipelines
  const PIPELINE_ALIASES = ['/lab/agents/designer', '/lab/experiments']
  // Routes nested under /lab/agents that should NOT highlight the Agents nav item
  const AGENTS_EXCLUDES = [...PIPELINE_ALIASES, '/lab/agents/datasets']

  function isActive(href: string) {
    if (href === '/workspace' || href === '/lab') {
      return location.pathname === href || location.pathname === href + '/'
    }
    // Designer & Experiments should highlight "Pipelines", not "Agents"
    if (href === '/lab/pipelines') {
      if (PIPELINE_ALIASES.some(a => location.pathname.startsWith(a))) return true
    }
    if (href === '/lab/agents' && AGENTS_EXCLUDES.some(a => location.pathname.startsWith(a))) {
      return false
    }
    return location.pathname.startsWith(href)
  }

  function isParentActive(href: string) {
    return location.pathname.startsWith(href)
  }

  // Split orgs: owned vs invited
  const myOrgs = d.orgs.filter(o => {
    const me = (d.members[o.id] ?? []).find(m => m.user_id === user?.id)
    return me?.role === 'owner'
  })
  const invitedOrgs = d.orgs.filter(o => {
    const me = (d.members[o.id] ?? []).find(m => m.user_id === user?.id)
    return !me || me.role !== 'owner'
  })

  function onSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {open ? (
              <div className="flex items-center gap-1">
                {/* Org switcher dropdown — takes available width */}
                <div className="flex-1 min-w-0">
                  {d.activeOrg ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full">
                          <div
                            className="flex aspect-square size-8 items-center justify-center rounded-lg text-white font-bold text-xs shadow-sm shrink-0"
                            style={d.activeOrg.avatar_url ? undefined : { backgroundColor: entityColorHsl(d.activeOrg.id) }}
                          >
                            {d.activeOrg.avatar_url ? (
                              <img src={d.activeOrg.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                            ) : (
                              d.activeOrg.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                            <span className="truncate font-semibold">{d.activeOrg.name}</span>
                            <span className="truncate text-xs text-sidebar-foreground/60">@{d.activeOrg.slug}</span>
                          </div>
                          <ChevronsUpDown className="ml-auto size-4 opacity-50 shrink-0" />
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                        {myOrgs.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                              My Organizations
                            </div>
                            {myOrgs.map(o => (
                              <DropdownMenuItem
                                key={o.id}
                                onClick={() => d.setActiveOrgId(o.id)}
                                className={o.id === d.activeOrg?.id ? 'bg-muted font-semibold' : ''}
                              >
                                <Building2 size={14} className="mr-2 text-muted-foreground" />
                                {o.name}
                                {o.id === d.activeOrg?.id && <span className="ml-auto text-primary text-xs">✓</span>}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {invitedOrgs.length > 0 && (
                          <>
                            {myOrgs.length > 0 && <DropdownMenuSeparator />}
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                              Invited
                            </div>
                            {invitedOrgs.map(o => (
                              <DropdownMenuItem
                                key={o.id}
                                onClick={() => d.setActiveOrgId(o.id)}
                                className={o.id === d.activeOrg?.id ? 'bg-muted font-semibold' : ''}
                              >
                                <Building2 size={14} className="mr-2 text-muted-foreground/40" />
                                {o.name}
                                {o.id === d.activeOrg?.id && <span className="ml-auto text-primary text-xs">✓</span>}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => d.setNewOrgOpen(true)}>
                          <Plus size={14} className="mr-2 text-muted-foreground" />
                          New organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <SidebarMenuButton size="lg" asChild tooltip="SynqLab">
                      <Link to="/">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                          <LogoMark className="h-8" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">SynqLab</span>
                          <span className="truncate text-xs text-sidebar-foreground/60">An AI lab for biology</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </div>
              </div>
            ) : (
              /* Collapsed: show org avatar as tooltip button that opens the org dropdown */
              d.activeOrg ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="flex items-center justify-center mx-auto min-h-12">
                      <div
                        className="flex aspect-square size-8 items-center justify-center rounded-lg text-white font-bold text-xs shadow-sm shrink-0"
                        style={d.activeOrg.avatar_url ? undefined : { backgroundColor: entityColorHsl(d.activeOrg.id) }}
                      >
                        {d.activeOrg.avatar_url ? (
                          <img src={d.activeOrg.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          d.activeOrg.name.charAt(0).toUpperCase()
                        )}
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-48">
                    {myOrgs.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                          My Organizations
                        </div>
                        {myOrgs.map(o => (
                          <DropdownMenuItem
                            key={o.id}
                            onClick={() => d.setActiveOrgId(o.id)}
                            className={o.id === d.activeOrg?.id ? 'bg-muted font-semibold' : ''}
                          >
                            <Building2 size={14} className="mr-2 text-muted-foreground" />
                            {o.name}
                            {o.id === d.activeOrg?.id && <span className="ml-auto text-primary text-xs">✓</span>}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    {invitedOrgs.length > 0 && (
                      <>
                        {myOrgs.length > 0 && <DropdownMenuSeparator />}
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                          Invited
                        </div>
                        {invitedOrgs.map(o => (
                          <DropdownMenuItem
                            key={o.id}
                            onClick={() => d.setActiveOrgId(o.id)}
                            className={o.id === d.activeOrg?.id ? 'bg-muted font-semibold' : ''}
                          >
                            <Building2 size={14} className="mr-2 text-muted-foreground/40" />
                            {o.name}
                            {o.id === d.activeOrg?.id && <span className="ml-auto text-primary text-xs">✓</span>}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => d.setNewOrgOpen(true)}>
                      <Plus size={14} className="mr-2 text-muted-foreground" />
                      New organization
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarMenuButton size="lg" asChild tooltip="SynqLab" className="flex items-center justify-center mx-auto min-h-12">
                  <Link to="/">
                    <LogoMark className="h-6" />
                  </Link>
                </SidebarMenuButton>
              )
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item =>
                item.children ? (
                  /* ── Collapsible section (Workspace / Lab) ── */
                  <Collapsible
                    key={item.href}
                    asChild
                    open={openSections[item.href] ?? true}
                    onOpenChange={(val) => setOpenSections(prev => ({ ...prev, [item.href]: val }))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isActive(item.href)}
                          data-section-active={!isActive(item.href) && isParentActive(item.href) ? 'true' : undefined}
                          onClick={() => {
                            // Always navigate to the parent route
                            if (!location.pathname.startsWith(item.href)) {
                              setOpenSections(prev => ({ ...prev, [item.href]: true }))
                            }
                            navigate(item.href)
                          }}
                        >
                          <item.icon />
                          <span className="flex-1">{item.title}</span>
                          <span
                            className={cn(
                              'ml-auto',
                              !(openSections[item.href] ?? true) && location.pathname.startsWith(item.href) && 'animate-chevron-hint'
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenSections(prev => ({ ...prev, [item.href]: !prev[item.href] }))
                            }}
                          >
                            <ChevronRight
                              size={14}
                              className={cn(
                                'transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90',
                                !(openSections[item.href] ?? true) && location.pathname.startsWith(item.href) && 'text-primary'
                              )}
                            />
                          </span>
                        </SidebarMenuButton>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map(child => {
                            const hidden = !!child.inGroup && !specOpen
                            // Determine which quick-action event this child gets
                            const quickAction = item.href === '/workspace'
                              ? WORKSPACE_QUICK_ACTIONS[child.href]
                              : undefined

                            return (
                              <SidebarMenuSubItem key={child.href} className={cn('group/sub', child.spaceBefore && 'mt-2')}>
                                {child.group && (
                                  <button
                                    type="button"
                                    onClick={() => setSpecOpen(o => !o)}
                                    aria-expanded={specOpen}
                                    className="mt-1 flex w-full items-center gap-1 px-2 pb-1 pt-2 text-left text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground"
                                  >
                                    <ChevronRight size={11} className={cn('transition-transform duration-200', specOpen && 'rotate-90')} />
                                    {child.group}
                                  </button>
                                )}
                                <div className={cn('flex items-center', hidden && 'hidden', child.inGroup && 'pl-2')}>
                                  <SidebarMenuSubButton
                                    asChild
                                    size="sm"
                                    isActive={isActive(child.href)}
                                    className="flex-1"
                                  >
                                    <Link to={child.href}>
                                      <span>{child.title}</span>
                                      {child.soon && <span className="ml-auto rounded-full border border-sidebar-border px-1.5 text-[9px] uppercase tracking-wide text-sidebar-foreground/60">Soon</span>}
                                    </Link>
                                  </SidebarMenuSubButton>
                                  {quickAction && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        window.dispatchEvent(new CustomEvent(quickAction.event))
                                      }}
                                      className="h-5 w-5 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                                      title={quickAction.label}
                                    >
                                      <Plus size={11} />
                                    </button>
                                  )}
                                </div>
                              </SidebarMenuSubItem>
                            )
                          })}
                          {/* + Organization — always-visible inline input */}
                          {item.href === '/workspace' && (
                            <SidebarMenuSubItem>
                              <form
                                className="flex h-7 -translate-x-px items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent/50 transition-colors"
                                onSubmit={(ev) => d.createOrg(ev)}
                              >
                                <Plus size={14} className="shrink-0 text-muted-foreground/60" />
                                <input
                                  value={d.newOrgName}
                                  onChange={(e) => { d.setNewOrgName(e.target.value); d.setNewOrgSlug('') }}
                                  onKeyDown={(e) => { if (e.key === 'Escape') { d.setNewOrgName(''); d.setNewOrgSlug('');(e.target as HTMLInputElement).blur() } }}
                                  placeholder="Organization"
                                  className="h-full flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
                                />
                                {d.newOrgName.trim() && (
                                  <button type="submit" className="shrink-0 p-0.5 rounded text-primary hover:bg-primary/10 transition-colors" title="Create (Enter)">
                                    <Check size={13} />
                                  </button>
                                )}
                              </form>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  /* ── Flat item (Chat / Database) ── */
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isParentActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — user menu */}
      <SidebarFooter>
        <SidebarMenu>
          {/* User menu */}
          <SidebarMenuItem>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-full">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                      <AvatarFallback className="rounded-full text-xs">
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.full_name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <ExpandIcon className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon />
                    Settings
                  </DropdownMenuItem>
                  {user.is_admin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <AdminIcon />
                      Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut}>
                    <LogOutIcon />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton asChild>
                <Link to="/login">Sign In</Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}

