/**
 * CanvasToolNode — shared ReactFlow node component for pipeline canvases.
 *
 * Used by: AgentDesignerCanvasPage, InlineCanvasEditor, PipelineCanvasPanel.
 * Shows tool icon, name, I/O count, and a hover tooltip with description.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { ToolIcon, catAccent } from '@/features/tools/helpers'
import type { Tool } from '@/types'

export interface ToolNodeData {
  tool: Tool
  instanceLabel?: string
}

export function CanvasToolNode({ data, selected }: NodeProps) {
  const { tool, instanceLabel } = data as unknown as ToolNodeData
  const accent = catAccent(tool.category)
  const nIn = tool.inputs?.length ?? 0
  const nOut = tool.outputs?.length ?? 0

  return (
    <div className={cn(
      'group relative bg-card rounded-md overflow-visible transition-all duration-150',
      selected
        ? 'shadow-[0_0_0_2px_#0f172a]'
        : 'shadow-[0_0_0_1px_rgba(0,0,0,0.10)] hover:shadow-[0_0_0_1.5px_rgba(0,0,0,0.18)]',
    )}>
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md', accent.bar)} />

      <Handle
        type="target"
        position={Position.Left}
        style={{ left: -5, width: 10, height: 10, background: '#cbd5e1', border: '2px solid white', borderRadius: 2 }}
      />

      <div className="pl-3.5 pr-3 py-2 flex items-center gap-2.5 min-w-0">
        <div className={cn('w-5 h-5 rounded flex items-center justify-center flex-shrink-0', accent.iconBg)}>
          <ToolIcon toolId={tool.id} category={tool.category} size={11} className={accent.iconText} />
        </div>
        <span className="text-[12.5px] font-semibold text-foreground truncate leading-none">
          {instanceLabel || tool.name}
        </span>
        <span className="text-[10px] text-muted-foreground/70 font-mono flex-shrink-0 ml-auto pl-2">
          {nIn}→{nOut}
        </span>
      </div>

      {/* Hover tooltip */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      bg-slate-900 text-white rounded-md shadow-xl w-56 p-3 space-y-2">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45" />
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold flex-1 text-white">{tool.name}</p>
          {tool.phase && tool.phase !== 'v1' && (
            <span className="text-[8.5px] font-mono px-1 py-0.5 bg-white/10 text-slate-400 rounded">{tool.phase}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">{tool.description}</p>
        {(nIn > 0 || nOut > 0) && (
          <div className="flex gap-3 pt-1 border-t border-slate-700 text-[10.5px] text-slate-400">
            {nIn > 0 && <span><span className="text-white font-medium">{nIn}</span> input{nIn !== 1 ? 's' : ''}</span>}
            {nOut > 0 && <span><span className="text-white font-medium">{nOut}</span> output{nOut !== 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ right: -5, width: 10, height: 10, background: '#0f172a', border: '2px solid white', borderRadius: 2 }}
      />
    </div>
  )
}

export const CANVAS_NODE_TYPES = { tool: CanvasToolNode }
