import { cn } from '@/lib/utils'

/**
 * LiveIndicator — a small live "online / running" dot that pulses with a
 * Tailwind `animate-ping` halo. Used in the landing page status badges and
 * anywhere we want to convey "this is currently active".
 *
 * Props:
 *   tone     — emerald (default) | indigo | sky | rose
 *   size     — 'sm' (1.5) | 'md' (2) | 'lg' (2.5) Tailwind units
 *   ping     — disable the animated halo (still shows the steady dot)
 */
export type LiveTone = 'emerald' | 'teal' | 'sky' | 'rose'
export type LiveSize = 'sm' | 'md' | 'lg'

const TONE: Record<LiveTone, { dot: string; halo: string }> = {
  emerald: { dot: 'bg-emerald-500', halo: 'bg-emerald-400' },
  teal:    { dot: 'bg-teal-500',    halo: 'bg-teal-400' },
  sky:     { dot: 'bg-sky-500',     halo: 'bg-sky-400' },
  rose:    { dot: 'bg-rose-500',    halo: 'bg-rose-400' },
}

const SIZE: Record<LiveSize, string> = {
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
}

interface LiveIndicatorProps {
  tone?: LiveTone
  size?: LiveSize
  ping?: boolean
  className?: string
}

export function LiveIndicator({
  tone = 'emerald',
  size = 'sm',
  ping = true,
  className,
}: LiveIndicatorProps) {
  const palette = TONE[tone]
  return (
    <span className={cn('relative flex', SIZE[size], className)}>
      {ping && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
            palette.halo,
          )}
        />
      )}
      <span className={cn('relative inline-flex rounded-full', SIZE[size], palette.dot)} />
    </span>
  )
}
