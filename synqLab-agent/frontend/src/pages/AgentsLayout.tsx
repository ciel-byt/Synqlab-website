import { Outlet } from 'react-router-dom'

export function AgentsLayout() {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <Outlet />
    </div>
  )
}
