/**
 * AgentModeSelector — radio cards for choosing autonomy mode.
 */

import { MousePointerClick, Eye, Zap, type LucideIcon } from 'lucide-react'
import type { AutonomyMode } from '@/features/agent/types'

const MODES: { value: AutonomyMode; icon: LucideIcon; label: string; desc: string }[] = [
  { value: 'copilot', icon: MousePointerClick, label: 'Copilot', desc: 'Approve each tool call' },
  { value: 'supervised', icon: Eye, label: 'Supervised', desc: 'Review at checkpoints' },
  { value: 'autonomous', icon: Zap, label: 'Autonomous', desc: 'Full auto, final report' },
]

interface AgentModeSelectorProps {
  value: AutonomyMode
  onChange: (mode: AutonomyMode) => void
}

export function AgentModeSelector({ value, onChange }: AgentModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((m) => {
        const Icon = m.icon
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`
              flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-center
              transition-all duration-150 border-2
              ${m.value === value
                ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/40'
              }
            `}
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-semibold">{m.label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{m.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Icon components for displaying mode in session list badges. */
export const MODE_ICONS: Record<AutonomyMode, LucideIcon> = {
  copilot: MousePointerClick,
  supervised: Eye,
  autonomous: Zap,
}
