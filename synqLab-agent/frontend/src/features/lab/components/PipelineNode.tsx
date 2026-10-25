/**
 * PipelineNodeCard — draggable card for a single node in the pipeline editor.
 */

import { useState } from 'react'
import { GripVertical, X, ChevronDown, ChevronRight, FlaskConical, Dna, BarChart3, FileText, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PipelineNodeDef, NodeStatus } from '@/features/lab/types'

const TOOL_ICONS: Record<string, typeof FlaskConical> = {
  predict_structure: Dna,
  generate_sequences: FlaskConical,
  analyze_stability: BarChart3,
  write_report: FileText,
  search_literature: Search,
}

const STATUS_STYLES: Record<NodeStatus, { bg: string; border: string; dot: string }> = {
  pending: { bg: 'bg-muted/20', border: 'border-border/40', dot: 'bg-muted-foreground/30' },
  running: { bg: 'bg-blue-500/5', border: 'border-blue-500/40', dot: 'bg-blue-500 animate-pulse' },
  completed: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/40', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-destructive/5', border: 'border-destructive/40', dot: 'bg-destructive' },
}

interface PipelineNodeCardProps {
  node: PipelineNodeDef
  selected?: boolean
  onSelect?: () => void
  onDelete?: () => void
  onMove?: (dx: number, dy: number) => void
}

export function PipelineNodeCard({ node, selected, onSelect, onDelete }: PipelineNodeCardProps) {
  const [showParams, setShowParams] = useState(false)

  const Icon = TOOL_ICONS[node.tool_name] || FlaskConical
  const status = node.status || 'pending'
  const styles = STATUS_STYLES[status]

  const paramEntries = Object.entries(node.parameters).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined,
  )

  return (
    <div
      className={`
        rounded-xl border-2 shadow-sm transition-all cursor-pointer select-none
        ${styles.bg} ${selected ? 'border-primary ring-2 ring-primary/20' : styles.border}
        hover:shadow-md min-w-[180px]
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-semibold truncate flex-1">
          {node.label || node.tool_name}
        </span>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tool name badge */}
      <div className="px-3 pb-1.5">
        <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-muted/30">
          {node.tool_name}
        </Badge>
      </div>

      {/* Parameters (collapsible) */}
      {paramEntries.length > 0 && (
        <>
          <button
            className="flex items-center gap-1 px-3 py-1 text-[9px] text-muted-foreground hover:text-foreground w-full"
            onClick={(e) => { e.stopPropagation(); setShowParams(!showParams) }}
          >
            {showParams ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            {paramEntries.length} parameter{paramEntries.length !== 1 ? 's' : ''}
          </button>
          {showParams && (
            <div className="px-3 pb-2 space-y-0.5">
              {paramEntries.map(([key, val]) => (
                <div key={key} className="flex items-center gap-1 text-[9px]">
                  <span className="text-muted-foreground font-mono">{key}:</span>
                  <span className="truncate max-w-[100px] font-mono text-foreground/70">
                    {typeof val === 'string' ? val : JSON.stringify(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Ports */}
      <div className="flex justify-between px-3 pb-2">
        {node.depends_on.length > 0 && (
          <div className="w-3 h-3 rounded-full border-2 border-primary/40 bg-card" title="Input" />
        )}
        <div className="flex-1" />
        <div className="w-3 h-3 rounded-full border-2 border-primary/40 bg-primary/20" title="Output" />
      </div>
    </div>
  )
}
