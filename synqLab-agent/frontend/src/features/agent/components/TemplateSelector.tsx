/**
 * TemplateSelector — grid of agent template cards for one-click session creation.
 */

import { useState, useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { AgentTemplate } from '@/features/agent/types'

interface TemplateSelectorProps {
  onSelect: (template: AgentTemplate) => void
}

function formatBudget(limit: number): string {
  if (limit >= 1_000_000) return `${(limit / 1_000_000).toFixed(0)}M`
  if (limit >= 1_000) return `${(limit / 1_000).toFixed(0)}K`
  return limit.toString()
}

const AUTONOMY_COLORS: Record<string, string> = {
  autonomous: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  supervised: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  copilot: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.listAgentTemplates()
        if (!cancelled) setTemplates(data)
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading templates...</span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Start from Template</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="group text-left rounded-xl border border-border/40 bg-card/50 p-4 transition-all hover:border-primary/30 hover:shadow-md hover:bg-card/80"
          >
            {/* Icon + Name */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl border border-primary/10 group-hover:border-primary/30 transition-colors">
                {template.icon}
              </div>
              <div>
                <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                  {template.name}
                </h4>
                <span className="text-[9px] text-muted-foreground">{template.model}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-[10px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {template.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className={`text-[8px] h-4 px-1.5 ${AUTONOMY_COLORS[template.autonomy_mode] || ''}`}
              >
                {template.autonomy_mode}
              </Badge>
              {template.budget?.session_limit && (
                <Badge variant="outline" className="text-[8px] h-4 px-1.5">
                  {formatBudget(template.budget.session_limit)} tokens
                </Badge>
              )}
              {template.tags.slice(0, 2).map(tag => (
                <Badge key={tag} variant="outline" className="text-[8px] h-4 px-1.5 bg-muted/20">
                  {tag}
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
