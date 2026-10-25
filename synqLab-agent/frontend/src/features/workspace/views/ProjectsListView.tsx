/**
 * ProjectsListView — routed view for /workspace/projects.
 */
import { useWorkspace } from '@/pages/WorkspacePage'
import { ProjectsTab } from '../components/ProjectsTab'

export function ProjectsListView() {
  const d = useWorkspace()
  return (
    <ProjectsTab
      org={d.activeOrg}
      projects={d.projects}
      teams={d.activeTeams}
      teamMembers={d.teamMembers}
      loading={d.projectsLoading}
      onNewProject={(prefill) => {
        d.setProjectModalPrefill(prefill || {})
        d.setShowProjectModal(true)
      }}
    />
  )
}
