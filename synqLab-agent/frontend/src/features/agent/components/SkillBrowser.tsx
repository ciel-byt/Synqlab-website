/**
 * SkillBrowser — searchable grid for browsing and selecting agent skills.
 */

import { useState, useEffect } from 'react'
import { Search, Sparkles, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { api } from '@/api/client'
import type { AgentSkill } from '@/features/agent/types'
import { SkillCard } from '@/features/agent/components/SkillCard'

interface SkillBrowserProps {
  selectedSkillId?: string | null
  onSelect?: (skill: AgentSkill | null) => void
  agentType?: string
}

export function SkillBrowser({ selectedSkillId, onSelect, agentType }: SkillBrowserProps) {
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await api.listSkills(search || undefined, agentType || undefined)
        if (!cancelled) setSkills(data)
      } catch (err) {
        console.error('Failed to load skills:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [search, agentType])

  const handleSelect = (skill: AgentSkill) => {
    if (selectedSkillId === skill.id) {
      // Deselect.
      onSelect?.(null)
    } else {
      onSelect?.(skill)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-semibold">Attach a Skill</h4>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {skills.length} available
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="h-8 pl-8 text-xs bg-muted/30 border-border/40"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-xs">Loading skills...</span>
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Sparkles className="h-8 w-8 opacity-20 mb-2" />
          <span className="text-xs">No skills found</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {skills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              selected={selectedSkillId === skill.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Skip option */}
      {selectedSkillId && (
        <button
          type="button"
          onClick={() => onSelect?.(null)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Clear skill selection
        </button>
      )}
    </div>
  )
}
