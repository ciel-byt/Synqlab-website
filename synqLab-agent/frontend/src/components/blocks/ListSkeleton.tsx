import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * ListSkeleton — N placeholder rows for paginated lists.
 *
 * Replaces the hand-rolled skeleton grids in PeoplePage, HealthPage, and
 * ToolsPage. Each row is `[avatar?] [primary line] [secondary line]`.
 */
interface ListSkeletonProps {
  rows?: number
  /** Render a leading circle (avatar / status dot). */
  withAvatar?: boolean
  className?: string
}

export function ListSkeleton({ rows = 6, withAvatar = true, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          {withAvatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
