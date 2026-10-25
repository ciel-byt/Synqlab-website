/**
 * AgentDesignerListView — pipeline templates from the API.
 * Wrapped in ModularPageLayout with shared PipelineNav sidebar.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/blocks/EmptyState'
import { EntityCard } from '@/components/ui/entity-card'
import { PageHeader } from '@/components/ui/page-header'
import { api } from '@/api/client'
import type { PipelineTemplate } from '@/features/lab/types'

import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { PipelineNav } from '@/features/lab/components/PipelineNav'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'

export function AgentDesignerListView() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listPipelineTemplates()
        if (!cancelled) setTemplates(data)
      } catch (err) {
        if (!cancelled) setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const navigate = useNavigate()

  const sidebar = (
    <PageSidebar title="Pipelines">
      <PipelineNav active="pipelines" />
      <SidebarGroup className="flex-1 min-h-0 flex flex-col pt-2">
        <SidebarGroupLabel className="text-[10px]">Templates ({templates.length})</SidebarGroupLabel>
        <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
          {templates.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Layers className="h-6 w-6 text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground">No templates</p>
            </div>
          ) : (
            <div className="space-y-1">
              {templates.map(t => (
                <SidebarListItem
                  key={t.template_id}
                  title={t.name}
                  subtitle={t.description}
                  icon={<Layers size={13} className="text-primary/60" />}
                  onClick={() => navigate(`/lab/agents/designer/${t.template_id}`)}
                />
              ))}
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </PageSidebar>
  )

  if (loading) {
    return (
      <ModularPageLayout sidebar={sidebar}>
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading pipelines…</span>
          </div>
        </div>
      </ModularPageLayout>
    )
  }

  if (error) {
    return (
      <ModularPageLayout sidebar={sidebar}>
        <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
          <EmptyState
            icon={Layers}
            title="Failed to load pipelines"
            description={error}
          />
        </div>
      </ModularPageLayout>
    )
  }

  return (
    <ModularPageLayout sidebar={sidebar}>
      <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
        <PageHeader
          title="Pipeline templates"
          description={`${templates.length} template${templates.length === 1 ? '' : 's'} available`}
        />

        {templates.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No pipeline templates"
            description="No pipeline templates are configured on the server."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map(t => (
              <EntityCard
                key={t.template_id}
                layout="horizontal"
                title={t.name}
                subtitle={t.description}
                href={`/lab/agents/designer/${t.template_id}`}
                icon={{ letter: t.name.charAt(0).toUpperCase(), color: 'hsl(var(--primary))' }}
                badges={[
                  { icon: Layers, count: `${t.node_count} nodes`, title: 'Nodes' },
                ]}
              />
            ))}
          </div>
        )}
      </div>
    </ModularPageLayout>
  )
}
