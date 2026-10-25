/**
 * ToolsGridView — Category-grouped tool hub with visual hierarchy.
 *
 * Tools are organized into category swimlanes with accent-colored headers.
 * Each card shows: name, description, I/O flow, health pulse, time, links.
 * Category filter chips + search bar for quick filtering.
 * Ready tools float to the top within each group.
 */
import { useMemo, useState } from 'react'
import { Loader2, Search, Clock, ArrowRight, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EntityCard } from '@/components/ui/entity-card'
import { useToolsContext } from '@/pages/ToolsPage'
import { catAccent, CatIcon, COMPUTE_LABEL, LINK_LABELS, sortByAvailability } from '../helpers'

/* ── I/O flow preview ────────────────────────────────────────────── */

function IOFlow({ inputs, outputs }: { inputs: number; outputs: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/70">
      <span>{inputs} in</span>
      <ArrowRight size={8} className="text-muted-foreground/40" />
      <span>{outputs} out</span>
    </span>
  )
}

export function ToolsGridView() {
  const data = useToolsContext()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const q = search.toLowerCase()

  // All unique categories
  const allCategories = useMemo(() => {
    const cats = new Map<string, { id: string; label: string; count: number }>()
    for (const t of data.tools) {
      const existing = cats.get(t.category)
      if (existing) {
        existing.count++
      } else {
        cats.set(t.category, { id: t.category, label: t.category_label, count: 1 })
      }
    }
    return [...cats.values()]
  }, [data.tools])

  // Filter by search + category
  const filtered = useMemo(() => {
    return data.tools.filter(t => {
      if (activeCategory && t.category !== activeCategory) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.category_label.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [data.tools, q, activeCategory])

  // Group by category, ready tools first
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>()
    for (const t of filtered) {
      const group = groups.get(t.category) || []
      group.push(t)
      groups.set(t.category, group)
    }
    // Sort within each group: ready tools first
    for (const [key, tools] of groups) {
      groups.set(key, sortByAvailability(tools, data.health))
    }
    return [...groups.entries()].map(([catId, tools]) => ({
      catId,
      catLabel: tools[0]?.category_label ?? catId,
      tools,
    }))
  }, [filtered, data.health])

  const { healthLoading, readyCount: healthReady } = data

  return (
    <div className="p-6 md:p-8 lg:p-10 overflow-y-auto flex-1">
      <div className="max-w-5xl mx-auto w-full">

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tools by name, category, or description…"
              className="pl-9 h-10 text-sm bg-background border-border/60 rounded-lg"
            />
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
              !activeCategory
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
            }`}
          >
            All
            <span className="text-[10px] opacity-60">{data.tools.length}</span>
          </button>
          {allCategories.map(cat => {
            const accent = catAccent(cat.id)
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(isActive ? null : cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  isActive
                    ? `${accent.chip} border-current`
                    : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
                }`}
              >
                <CatIcon cat={cat.id} size={10} />
                {cat.label}
                <span className="text-[10px] opacity-60">{cat.count}</span>
              </button>
            )
          })}

          {/* Active filter clear */}
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={10} /> Clear
            </button>
          )}

          {/* Stats */}
          <span className="ml-auto text-[10px] text-muted-foreground/50">
            {filtered.length} tools · {healthLoading ? 'checking health…' : `${healthReady} ready`}
          </span>
        </div>

        {/* Loading */}
        {data.loading && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 size={14} className="animate-spin text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/50">Loading tools…</span>
          </div>
        )}

        {/* Empty */}
        {!data.loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
            <Search size={18} className="text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/50">
              {search || activeCategory ? 'No tools match your filters.' : 'No tools available.'}
            </p>
          </div>
        )}

        {/* Category sections */}
        {!data.loading && grouped.map(({ catId, catLabel, tools }) => {
          const accent = catAccent(catId)
          return (
            <div key={catId} className="mb-8">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`flex items-center justify-center h-6 w-6 rounded-md ${accent.iconBg}`}>
                  <CatIcon cat={catId} size={12} />
                </div>
                <h2 className="text-xs font-semibold text-foreground tracking-wide">{catLabel}</h2>
                <span className="text-[10px] text-muted-foreground/40">{tools.length} tools</span>
                <div className={`flex-1 h-px bg-gradient-to-r ${accent.bar} opacity-20 ml-2`} />
              </div>

              {/* Tool cards — 4 col */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tools.map(tool => {
                  const h = data.health[tool.id]
                  const compute = (tool.resource_profile?.gpu && tool.resource_profile.gpu !== 'none') ? 'gpu' : 'cpu'
                  const time = tool.resource_profile?.estimated_time_per_call
                  const links = tool.links ?? {}
                  const linkEntries = Object.entries(links).filter(([, url]) => url)
                  const nIn = tool.inputs?.length ?? 0
                  const nOut = tool.outputs?.length ?? 0

                  return (
                    <EntityCard
                      key={tool.id}
                      layout="compact"
                      title={tool.name}
                      description={tool.description}
                      href={`/lab/computers/${tool.id}`}
                      status={{
                        color: healthLoading ? 'muted' : h?.available ? 'green' : 'amber',
                        label: healthLoading ? 'Checking…' : h?.available ? 'Ready' : 'Setup needed',
                      }}
                      badges={[
                        { icon: ({ size: _size }: { size?: number }) => <IOFlow inputs={nIn} outputs={nOut} />, count: '', title: 'I/O' },
                      ]}
                      className="hover:shadow-lg hover:-translate-y-0.5 p-1"
                      footer={
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-medium text-muted-foreground/50 px-1.5 py-0.5 rounded bg-muted/50">
                              {COMPUTE_LABEL[compute] ?? compute.toUpperCase()}
                            </span>
                            {tool.phase && tool.phase !== 'v1' && (
                              <span className="text-[9px] font-mono font-semibold text-muted-foreground/50 px-1 py-0.5 rounded bg-muted/30">
                                {tool.phase.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {time && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                <Clock size={9} />
                                {time}
                              </span>
                            )}
                            {linkEntries.slice(0, 3).map(([key, url]) => (
                              <a
                                key={key}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[10px] font-medium text-primary/70 hover:text-primary hover:underline transition-colors"
                              >
                                {LINK_LABELS[key] ?? key}
                              </a>
                            ))}
                          </div>
                        </div>
                      }
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
