/**
 * Organization feature — shared sub-components.
 *
 * Extracted from OrganizationPage.tsx. These were hand-rolled inline primitives
 * that now use the shadcn design system tokens instead of hardcoded slate-*.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { initials } from './helpers'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ── Detail shell ─────────────────────────────────────────────────────────────

interface DetailShellProps {
  crumb: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  onTitleDoubleClick?: () => void
  children: ReactNode
}

export function DetailShell({
  crumb,
  title,
  subtitle,
  icon,
  actions,
  onTitleDoubleClick,
  children,
}: DetailShellProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 pb-8 pt-4">
      <div className="mb-3">{crumb}</div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <h1
              onDoubleClick={onTitleDoubleClick}
              className={cn(
                'text-2xl font-semibold tracking-tight text-foreground',
                onTitleDoubleClick ? 'cursor-text' : '',
              )}
            >
              {title}
            </h1>
            {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex items-start gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Big avatar icon ──────────────────────────────────────────────────────────

interface BigIconProps {
  seed: string
  label: string
  imageUrl?: string | null
  onClick?: () => void
  shape?: 'square' | 'round'
}

export function BigIcon({
  seed: _seed,
  label,
  imageUrl,
  onClick,
  shape = 'round',
}: BigIconProps) {
  const wrapperClasses = cn(
    "h-16 w-16 shrink-0 shadow-sm transition-all",
    shape === 'round' ? 'rounded-full' : 'rounded-2xl',
    onClick && 'cursor-pointer ring-2 ring-transparent hover:ring-muted-foreground/30'
  )
  const fallbackClasses = cn(
    "flex h-full w-full items-center justify-center text-lg font-bold text-white bg-foreground dark:bg-foreground/70",
    shape === 'round' ? 'rounded-full' : 'rounded-2xl'
  )

  return (
    <Avatar className={wrapperClasses} onClick={onClick}>
      {imageUrl && <AvatarImage src={imageUrl} alt={label} className="object-cover" />}
      <AvatarFallback className={fallbackClasses}>
        {label.length <= 2 ? label : initials(label).slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
}

// ── Stat chip ────────────────────────────────────────────────────────────────

interface StatChipProps {
  icon: ReactNode
  value: number | string
  label: string
  onClick?: () => void
}

export function StatChip({ icon, value, label, onClick }: StatChipProps) {
  const classes = cn(
    'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground',
    onClick && 'transition hover:bg-surface-muted cursor-pointer',
  )
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </>
  )
  if (onClick) return <button onClick={onClick} className={classes}>{inner}</button>
  return <div className={classes}>{inner}</div>
}

// ── Inline avatar ────────────────────────────────────────────────────────────

export function OrgAvatar({ seed: _seed, label, imageUrl }: { seed: string; label: string; imageUrl?: string | null }) {
  return (
    <Avatar className="h-8 w-8 shadow-sm border border-border">
      {imageUrl && <AvatarImage src={imageUrl} alt={label} className="object-cover" />}
      <AvatarFallback className="bg-foreground/60 dark:bg-foreground/40 text-white text-[11px] font-semibold">
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  )
}

// ── Section title ────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
  )
}

// ── Empty callout (wraps shared EmptyState) ──────────────────────────────────

import { EmptyState } from '@/components/blocks/EmptyState'

export function EmptyCallout({
  icon: _icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  // EmptyState expects a LucideIcon, but EmptyCallout passes ReactNode.
  // Wrap for backwards compatibility.
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      className="rounded-xl py-10"
    />
  )
}

// ── Skeletons ────────────────────────────────────────────────────────────────

export function TreeSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-6 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-8 pt-8">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}


