import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { tagColor } from '@/lib/hashPalette'

/**
 * TagChip — a small mono-styled tag pill whose color is deterministically
 * derived from the tag text.
 *
 * Pass `tone` to override the auto-derived palette with an explicit Tailwind
 * class string (used by category chips that already have an established
 * color).
 */
interface TagChipProps {
  tag: string
  tone?: string
  children?: ReactNode
  className?: string
}

export function TagChip({ tag, tone, children, className }: TagChipProps) {
  return (
    <span
      className={cn(
        'border px-1.5 py-0.5 font-mono text-[10px] font-semibold',
        tone ?? tagColor(tag),
        className,
      )}
    >
      {children ?? tag}
    </span>
  )
}
