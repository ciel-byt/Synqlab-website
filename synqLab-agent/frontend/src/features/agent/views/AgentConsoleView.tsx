/**
 * AgentConsoleView — ChatGPT-style unified console.
 *
 * When no session is active: centered greeting, agent-type pills,
 * starter-prompt grid, and a bottom input bar with minimal + menu.
 *
 * When a session is active: renders AgentChat.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bot, Sparkles, Send, Plus,
  Zap, Loader2, ExternalLink, Paperclip, X, Puzzle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { AutonomyMode, AgentSkill, AgentSession } from '@/features/agent/types'
import { AgentChat } from '@/features/agent/components/AgentChat'
import { MockGfp11Chat } from '@/features/agent/components/MockGfp11Chat'
import { PipelineCanvasPanel } from '@/features/agent/components/PipelineCanvasPanel'
import { usePipelineWorkshopOptional } from '@/features/agent/contexts/PipelineWorkshopContext'
import { getStarterPrompts } from '@/features/agent/starterPrompts'
import { useToolsAndHealth } from '@/features/tools/hooks/useToolsAndHealth'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import type { AgentsConsoleOutletContext } from '@/pages/AgentsConsoleLayout'

/* ── Mode config ──────────────────────────────────────────────── */

const MODES: { value: AutonomyMode; label: string; desc: string }[] = [
  { value: 'autonomous', label: 'Autopilot',   desc: 'Agent acts independently' },
  { value: 'supervised', label: 'Supervised',  desc: 'Approves tool calls' },
  { value: 'copilot',    label: 'Copilot',     desc: 'Suggests, you decide' },
]

export function AgentConsoleView() {
  const ctx = useOutletContext<AgentsConsoleOutletContext>()
  const { activeSessionId, loading } = ctx
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [input, setInput] = useState('')
  const selectedAgentType = 'general'
  const [selectedMode, setSelectedMode] = useState<AutonomyMode>('autonomous')
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | undefined>(undefined)

  // Skills
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [skillsLoaded, setSkillsLoaded] = useState(false)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')

  // Pipeline workshop
  const workshop = usePipelineWorkshopOptional()
  const { tools, health } = useToolsAndHealth({ enabled: !!workshop?.enabled })

  // Resizable split
  const [splitPercent, setSplitPercent] = useState(50)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPercent(Math.min(75, Math.max(25, pct)))
    }
    const onUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Load skills when popover opens
  useEffect(() => {
    if (popoverOpen && !skillsLoaded) {
      setSkillsLoading(true)
      api.listSkills(undefined, selectedAgentType || undefined)
        .then(data => { setSkills(data); setSkillsLoaded(true) })
        .catch(() => {})
        .finally(() => setSkillsLoading(false))
    }
  }, [popoverOpen, skillsLoaded, selectedAgentType])

  // Auto-attach skill from ?skill= query parameter (e.g. from Skills page "+" button)
  useEffect(() => {
    const skillName = searchParams.get('skill')
    if (!skillName) return
    // Clear param from URL so it doesn't re-trigger
    searchParams.delete('skill')
    setSearchParams(searchParams, { replace: true })
    // Fetch skills and match by name
    api.listSkills(undefined, selectedAgentType || undefined)
      .then(data => {
        setSkills(data)
        setSkillsLoaded(true)
        const match = data.find(sk => sk.name.toLowerCase() === skillName.toLowerCase())
        if (match) setSelectedSkill(match)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSkills = skills.filter(sk =>
    !skillSearch || sk.name.toLowerCase().includes(skillSearch.toLowerCase())
  )

  const isPipelineMode = !!workshop?.enabled
  const prompts = getStarterPrompts(selectedAgentType, isPipelineMode)
  const currentMode = MODES.find(m => m.value === selectedMode) ?? MODES[0]

  const getNextSessionTitle = useCallback(() => {
    const nums = (ctx.sessions || [])
      .map(s => s.title ?? '')
      .map(t => {
        const m = /^Session\s+(\d+)$/i.exec(t.trim())
        return m ? Number(m[1]) : 0
      })
      .filter(n => Number.isFinite(n) && n > 0)
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    return `Session ${next}`
  }, [ctx.sessions])

  const createAndSend = async (initialMessage?: string) => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const session = await api.createAgentSession({
        agent_type: selectedAgentType,
        title: getNextSessionTitle(),
        autonomy_mode: selectedMode,
        ...(selectedSkill && { skill_id: selectedSkill.id }),
      })
      if (initialMessage) setPendingMessage(initialMessage)
      ctx.registerCreatedSession(session)
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const createMockSession = useCallback(() => {
    // Local-only demo session so sidebar/session count stays consistent
    const now = new Date().toISOString()
    const id = `mock-gfp11-${Date.now()}`
    const session: AgentSession = {
      id,
      agent_type: selectedAgentType,
      title: getNextSessionTitle(),
      status: 'active',
      autonomy_mode: selectedMode,
      model: 'demo-mock',
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tool_calls: 0,
      canvas_state: null,
      created_at: now,
      updated_at: now,
    }
    setPendingMessage(undefined)
    ctx.registerCreatedSession(session)
  }, [ctx, selectedAgentType, selectedMode, getNextSessionTitle])

  const handleQuickSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    createAndSend(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuickSend()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Loading agent console…</span>
        </div>
      </div>
    )
  }

  const isMockSessionActive = !!activeSessionId && activeSessionId.startsWith('mock-gfp11-')

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-background">
      <div className="flex-1 min-h-0 flex" ref={splitContainerRef}>
        {/* Left column: chat or welcome screen */}
        <div
          className="min-h-0 flex flex-col flex-shrink-0"
          style={{ width: workshop?.enabled ? `${splitPercent}%` : '100%' }}
        >
          {isMockSessionActive ? (
            <MockGfp11Chat sessionId={activeSessionId!} />
          ) : activeSessionId ? (
            <AgentChat
              sessionId={activeSessionId}
              initialMessage={pendingMessage}
              onTitleChange={(title) => ctx.updateSessionTitle(activeSessionId, title)}
            />
          ) : (
          <div className="flex flex-col h-full">
            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 pt-[10vh] pb-8">
                {/* Hero */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 mb-4 relative">
                    {isPipelineMode ? (
                      <Puzzle className="h-7 w-7 text-primary/60" />
                    ) : (
                      <Bot className="h-7 w-7 text-primary/60" />
                    )}
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-2.5 w-2.5 text-primary/80" />
                    </div>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight mb-1.5">
                    {isPipelineMode ? 'Build a Pipeline' : 'What can I help with?'}
                  </h1>
                  <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                    {isPipelineMode
                      ? 'Describe what you want to automate — the agent will assemble a node graph for you.'
                      : 'Fold proteins, generate sequences, search literature, or ask anything.'}
                  </p>
                </div>

                {/* Pipeline walkthrough — compact steps */}
                {isPipelineMode && (
                  <div className="max-w-sm mx-auto mb-8">
                    <div className="flex items-start gap-3">
                      {[
                        { step: '1', text: 'Describe your workflow' },
                        { step: '2', text: 'Agent builds the graph' },
                        { step: '3', text: 'Review, tweak & run' },
                      ].map((s, i) => (
                        <div key={s.step} className="flex-1 flex flex-col items-center text-center">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary mb-1.5">
                              {s.step}
                            </div>
                            {i < 2 && (
                              <div className="absolute top-4 left-full w-full h-px bg-gradient-to-r from-primary/30 to-primary/5" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground/70 leading-tight">{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Starter prompt chips */}
                <div className="flex flex-wrap justify-center gap-2">
                  {prompts.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={isCreating && !p.demoRoute}
                      onClick={() => p.demoRoute ? createMockSession() : createAndSend(p.message)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/30 hover:bg-muted/50 hover:border-border/60 transition-all duration-150 px-3.5 py-2 text-[13px] text-muted-foreground/80 hover:text-foreground disabled:opacity-50"
                    >
                      {p.requires && p.requires.length > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60 flex-shrink-0" />
                      )}
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bottom input bar ─────────────────────────────── */}
            <div className="flex-shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-sm px-4 py-3">
              <div className="max-w-3xl mx-auto">
                <div className="relative flex items-end gap-1.5 rounded-2xl border border-black/70 dark:border-white/75 bg-background/95 focus-within:border-black/70 dark:focus-within:border-white/75 focus-within:ring-1 focus-within:ring-black/15 dark:focus-within:ring-white/15 transition-all pl-2 pr-2 py-1.5">
                  {/* + Attach popover */}
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                          (selectedSkill || popoverOpen)
                            ? 'text-primary bg-primary/10 hover:bg-primary/15'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                        title="Attach skill & set mode"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" side="top" sideOffset={12} className="w-[320px] p-0 overflow-hidden">
                      {/* ── Mode selector ── */}
                      <div className="px-3 pt-2.5 pb-0 border-b border-border/30">
                        <div className="flex items-center gap-0">
                          {MODES.map(m => (
                            <button
                              key={m.value}
                              onClick={() => setSelectedMode(m.value)}
                              className={cn(
                                'flex-1 pb-2 text-center transition-all text-xs font-medium border-b-2',
                                selectedMode === m.value
                                  ? 'text-foreground border-foreground'
                                  : 'text-muted-foreground/50 border-transparent hover:text-muted-foreground hover:border-border/60'
                              )}
                              title={m.desc}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Skills ── */}
                      <div className="px-3 pt-2.5 pb-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Attach Skill</span>
                          {selectedSkill && (
                            <button
                              onClick={() => setSelectedSkill(null)}
                              className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          value={skillSearch}
                          onChange={(e) => setSkillSearch(e.target.value)}
                          placeholder="Search skills…"
                          className="w-full h-7 rounded-md border border-border/50 bg-muted/10 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40 mb-1.5"
                        />
                      </div>
                      <div className="px-3 pb-2 max-h-[200px] overflow-y-auto space-y-0.5">
                        {skillsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
                          </div>
                        ) : filteredSkills.length === 0 ? (
                          <div className="text-center py-3 text-xs text-muted-foreground/50">
                            No skills found
                          </div>
                        ) : (
                          filteredSkills.map(sk => (
                            <button
                              key={sk.id}
                              onClick={() => { setSelectedSkill(sk); setPopoverOpen(false); setSkillSearch('') }}
                              className={cn(
                                'w-full text-left px-2.5 py-2.5 rounded-lg transition-all group',
                                selectedSkill?.id === sk.id
                                  ? 'bg-primary/15 border border-primary/30'
                                  : 'hover:bg-muted/30 border border-transparent'
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <Sparkles className={cn(
                                  'h-3.5 w-3.5 flex-shrink-0',
                                  selectedSkill?.id === sk.id ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground/70'
                                )} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-foreground/90 truncate">{sk.name}</div>
                                  <div className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{sk.description}</div>
                                </div>
                                <Badge
                                  variant={sk.source === 'core' ? 'secondary' : 'outline'}
                                  className="text-[8px] px-1.5 py-0 flex-shrink-0"
                                >
                                  {sk.source === 'core' ? 'CORE' : 'CUSTOM'}
                                </Badge>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-3 py-2 border-t border-border/30 flex items-center justify-between">
                        <button
                          onClick={() => { setPopoverOpen(false); navigate('/lab/agents/skills') }}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Browse library
                        </button>
                        <button
                          onClick={() => { setPopoverOpen(false); navigate('/lab/skills') }}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Create new
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Input */}
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message SynqLab…"
                    rows={1}
                    disabled={isCreating}
                    className="flex-1 min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 py-1.5 px-1 text-sm placeholder:text-muted-foreground/40"
                  />

                  {/* Send */}
                  <Button
                    size="icon"
                    onClick={handleQuickSend}
                    disabled={!input.trim() || isCreating}
                    className="flex-shrink-0 h-8 w-8 rounded-lg"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Status bar below input */}
                <div className="flex items-center justify-center gap-2 mt-2 min-h-[18px]">
                  {/* Mode pill */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/50 border border-border/50 rounded-full px-2 py-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    {currentMode.label}
                  </span>

                  {/* Pipeline mode toggle */}
                  {workshop && (
                    <>
                      <span className="text-muted-foreground/20">·</span>
                      <button
                        onClick={() => workshop.setEnabled(!workshop.enabled)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-300',
                          workshop.enabled
                            ? 'bg-primary/20 border border-primary/30 text-primary shadow-[0_0_8px_rgba(var(--primary-rgb,99,102,241),0.3)]'
                            : 'bg-foreground text-background border border-foreground/80 hover:bg-foreground/85',
                        )}
                      >
                        <Puzzle className={cn('h-3 w-3', !workshop.enabled && 'animate-pulse')} />
                        Pipeline
                      </button>
                    </>
                  )}

                  {/* Attached skill */}
                  {selectedSkill && (
                    <>
                      <span className="text-muted-foreground/20">·</span>
                      <button
                        onClick={() => setSelectedSkill(null)}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2.5 py-0.5 text-[10px] text-primary hover:bg-primary/20 transition-colors group font-medium"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span className="max-w-[120px] truncate font-medium">{selectedSkill.name}</span>
                        <X className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Resizable divider */}
        {workshop?.enabled && tools.length > 0 && (
          <div
            onMouseDown={startResize}
            className="w-1.5 flex-shrink-0 cursor-col-resize group relative hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-primary/50 transition-colors" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
          </div>
        )}

        {/* Right column: pipeline canvas (when enabled) */}
        {workshop?.enabled && tools.length > 0 && (
          <div className="min-h-0 flex-1">
            <PipelineCanvasPanel tools={tools} health={health} sessionId={activeSessionId ?? undefined} />
          </div>
        )}
      </div>
    </div>
  )
}
