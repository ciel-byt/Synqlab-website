import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'

/**
 * PageShell — the canonical chrome for every authenticated app page.
 *
 * Responsibilities:
 *   - Predictable max-width container with consistent padding.
 *   - Optional title + subtitle + actions row.
 *   - First-class loading / error / empty rendering driven by a `state` prop.
 *
 * Pages typically pass `state={query.status === 'pending' ? 'loading' : ...}`
 * directly from a TanStack Query hook.
 */
export type PageState = 'idle' | 'loading' | 'error' | 'empty'

interface PageShellProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /**
   * Render state — `loading` shows the LoadingState block, `error` shows
   * ErrorState, `empty` renders the empty placeholder if `emptyState` is
   * provided, otherwise nothing.
   */
  state?: PageState
  /** Error to surface when state === 'error'. */
  error?: unknown
  /** Retry handler shown alongside the ErrorState. */
  onRetry?: () => void
  /** Element to render when state === 'empty'. */
  emptyState?: ReactNode
  /** Override container width — `narrow` is good for forms / settings pages. */
  width?: 'narrow' | 'default' | 'wide' | 'full'
  /**
   * If true, the children are rendered inside the same scroll container as the
   * header. Set false (default) for pages that manage their own scrolling
   * internally (e.g. ChatPage with split panes).
   */
  scrollable?: boolean
  className?: string
  contentClassName?: string
  children?: ReactNode
}

const WIDTHS: Record<NonNullable<PageShellProps['width']>, string> = {
  narrow:  'max-w-2xl',
  default: 'max-w-6xl',
  wide:    'max-w-7xl',
  full:    'max-w-none',
}

export function PageShell({
  title,
  subtitle,
  actions,
  state = 'idle',
  error,
  onRetry,
  emptyState,
  width = 'default',
  scrollable = true,
  className,
  contentClassName,
  children,
}: PageShellProps) {
  const showHeader = Boolean(title || subtitle || actions)

  let body: ReactNode = children
  if (state === 'loading') {
    body = <LoadingState />
  } else if (state === 'error') {
    body = <ErrorState error={error} onRetry={onRetry} />
  } else if (state === 'empty' && emptyState) {
    body = emptyState
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-6',
        scrollable ? 'min-h-full' : 'h-full overflow-hidden',
        className,
      )}
    >
      {showHeader && (
        <header className={cn('mx-auto w-full', WIDTHS[width])}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {title && (
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            )}
          </div>
        </header>
      )}
      <div
        className={cn(
          'mx-auto w-full',
          WIDTHS[width],
          scrollable ? 'flex-1' : 'flex-1 overflow-hidden',
          contentClassName,
        )}
      >
        {body}
      </div>
    </div>
  )
}
