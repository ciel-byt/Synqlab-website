/**
 * TeamGraph — interactive SVG team ↔ member network graph.
 *
 * Extracted from PeoplePage into a reusable component for the Workspace Members tab.
 * Supports pan, zoom (wheel + buttons), node dragging, and zoom-to-fit.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Maximize2, Users, ZoomIn, ZoomOut } from 'lucide-react'

import type { Person, TeamSummary } from '@/features/people/types'
import { hashStr, clamp } from '@/features/people/helpers'
import { entityColorHsl } from '@/lib/entity-colors'

/* ── Graph layout ─────────────────────────────────────────────────────── */

interface TeamNode {
  team: TeamSummary
  x: number
  y: number
  color: string
}
interface MemberNode {
  member: Person
  x: number
  y: number
  teams: TeamSummary[]
  primaryColor: string
}

const GRAPH_W = 1400
const GRAPH_H = 900

function computeGraphLayout(
  teams: TeamSummary[],
  members: Person[],
  memberTeamNames: Record<string, string[]>,
): {
  teamNodes: TeamNode[]
  memberNodes: MemberNode[]
  unassigned: Person[]
} {
  const cx = GRAPH_W / 2
  const cy = GRAPH_H / 2
  const teamByName = new Map<string, TeamSummary>()
  for (const t of teams) teamByName.set(t.name, t)

  const teamNodes: TeamNode[] = []
  const teamPosById = new Map<string, TeamNode>()

  if (teams.length === 1) {
    const node: TeamNode = { team: teams[0], x: cx, y: cy, color: entityColorHsl(teams[0].id) }
    teamNodes.push(node)
    teamPosById.set(teams[0].id, node)
  } else if (teams.length > 1) {
    const sorted = [...teams].sort((a, b) => b.member_count - a.member_count)
    const innerCount = sorted.length > 16 ? Math.floor(sorted.length / 3) : 0
    const outerCount = sorted.length - innerCount
    const Router = clamp(220 + Math.sqrt(outerCount) * 35, 240, 380)
    const Rinner = Router * 0.55

    const outer = sorted.slice(innerCount)
    const inner = sorted.slice(0, innerCount)

    outer.forEach((t, i) => {
      const angle = (i / outer.length) * 2 * Math.PI - Math.PI / 2
      const node: TeamNode = {
        team: t,
        x: cx + Math.cos(angle) * Router,
        y: cy + Math.sin(angle) * Router,
        color: entityColorHsl(t.id),
      }
      teamNodes.push(node)
      teamPosById.set(t.id, node)
    })
    inner.forEach((t, i) => {
      const angle = (i / Math.max(inner.length, 1)) * 2 * Math.PI - Math.PI / 2 + Math.PI / inner.length
      const node: TeamNode = {
        team: t,
        x: cx + Math.cos(angle) * Rinner,
        y: cy + Math.sin(angle) * Rinner,
        color: entityColorHsl(t.id),
      }
      teamNodes.push(node)
      teamPosById.set(t.id, node)
    })
  }

  const memberNodes: MemberNode[] = []
  const unassigned: Person[] = []

  for (const m of members) {
    const teamNames = memberTeamNames[m.id] ?? []
    const ts: TeamSummary[] = []
    for (const n of teamNames) {
      const t = teamByName.get(n)
      if (t) ts.push(t)
    }
    if (ts.length === 0) { unassigned.push(m); continue }
    const positions = ts.map(t => teamPosById.get(t.id)).filter(Boolean) as TeamNode[]
    if (positions.length === 0) { unassigned.push(m); continue }

    const ax = positions.reduce((s, p) => s + p.x, 0) / positions.length
    const ay = positions.reduce((s, p) => s + p.y, 0) / positions.length
    const seed = hashStr(m.id)
    const baseR = positions.length === 1 ? 60 : 22
    const jitterR = baseR + (seed % 40)
    const angle = ((seed >>> 5) % 360) * (Math.PI / 180)

    memberNodes.push({
      member: m,
      x: ax + Math.cos(angle) * jitterR,
      y: ay + Math.sin(angle) * jitterR,
      teams: ts,
      primaryColor: positions[0].color,
    })
  }

  return { teamNodes, memberNodes, unassigned }
}

/* ── Component ────────────────────────────────────────────────────────── */

interface ViewState { tx: number; ty: number; scale: number }
interface NodeDragState {
  kind: 'team' | 'member'; id: string
  startX: number; startY: number
  pointerStartX: number; pointerStartY: number; moved: boolean
}

export interface TeamGraphProps {
  teams: TeamSummary[]
  members: Person[]
  memberTeams: Record<string, string[]>
  searchTerm?: string
  className?: string
  /** If true, auto zoom-to-fit on mount */
  autoFit?: boolean
}

export function TeamGraph({
  teams,
  members,
  memberTeams,
  searchTerm = '',
  className = '',
  autoFit = false,
}: TeamGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewState>({ tx: 0, ty: 0, scale: 1 })
  const dragRef = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null)
  const nodeDragRef = useRef<NodeDragState | null>(null)
  const justDraggedNodeRef = useRef(false)
  const [teamPositionOverrides, setTeamPositionOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const [memberPositionOverrides, setMemberPositionOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null)

  const { teamNodes, memberNodes, unassigned } = useMemo(
    () => computeGraphLayout(teams, members, memberTeams),
    [teams, members, memberTeams],
  )

  const renderedTeamNodes = useMemo(
    () => teamNodes.map(n => ({ ...n, ...(teamPositionOverrides[n.team.id] ?? {}) })),
    [teamNodes, teamPositionOverrides],
  )
  const renderedMemberNodes = useMemo(
    () => memberNodes.map(n => ({ ...n, ...(memberPositionOverrides[n.member.id] ?? {}) })),
    [memberNodes, memberPositionOverrides],
  )

  // Clean stale overrides
  useEffect(() => {
    const allowed = new Set(teams.map(t => t.id))
    setTeamPositionOverrides(prev => {
      const next: Record<string, { x: number; y: number }> = {}
      for (const [k, v] of Object.entries(prev)) { if (allowed.has(k)) next[k] = v }
      return next
    })
  }, [teams])
  useEffect(() => {
    const allowed = new Set(members.map(m => m.id))
    setMemberPositionOverrides(prev => {
      const next: Record<string, { x: number; y: number }> = {}
      for (const [k, v] of Object.entries(prev)) { if (allowed.has(k)) next[k] = v }
      return next
    })
  }, [members])

  // Auto zoom-to-fit
  const zoomToFit = useCallback(() => {
    if (renderedTeamNodes.length === 0 && renderedMemberNodes.length === 0) return
    const allX = [...renderedTeamNodes.map(n => n.x), ...renderedMemberNodes.map(n => n.x)]
    const allY = [...renderedTeamNodes.map(n => n.y), ...renderedMemberNodes.map(n => n.y)]
    if (allX.length === 0) return
    const minX = Math.min(...allX) - 80
    const maxX = Math.max(...allX) + 80
    const minY = Math.min(...allY) - 80
    const maxY = Math.max(...allY) + 80
    const w = maxX - minX || 1
    const h = maxY - minY || 1
    const scale = clamp(Math.min(GRAPH_W / w, GRAPH_H / h) * 0.85, 0.4, 2)
    const tx = (GRAPH_W - w * scale) / 2 - minX * scale
    const ty = (GRAPH_H - h * scale) / 2 - minY * scale
    setView({ tx, ty, scale })
  }, [renderedTeamNodes, renderedMemberNodes])

  useEffect(() => {
    if (autoFit) zoomToFit()
  }, [autoFit, teams.length, members.length]) // re-fit when data changes

  const clientToGraphPoint = useCallback((clientX: number, clientY: number) => {
    if (!wrapRef.current) return null
    const rect = wrapRef.current.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * GRAPH_W
    const vy = ((clientY - rect.top) / rect.height) * GRAPH_H
    return { x: (vx - view.tx) / view.scale, y: (vy - view.ty) / view.scale }
  }, [view.tx, view.ty, view.scale])

  const startNodeDrag = useCallback(
    (e: React.PointerEvent, kind: 'team' | 'member', id: string, x: number, y: number) => {
      e.stopPropagation()
      nodeDragRef.current = { kind, id, startX: x, startY: y, pointerStartX: e.clientX, pointerStartY: e.clientY, moved: false }
      svgRef.current?.setPointerCapture?.(e.pointerId)
    }, [],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-graph-node]')) return
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (nodeDragRef.current) {
      const curr = clientToGraphPoint(e.clientX, e.clientY)
      const start = clientToGraphPoint(nodeDragRef.current.pointerStartX, nodeDragRef.current.pointerStartY)
      if (!curr || !start) return
      const dx = curr.x - start.x, dy = curr.y - start.y
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) nodeDragRef.current.moved = true
      const next = { x: nodeDragRef.current.startX + dx, y: nodeDragRef.current.startY + dy }
      if (nodeDragRef.current.kind === 'team') setTeamPositionOverrides(prev => ({ ...prev, [nodeDragRef.current!.id]: next }))
      else setMemberPositionOverrides(prev => ({ ...prev, [nodeDragRef.current!.id]: next }))
      return
    }
    if (!dragRef.current || !wrapRef.current) return
    const d = dragRef.current
    const rect = wrapRef.current.getBoundingClientRect()
    setView(v => ({ ...v, tx: d.tx0 + (e.clientX - d.sx) * GRAPH_W / rect.width, ty: d.ty0 + (e.clientY - d.sy) * GRAPH_H / rect.height }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (nodeDragRef.current) {
      justDraggedNodeRef.current = nodeDragRef.current.moved
      nodeDragRef.current = null
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      if (justDraggedNodeRef.current) window.setTimeout(() => { justDraggedNodeRef.current = false }, 0)
      return
    }
    dragRef.current = null
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  // Zoom: wheel pivots at cursor
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!wrapRef.current) return
      e.preventDefault()
      const rect = wrapRef.current.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * GRAPH_W
      const my = ((e.clientY - rect.top) / rect.height) * GRAPH_H
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      setView(v => {
        const newScale = clamp(v.scale * factor, 0.4, 3)
        const ratio = newScale / v.scale
        return { scale: newScale, tx: mx - (mx - v.tx) * ratio, ty: my - (my - v.ty) * ratio }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const zoomBy = (factor: number) => {
    setView(v => {
      const newScale = clamp(v.scale * factor, 0.4, 3)
      const ratio = newScale / v.scale
      return { scale: newScale, tx: GRAPH_W / 2 - (GRAPH_W / 2 - v.tx) * ratio, ty: GRAPH_H / 2 - (GRAPH_H / 2 - v.ty) * ratio }
    })
  }

  const lowerSearch = searchTerm.trim().toLowerCase()
  const focusTeamId = hoveredTeamId
  const focusId = hoveredId

  const teamMatches = (t: TeamSummary) => !lowerSearch || t.name.toLowerCase().includes(lowerSearch)
  const memberMatches = (m: Person) => !lowerSearch || m.full_name.toLowerCase().includes(lowerSearch) || m.email.toLowerCase().includes(lowerSearch)

  const edgeCurvePath = useCallback(
    (x1: number, y1: number, x2: number, y2: number, seed: string) => {
      const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy) || 1
      const nx = -dy / dist, ny = dx / dist
      const bendSign = hashStr(seed) % 2 === 0 ? 1 : -1
      const bend = clamp(dist * 0.16, 14, 44) * bendSign
      const c1x = x1 + dx * 0.35 + nx * bend, c1y = y1 + dy * 0.35 + ny * bend
      const c2x = x1 + dx * 0.75 + nx * bend * 0.65, c2y = y1 + dy * 0.75 + ny * bend * 0.65
      return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
    }, [],
  )

  return (
    <div ref={wrapRef} className={`relative overflow-hidden select-none bg-gradient-to-br from-card via-background to-muted/30 rounded-xl border border-border ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <pattern id="ws-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/40" />
          </pattern>
        </defs>
        <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#ws-grid)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {/* edges */}
          {renderedMemberNodes.map(m => {
            const dimMember = lowerSearch && !memberMatches(m.member)
            return m.teams.map(t => {
              const tn = renderedTeamNodes.find(n => n.team.id === t.id)
              if (!tn) return null
              const isFocused = focusId === m.member.id || focusTeamId === t.id
              return (
                <path
                  key={`e-${m.member.id}-${t.id}`}
                  d={edgeCurvePath(m.x, m.y, tn.x, tn.y, `${m.member.id}:${t.id}`)}
                  stroke={tn.color}
                  strokeOpacity={isFocused ? 0.96 : dimMember ? 0.12 : 0.38}
                  strokeWidth={isFocused ? 2.1 : 1.3}
                  strokeLinecap="round"
                  fill="none"
                />
              )
            })
          })}

          {/* member nodes */}
          {renderedMemberNodes.map(m => {
            const isFocused = focusId === m.member.id
            const isTeamFocused = focusTeamId && m.teams.some(t => t.id === focusTeamId)
            const dim = lowerSearch && !memberMatches(m.member)
            const r = isFocused ? 11 : 7
            return (
              <g
                key={`m-${m.member.id}`}
                data-graph-node="member"
                transform={`translate(${m.x} ${m.y})`}
                onPointerDown={(e) => startNodeDrag(e, 'member', m.member.id, m.x, m.y)}
                onMouseEnter={() => setHoveredId(m.member.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: 'grab', opacity: dim ? 0.18 : 1 }}
              >
                <circle r={r} fill={m.primaryColor} stroke="white" strokeWidth={isFocused ? 3 : 2} />
                {isFocused && (
                  <>
                    <circle r={r + 6} fill="none" stroke={m.primaryColor} strokeOpacity={0.4} strokeWidth={2} />
                    <text y={-r - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor" className="text-foreground"
                      style={{ paintOrder: 'stroke', stroke: 'var(--color-card)', strokeWidth: 4 }}>
                      {m.member.full_name}
                    </text>
                  </>
                )}
                {isTeamFocused && !isFocused && (
                  <circle r={r + 3} fill="none" stroke={m.primaryColor} strokeOpacity={0.6} strokeWidth={1.5} />
                )}
              </g>
            )
          })}

          {/* team hubs */}
          {renderedTeamNodes.map(t => {
            const isHover = hoveredTeamId === t.team.id
            const dim = lowerSearch && !teamMatches(t.team)
            const r = clamp(16 + Math.sqrt(t.team.member_count) * 3.2, 18, 38)
            return (
              <g
                key={`t-${t.team.id}`}
                data-graph-node="team"
                transform={`translate(${t.x} ${t.y})`}
                onPointerDown={(e) => startNodeDrag(e, 'team', t.team.id, t.x, t.y)}
                onMouseEnter={() => setHoveredTeamId(t.team.id)}
                onMouseLeave={() => setHoveredTeamId(null)}
                style={{ cursor: 'grab', opacity: dim ? 0.25 : 1 }}
              >
                <circle r={r + 5} fill={t.color} fillOpacity={isHover ? 0.18 : 0.1} />
                <circle r={r} fill={t.color} stroke="white" strokeWidth={3} />
                <text textAnchor="middle" y={4} fontSize={Math.max(11, r * 0.5)} fontWeight={700} fill="white">
                  {t.team.member_count}
                </text>
                <text textAnchor="middle" y={-r - 8} fontSize={13} fontWeight={600} fill="currentColor" className="text-foreground"
                  style={{ paintOrder: 'stroke', stroke: 'var(--color-card)', strokeWidth: 4 }}>
                  {t.team.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Empty state */}
      {renderedTeamNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm">
          <Users size={26} className="mb-2 text-muted-foreground/70" />
          No teams to visualize yet.
        </div>
      )}

      {/* Controls — top right */}
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-xl border border-border bg-card/85 backdrop-blur p-1 shadow-sm">
        <button onClick={() => zoomBy(1.2)} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => zoomBy(0.85)} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button onClick={zoomToFit} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center" title="Zoom to fit">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Legend — bottom left */}
      <div className="absolute left-3 bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/85 backdrop-blur px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
          {renderedTeamNodes.length} teams
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {renderedMemberNodes.length} members
        </span>
        {unassigned.length > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>{unassigned.length} unassigned</span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground/70">Drag · Scroll to zoom</span>
      </div>

      {/* Zoom indicator — bottom right */}
      <div className="absolute right-3 bottom-3 rounded-md border border-border bg-card/85 backdrop-blur px-2 py-1 text-[10px] font-mono text-muted-foreground shadow-sm tabular-nums">
        {Math.round(view.scale * 100)}%
      </div>
    </div>
  )
}
