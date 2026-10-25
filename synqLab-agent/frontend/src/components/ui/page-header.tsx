import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Optional inline badge next to the title. */
  badge?: ReactNode
  actions?: ReactNode
  size?: 'default' | 'large'
  /** Adds a bottom border + neutral background (e.g. for full-bleed pages). */
  bordered?: boolean
  className?: string
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  size = 'default',
  bordered = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        size === 'large' ? 'mb-10' : 'mb-6',
        bordered && 'border-b border-border bg-card/90 px-6 py-4 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <h1
            className={cn(
              'tracking-tight text-foreground',
              size === 'large' ? 'text-3xl font-medium' : 'text-2xl font-medium',
            )}
          >
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className={cn('text-muted-foreground', size === 'large' ? 'text-sm max-w-2xl' : 'text-sm')}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
