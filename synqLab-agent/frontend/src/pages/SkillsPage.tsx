/**
 * SkillsPage — Browse, search, and manage agent skills.
 *
 * Uses platform shadcn components: Card, Badge, Input, Button,
 * ScrollArea, Separator, Dialog, PageHeader.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Zap, Tag, Plus, X, Trash2,
  BookOpen, Shield, Loader2, Code2, Users,
} from 'lucide-react'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'
import { LoadingState } from '@/components/blocks/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import type { AgentSkill } from '@/features/agent/types'

import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { AgentsNav } from '@/features/agent/components/AgentsNav'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar'

/* ── Component ────────────────────────────────────────────────── */

export function SkillsPage() {
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selected, setSelected] = useState<AgentSkill | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newTools, setNewTools] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadSkills() }, [])

  const loadSkills = async () => {
    setLoading(true)
    try { setSkills(await api.listSkills()) } catch { /* ignore */ }
    setLoading(false)
  }

  // Derive unique tags
  const allTags = useMemo(() => {
    const s = new Set<string>()
    skills.forEach(sk => sk.tags.forEach(t => s.add(t)))
    return Array.from(s).sort()
  }, [skills])

  // Filter
  const filtered = useMemo(() => {
    return skills.filter(sk => {
      if (search && !sk.name.toLowerCase().includes(search.toLowerCase())
        && !sk.description.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedTag && !sk.tags.includes(selectedTag)) return false
      return true
    })
  }, [skills, search, selectedTag])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.createSkill({
        name: newName.trim(),
        description: newDesc.trim(),
        body: newBody.trim(),
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        tools: newTools.split(',').map(t => t.trim()).filter(Boolean),
        agent_types: ['general'],
        autonomy_default: 'autonomous',
      })
      setShowCreate(false)
      setNewName(''); setNewDesc(''); setNewBody(''); setNewTags(''); setNewTools('')
      loadSkills()
    } catch { /* ignore */ }
    setCreating(false)
  }

  const sidebar = (
    <PageSidebar title="Agents">
      <AgentsNav active="skills" />
      <SidebarGroup className="flex-1 min-h-0 flex flex-col pt-2">
        <SidebarGroupLabel className="text-[10px]">Skills ({filtered.length})</SidebarGroupLabel>
        <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
          {/* Search + tag filter */}
          <div className="px-1 pb-2">
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {allTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={selectedTag ? 'default' : 'outline'} size="sm" className="h-8 px-2 gap-1 text-[10px] flex-shrink-0">
                      <Tag className="h-3 w-3" />
                      {selectedTag || 'Tag'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    {selectedTag && (
                      <DropdownMenuItem className="text-xs" onSelect={() => setSelectedTag(null)}>
                        <X className="h-3 w-3 mr-1.5" /> Clear
                      </DropdownMenuItem>
                    )}
                    {allTags.map(t => (
                      <DropdownMenuItem
                        key={t}
                        className={cn('text-xs', selectedTag === t && 'font-semibold')}
                        onSelect={() => setSelectedTag(selectedTag === t ? null : t)}
                      >
                        {t}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Skills list */}
          {loading ? (
            <LoadingState label="" className="py-12" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <BookOpen className="h-6 w-6 text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground">No skills match your search</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(sk => (
                <SidebarListItem
                  key={sk.id}
                  active={selected?.id === sk.id}
                  title={sk.name}
                  subtitle={sk.description || 'No description'}
                  onClick={() => setSelected(sk)}
                  hoverActions={
                    <>
                      <a
                        href={`/lab/agents/console?skill=${encodeURIComponent(sk.name)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
                        title="Use in Agent Console"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          api.deleteSkill(sk.id)
                            .then(() => {
                              setSkills(prev => prev.filter(s => s.id !== sk.id))
                              if (selected?.id === sk.id) setSelected(null)
                            })
                            .catch(() => {})
                        }}
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-status-red hover:bg-status-red/10 transition-all"
                        title="Delete skill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  }
                  hoverActionsAlign="stretch"
                />
              ))}
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </PageSidebar>
  )

  return (
    <ModularPageLayout sidebar={sidebar}>
      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <SkillDetail
            skill={selected}
            onTagClick={setSelectedTag}
            onDelete={() => {
              api.deleteSkill(selected.id)
                .then(() => {
                  setSkills(prev => prev.filter(s => s.id !== selected.id))
                  setSelected(null)
                })
                .catch(() => {})
            }}
          />
        ) : showCreate ? (
          <div className="p-6 max-w-lg">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Create Custom Skill</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Define a reusable skill for your agents. It will be injected as a system prompt extension.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="skill-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="skill-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. GFP11 Optimization Expert"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-desc">Description</Label>
                <Input
                  id="skill-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What does this skill do?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-body">Instructions</Label>
                <textarea
                  id="skill-body"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="You are an expert in protein engineering..."
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="skill-tags">Tags <span className="text-[10px] text-muted-foreground">(comma-separated)</span></Label>
                  <Input
                    id="skill-tags"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="protein-engineering, optimization"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="skill-tools">Required Computers <span className="text-[10px] text-muted-foreground">(comma-separated)</span></Label>
                  <Input
                    id="skill-tools"
                    value={newTools}
                    onChange={(e) => setNewTools(e.target.value)}
                    placeholder="score_brightness, propose_variants"
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-1.5">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? 'Creating…' : 'Save Skill'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm mb-4">Select a skill to view details</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Custom Skill
            </Button>
          </div>
        )}
      </div>
    </ModularPageLayout>
  )
}

/* ── Skill Detail Panel ───────────────────────────────────────── */

function SkillDetail({
  skill,
  onTagClick,
  onDelete,
}: {
  skill: AgentSkill
  onTagClick: (tag: string) => void
  onDelete?: () => void
}) {
  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <PageHeader
          title={skill.name}
          description={
            <span className="flex items-center gap-2">
              <Badge variant={skill.source === 'core' ? 'default' : 'warning'}>
                {skill.source === 'core' ? 'CORE' : 'CUSTOM'}
              </Badge>
              <span>v{skill.version}</span>
              {skill.author && <span>· by {skill.author}</span>}
            </span>
          }
        />
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        )}
      </div>

      {/* Description */}
      <Card className="mb-4">
        <CardHeader>
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {skill.description || 'No description provided.'}
          </p>
        </CardContent>
      </Card>

      {/* Tags & Agents */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {skill.tags.length > 0 && (
          <Card>
            <CardHeader>
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {skill.tags.map(t => (
                  <Badge
                    key={t}
                    variant="info"
                    className="cursor-pointer"
                    onClick={() => onTagClick(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle>Compatible Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {skill.agent_types.map(t => (
                <Badge key={t} variant="info">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tools & Autonomy */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {skill.tools.length > 0 && (
          <Card>
            <CardHeader>
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <CardTitle>Required Computers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {skill.tools.map(t => (
                  <div key={t} className="flex items-center gap-2 px-2.5 py-1 rounded bg-muted/30 border border-border/50">
                    <Zap className="h-3 w-3 text-status-warn" />
                    <span className="text-xs font-mono">{t}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle>Default Autonomy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-muted/30 border border-border/50">
              <div className={cn(
                'h-2 w-2 rounded-full',
                skill.autonomy_default === 'autonomous' ? 'bg-status-ok' :
                  skill.autonomy_default === 'supervised' ? 'bg-status-warn' : 'bg-status-info'
              )} />
              <span className="text-xs font-medium capitalize">{skill.autonomy_default}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      {skill.body && (
        <Card>
          <CardHeader>
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-foreground/70 bg-muted/20 border border-border/30 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto font-mono leading-relaxed">
              {skill.body}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
