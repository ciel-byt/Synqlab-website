import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToolsPage } from './pages/ToolsPage'
import { PipelinePage } from './pages/PipelinePage'
import { ExperimentsPage } from './pages/ExperimentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'
import { FlowsPage } from './pages/FlowsPage'
import { AgentsLayout } from './pages/AgentsLayout'
import { AgentsConsoleLayout } from './pages/AgentsConsoleLayout'
import { AgentConsoleView } from './features/agent/views/AgentConsoleView'
import { AgentDesignerCanvasPage } from './pages/AgentDesignerCanvasPage'
import AgentDatasetsPage from '@/pages/AgentDatasetsPage'
import { DatabasePage } from './pages/DatabasePage'
import { LabPage } from './pages/LabPage'
import { ModelsPage } from './pages/ModelsPage'
import { SkillsPage } from './pages/SkillsPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ChatPage } from './pages/ChatPage'
import { InvitePage } from './pages/InvitePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { ProjectPage } from './pages/ProjectPage'
import { BlogPage } from './pages/BlogPage'
// Workspace sub-views
import { ProjectsListView } from './features/workspace/views/ProjectsListView'
import { TeamsListView } from './features/workspace/views/TeamsListView'
import { TeamDetailView } from './features/workspace/views/TeamDetailView'
import { MembersListView } from './features/workspace/views/MembersListView'
import { WorkspaceDesktopView } from './features/workspace/views/WorkspaceDesktopView'
import { MemberDetailView } from './features/workspace/views/MemberDetailView'

// Lab sub-views
import { AriaPage } from './pages/AriaPage'
import { LabOverviewView } from './features/lab/views/LabOverviewView'
import { ToolsConsoleView } from './features/tools/views/ToolsConsoleView'
import { Gfp11RunPage } from './pages/Gfp11RunPage'

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Toaster position="top-right" />
      <Routes>
        {/* Landing page preview — accessible on any host at /landing */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/lab/agents/console" replace />} />
          <Route path="database" element={<DatabasePage />} />
          <Route path="chat" element={<ChatPage />} />

          {/* Docs — documentation section */}
          <Route path="docs">
            <Route index element={<Navigate to="/docs/flows" replace />} />
            <Route path="flows" element={<FlowsPage />} />
          </Route>

          {/* Lab — unified science hub with nested routes */}
          <Route path="lab" element={<LabPage />}>
            <Route index element={<LabOverviewView />} />
            <Route path="computers" element={<ToolsPage />}>
              <Route index element={<ToolsConsoleView />} />
              <Route path=":toolId" element={<ToolsConsoleView />} />
            </Route>
            {/* Backward compat: /lab/tools → /lab/computers */}
            <Route path="tools" element={<Navigate to="/lab/computers" replace />} />
            <Route path="tools/:toolId" element={<Navigate to="/lab/computers" replace />} />
            <Route path="pipelines" element={<PipelinePage />} />
            <Route path="pipelines/gfp11/run" element={<Gfp11RunPage />} />
            <Route path="pipelines/gfp11-demo/run" element={<Navigate to="/lab/pipelines/gfp11/run" replace />} />
            <Route path="pipelines/:pipelineId/edit" element={<AgentDesignerCanvasPage />} />
            <Route path="flows" element={<Navigate to="/docs/flows" replace />} />
            <Route path="agents" element={<AgentsLayout />}>
              <Route index element={<Navigate to="/lab/agents/console" replace />} />
              <Route path="console" element={<AgentsConsoleLayout />}>
                <Route index element={<AgentConsoleView />} />
              </Route>
                              <Route path="designer" element={<Navigate to="/lab/pipelines" replace />} />
              <Route path="designer/:pipelineId" element={<Navigate to="/lab/pipelines" replace />} />
              <Route path="datasets" element={<AgentDatasetsPage />} />
              <Route path="skills" element={<SkillsPage />} />
            </Route>
            <Route path="aria" element={<AriaPage />} />
            <Route path="experiments" element={<ExperimentsPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="skills" element={<Navigate to="/lab/agents/skills" replace />} />
            {/* Health merged into tools — redirect for backward compat */}
            <Route path="health" element={<Navigate to="/lab/agents/console" replace />} />
          </Route>

          {/* Workspace — unified hub with nested routes */}
          <Route path="workspace" element={<WorkspacePage />}>
            <Route index element={<WorkspaceDesktopView />} />
            <Route path="projects" element={<ProjectsListView />} />
            <Route path="projects/:projectId" element={<ProjectPage />} />
            <Route path="teams" element={<TeamsListView />} />
            <Route path="teams/:teamId" element={<TeamDetailView />} />
            <Route path="members" element={<MembersListView />} />
            <Route path="members/:userId" element={<MemberDetailView />} />
            {/* Invites merged into Members — redirect for backward compat */}
            <Route path="invites" element={<Navigate to="/workspace/members" replace />} />
            {/* Settings merged into overview — redirect for backward compat */}
            <Route path="settings" element={<Navigate to="/workspace" replace />} />
          </Route>

          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />

        </Route>
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  )
}
