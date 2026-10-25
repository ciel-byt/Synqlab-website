/**
 * SidebarListItem — reusable selectable item for page sidebars.
 *
 * Provides consistent styling (active highlight, hover, text sizing)
 * across all sidebar content lists (sessions, templates, experiments,
 * skills, etc.).
 *
 * Icon container is 16×16 (size-4) to match SidebarMenuButton alignment.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SidebarListItemProps {
  /** Whether this item is currently selected. */
  active?: boolean
  /** Primary label. */
  title: ReactNode
  /** Secondary description line (single-line clamp). */
  subtitle?: ReactNode
  /** Icon shown before the title. Rendered inside a 16×16 container for alignment. */
  icon?: ReactNode
  /** Inline badge or status shown after the title. */
  trailing?: ReactNode
  /** Additional content rendered below the title row. */
  meta?: ReactNode
  onClick?: () => void
  /** Overlay actions shown on hover (e.g. delete button). */
  hoverActions?: ReactNode
  /** Vertical alignment for hoverActions. Default: 'center'. */
  hoverActionsAlign?: 'center' | 'bottom' | 'stretch'
  className?: string
}

export function SidebarListItem({
  active = false,
  title,
  subtitle,
  icon,
  trailing,
  meta,
  onClick,
  hoverActions,
  hoverActionsAlign = 'center',
  className,
}: SidebarListItemProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left rounded-md p-2 transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
          hoverActions && 'group-hover:pr-7',
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="flex items-center justify-center size-4 shrink-0 [&>svg]:size-4">{icon}</span>}
          <p className="text-[12px] font-medium truncate flex-1">
            {title}
          </p>
          {trailing}
        </div>
        {subtitle && (
          <p className={cn('text-[10px] text-muted-foreground mt-0.5 line-clamp-1', icon && 'pl-6')}>
            {subtitle}
          </p>
        )}
        {meta}
      </button>
      {hoverActions && (
        <div className={cn(
          'absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity',
          hoverActionsAlign === 'stretch'
            ? 'top-1.5 bottom-1.5 flex flex-col justify-between'
            : hoverActionsAlign === 'bottom' ? 'bottom-1.5' : 'top-1/2 -translate-y-1/2',
        )}>
          {hoverActions}
        </div>
      )}
    </div>
  )
}
