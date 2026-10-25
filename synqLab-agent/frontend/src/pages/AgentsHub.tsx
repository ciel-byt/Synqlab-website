/**
 * AgentsHub — Designer list view for /lab/agents/designer route.
 * Designer is accessible from the Pipelines sidebar.
 */

import { AgentDesignerListView } from '@/features/agent/views/AgentDesignerListView'

export function AgentsHub() {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <AgentDesignerListView />
    </div>
  )
}
