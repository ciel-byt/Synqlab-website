import { createContext, useContext, type ReactNode } from 'react'
import { useWorkspaceData as UseWorkspaceDataType, useWorkspaceData } from '@/features/workspace/hooks/useWorkspaceData'
import { WorkspaceModals } from '@/features/workspace/components/WorkspaceModals'

type WorkspaceCtx = ReturnType<typeof UseWorkspaceDataType>
const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const d = useWorkspaceData()

  return (
    <WorkspaceContext.Provider value={d}>
      {children}
      <WorkspaceModals d={d} />
    </WorkspaceContext.Provider>
  )
}
