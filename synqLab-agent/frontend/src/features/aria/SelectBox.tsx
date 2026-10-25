import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Native select with the arrow inset from the border (the browser default sits on the edge). */
export function SelectBox({ className, children, compact, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <select
        {...props}
        className={cn('w-full appearance-none rounded-full border border-input bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50', compact ? 'h-6 pl-2 pr-6 text-[11px]' : 'h-8 pl-3 pr-8 text-xs')}
      >
        {children}
      </select>
      <ChevronDown className={cn('pointer-events-none absolute text-muted-foreground', compact ? 'right-1.5 size-3' : 'right-2.5 size-3.5')} />
    </span>
  )
}
