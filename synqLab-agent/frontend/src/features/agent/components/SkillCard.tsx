/**
 * SkillCard — compact card displaying a single skill for the browser grid.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AgentSkill } from '@/features/agent/types'

interface SkillCardProps {
  skill: AgentSkill
  selected?: boolean
  onSelect?: (skill: AgentSkill) => void
}

export function SkillCard({ skill, selected, onSelect }: SkillCardProps) {
  const [showBody, setShowBody] = useState(false)

  return (
    <div
      className={`
        group rounded-lg border p-3 transition-all cursor-pointer
        ${selected
          ? 'border-primary bg-primary/5'
          : 'border-border/50 bg-card hover:border-border'
        }
      `}
      onClick={() => onSelect?.(skill)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-medium truncate">{skill.name}</h4>
            <p className="text-[9px] text-muted-foreground">v{skill.version}</p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="text-[8px] px-1 py-0 h-3.5 flex-shrink-0"
        >
          {skill.source === 'core' ? 'Core' : 'Custom'}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mb-2">
        {skill.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {skill.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        {skill.tags.length > 3 && (
          <span className="text-[8px] text-muted-foreground">+{skill.tags.length - 3}</span>
        )}
      </div>

      {/* Preview toggle */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setShowBody(!showBody) }}
        className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showBody ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        <BookOpen className="h-2.5 w-2.5" />
        Preview
      </button>

      {showBody && (
        <pre className="mt-2 text-[9px] font-mono whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-[150px] overflow-y-auto border border-border/20">
          {skill.body}
        </pre>
      )}

      {/* Select button */}
      {onSelect && (
        <div className="mt-2 pt-2 border-t border-border/20">
          <Button
            size="sm"
            variant={selected ? 'default' : 'outline'}
            className="w-full text-[10px] h-6"
            onClick={(e) => { e.stopPropagation(); onSelect(skill) }}
          >
            {selected ? 'Selected' : 'Use this skill'}
          </Button>
        </div>
      )}
    </div>
  )
}
