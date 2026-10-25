/**
 * LabPage — hub shell for the science/lab section.
 *
 * Navigation is handled by the global AppSidebar — no inner sidebar.
 * Child routes render directly via Outlet.
 */
import { Outlet } from 'react-router-dom'

export function LabPage() {
  return (
    <main className="flex-1 overflow-y-auto h-full">
      <Outlet />
    </main>
  )
}
