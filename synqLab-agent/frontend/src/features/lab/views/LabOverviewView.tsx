/**
 * LabOverviewView — landing page for /lab.
 *
 * Uses shared EntityCard (vertical) — same grid pattern as Workspace org cards.
 * Quick actions bar mirrors Workspace stats bar.
 */
import {
  Zap,
  GitBranch,
  Workflow,
  HardDrive,
} from 'lucide-react'
import { EntityCard, CARD_GRID_CLASS } from '@/components/ui/entity-card'

/* ── Tiny SVG visuals for each card's visual area ─────────────────────────── */

function ToolsVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect x="4" y="6" width="22" height="22" rx="4" fill="currentColor" opacity="0.12" />
      <rect x="30" y="6" width="22" height="22" rx="4" fill="currentColor" opacity="0.18" />
      <rect x="56" y="6" width="22" height="22" rx="4" fill="currentColor" opacity="0.08" />
      <rect x="4" y="32" width="22" height="22" rx="4" fill="currentColor" opacity="0.08" />
      <rect x="30" y="32" width="22" height="22" rx="4" fill="currentColor" opacity="0.14" />
      <rect x="56" y="32" width="22" height="22" rx="4" fill="currentColor" opacity="0.1" />
      <circle cx="15" cy="17" r="3" fill="hsl(150, 60%, 50%)" opacity="0.6" />
      <circle cx="41" cy="17" r="3" fill="hsl(150, 60%, 50%)" opacity="0.6" />
      <circle cx="67" cy="43" r="3" fill="hsl(40, 80%, 55%)" opacity="0.6" />
    </svg>
  )
}

function PipelinesVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <line x1="18" y1="18" x2="40" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <line x1="40" y1="30" x2="62" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <line x1="40" y1="30" x2="62" y2="42" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <circle cx="18" cy="18" r="6" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="30" r="7" fill="hsl(200, 80%, 55%)" opacity="0.25" />
      <circle cx="62" cy="18" r="5" fill="currentColor" opacity="0.12" />
      <circle cx="62" cy="42" r="5" fill="currentColor" opacity="0.12" />
      <circle cx="40" cy="30" r="3" fill="hsl(200, 80%, 55%)" opacity="0.5" />
    </svg>
  )
}

function AgentsVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <line x1="40" y1="10" x2="20" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="40" y1="10" x2="60" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="20" y1="30" x2="40" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="60" y1="30" x2="40" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="20" y1="30" x2="60" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <circle cx="40" cy="10" r="4" fill="hsl(270, 70%, 60%)" opacity="0.3" />
      <circle cx="20" cy="30" r="3.5" fill="currentColor" opacity="0.12" />
      <circle cx="60" cy="30" r="3.5" fill="currentColor" opacity="0.12" />
      <circle cx="40" cy="50" r="4" fill="currentColor" opacity="0.12" />
      <circle cx="40" cy="30" r="5" fill="hsl(270, 70%, 60%)" opacity="0.15" />
      <circle cx="40" cy="30" r="2.5" fill="hsl(270, 70%, 60%)" opacity="0.4" />
    </svg>
  )
}



function StorageVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Stacked drive layers */}
      <rect x="12" y="8" width="56" height="14" rx="3" fill="currentColor" opacity="0.08" />
      <rect x="12" y="24" width="56" height="14" rx="3" fill="currentColor" opacity="0.12" />
      <rect x="12" y="40" width="56" height="14" rx="3" fill="currentColor" opacity="0.16" />
      {/* Activity dots */}
      <circle cx="58" cy="15" r="2.5" fill="hsl(150, 60%, 50%)" opacity="0.6" />
      <circle cx="58" cy="31" r="2.5" fill="hsl(150, 60%, 50%)" opacity="0.4" />
      <circle cx="58" cy="47" r="2.5" fill="hsl(200, 80%, 55%)" opacity="0.5" />
    </svg>
  )
}

/* ── Section config ───────────────────────────────────────────────────────── */

const sections = [
  { label: 'Agents', desc: 'Agent configs', href: '/lab/agents', icon: Workflow, visual: <AgentsVisual /> },
  { label: 'Pipelines', desc: 'Workflow templates', href: '/lab/pipelines', icon: GitBranch, visual: <PipelinesVisual /> },
  { label: 'Computers', desc: 'Registered computers', href: '/lab/computers', icon: Zap, visual: <ToolsVisual /> },
  { label: 'Storage', desc: 'Artifacts & datasets', href: '/lab/agents/datasets', icon: HardDrive, visual: <StorageVisual /> },
]

import { PageHeader } from '@/components/ui/page-header'

export function LabOverviewView() {
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto flex flex-col h-full overflow-y-auto w-full">
      <PageHeader
        title="Lab"
        description="Design, run, and analyze computational molecular experiments."
        size="large"
      />

      {/* Section cards — same grid as Workspace org cards */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sections</h2>
        <div className={CARD_GRID_CLASS}>
          {sections.map((s) => (
            <EntityCard
              key={s.label}
              title={s.label}
              subtitle={s.desc}
              href={s.href}
              icon={{ letter: s.label.charAt(0), color: 'hsl(var(--muted))' }}
              visual={
                <div className="w-full h-full text-foreground">
                  {s.visual}
                </div>
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
