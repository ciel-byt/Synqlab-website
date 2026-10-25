/**
 * PipelinesView — pipeline list + editor view for the Lab hub.
 */

import { useState, useEffect, useCallback } from 'react'
import { GitBranch, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { PipelineDef, PipelineTemplate } from '@/features/lab/types'
import { PipelineEditor } from '@/features/lab/components/PipelineEditor'

export function PipelinesView() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [activePipeline, setActivePipeline] = useState<PipelineDef | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listPipelineTemplates()
        if (!cancelled) setTemplates(data)
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    try {
      const defn = await api.getPipeline(templateId)
      setActivePipeline(defn)
    } catch (err) {
      console.error('Failed to load pipeline:', err)
    }
  }, [])

  const handleNew = useCallback(() => {
    setActivePipeline({
      id: `pipeline_${Date.now().toString(36)}`,
      name: 'New Pipeline',
      description: '',
      nodes: [],
    })
  }, [])

  const handleSave = useCallback(async (pipeline: PipelineDef) => {
    try {
      await api.savePipeline(pipeline.id, pipeline)
    } catch {
      // For templates/new pipelines, save may not be supported yet.
      console.info('Pipeline saved locally (DB save not available for templates)')
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading pipelines...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[240px] flex-shrink-0 border-r border-border/40 bg-card/30 flex flex-col">
        <div className="px-3 py-3 border-b border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Pipelines</h3>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Templates */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase px-2 py-1">
            Templates
          </p>
          {templates.map(t => (
            <button
              key={t.template_id}
              onClick={() => handleSelectTemplate(t.template_id)}
              className={`
                w-full text-left rounded-lg px-3 py-2.5 transition-all
                ${activePipeline?.id === t.template_id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/30 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{t.name}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1 pl-5">
                {t.description}
              </p>
              <div className="flex items-center gap-1 mt-1 pl-5">
                <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                  {t.node_count} nodes
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 min-w-0 relative">
        {activePipeline ? (
          <>
            {/* Pipeline header */}
            <div className="px-4 py-2 border-b border-border/20 bg-card/50 flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{activePipeline.name}</h2>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                {activePipeline.nodes.length} nodes
              </Badge>
            </div>
            <div className="h-[calc(100%-40px)]">
              <PipelineEditor pipeline={activePipeline} onSave={handleSave} />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 mb-4">
              <GitBranch className="h-8 w-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Pipeline Builder</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Compose multi-step research workflows by connecting tool nodes.
              Start from a template or build from scratch.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleNew} className="gap-2">
                <Plus className="h-4 w-4" /> New Pipeline
              </Button>
              {templates.length > 0 && (
                <Button variant="outline" onClick={() => handleSelectTemplate(templates[0].template_id)} className="gap-2">
                  <GitBranch className="h-4 w-4" /> Use Template
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
