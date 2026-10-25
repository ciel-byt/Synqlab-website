/**
 * WorkspacePage — hub shell for the workspace.
 *
 * Provides WorkspaceContext (shared data for all child routes).
 * Navigation is handled by the global AppSidebar — no inner sidebar.
 * A clean org selector appears on all workspace pages.
 */
import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useDensity } from '@/features/workspace/helpers'

export { useWorkspace } from '@/contexts/WorkspaceContext'

export function WorkspacePage() {
  const d = useWorkspace()
  useDensity()

  // Listen for sidebar "+" buttons (custom events)
  useEffect(() => {
    const onNewOrg = () => d.setNewOrgOpen(true)
    const onNewProject = () => {
      if (d.activeOrg) { d.setProjectModalPrefill({ orgId: d.activeOrg.id }); d.setShowProjectModal(true) }
    }
    const onNewTeam = () => d.setNewTeamCtx({ orgId: d.activeOrgId })
    const onNewInvite = () => d.setInviteCtx({ orgId: d.activeOrgId })

    window.addEventListener('synqlab:new-org', onNewOrg)
    window.addEventListener('synqlab:new-project', onNewProject)
    window.addEventListener('synqlab:new-team', onNewTeam)
    window.addEventListener('synqlab:new-invite', onNewInvite)
    return () => {
      window.removeEventListener('synqlab:new-org', onNewOrg)
      window.removeEventListener('synqlab:new-project', onNewProject)
      window.removeEventListener('synqlab:new-team', onNewTeam)
      window.removeEventListener('synqlab:new-invite', onNewInvite)
    }
  }, [d])
  return (
    <>
      <main className="flex-1 overflow-y-auto h-full flex flex-col">
        <div className="flex-1 min-h-0">
          {d.loading ? <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div> : <Outlet />}
        </div>
      </main>
    </>
  )
}
