/**
 * EntityCard — shared card component for the SynqLab design system.
 *
 * Supports two layouts:
 *
 * VERTICAL (default, 3:4):                HORIZONTAL (landscape):
 * ┌────────────────────┐                 ┌──────────────────────────────────┐
 * │ [av] Title    ✏️🗑️ │                 │ [av]                             │
 * │      label         │                 │ Title          VISUAL      ✏️🗑️ │
 * │ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                 │ subtitle       AREA             │
 * │                    │                 │ 📁3 👥2        (anything)       │
 * │    VISUAL AREA     │                 │ label                          │
 * │  (any content:     │                 └──────────────────────────────────┘
 * │   SVG, text, img,  │
 * │   chart, animation)│
 * │                    │
 * │ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
 * │ 📁 3  👥 2          │
 * │ @subtitle          │
 * └────────────────────┘
 *
 * The `visual` prop is a generic content slot — like a PowerPoint box.
 * It accepts any React node: SVG illustrations, images, charts, text,
 * animations, icons, or interactive elements.
 *
 * Card sizing is enforced via CSS aspect-ratio so cards maintain consistent
 * proportions while adapting to any screen size via auto-fill grid.
 *
 * ONE component, used everywhere. Change here = change all cards.
 *
 * Grid usage (for consuming pages):
 *   import { CARD_GRID_CLASS } from '@/components/ui/entity-card'
 *   <div className={CARD_GRID_CLASS}>
 *     <EntityCard ... />
 *   </div>
 */
import React from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Shared responsive grid class ─────────────────────────────────────────────

/** Standard vertical card grid — responsive, auto-fills, consistent sizing */
export const CARD_GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3'

/** Standard horizontal card grid — 2-3 columns, wider cards */
export const CARD_GRID_HORIZONTAL_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'

// ── Types ────────────────────────────────────────────────────────────────────

interface EntityCardIcon {
  letter?: string
  src?: string
  color?: string
  node?: React.ReactNode
}

interface EntityCardBadge {
  icon: LucideIcon | React.ComponentType<{ size?: number }>
  count: number | string
  title?: string
}

interface EntityCardAction {
  icon: LucideIcon
  onClick: (e: React.MouseEvent) => void
  title?: string
  variant?: 'default' | 'destructive'
}

/** Status indicator dot */
interface EntityCardStatus {
  color: 'green' | 'amber' | 'red' | 'muted'
  label?: string
}

export interface EntityCardProps {
  title: string
  subtitle?: string
  /** Multi-line description text — shown below title in vertical layout */
  description?: string
  icon?: EntityCardIcon
  label?: string
  labelVariant?: 'primary' | 'muted'
  badges?: EntityCardBadge[]
  actions?: EntityCardAction[]
  /**
   * Generic content slot — accepts ANY React node.
   * Examples: SVG illustration, <img>, chart component, animated element,
   * text block, icon composition, canvas, etc.
   * The area auto-fills remaining card space.
   */
  visual?: React.ReactNode
  /** Full-card overlay (e.g. delete confirmation) */
  overlay?: React.ReactNode
  /** Status indicator dot */
  status?: EntityCardStatus
  active?: boolean
  /**
   * 'vertical'  = portrait card with aspect-ratio (default)
   * 'horizontal' = landscape card
   * 'compact'   = small card, no aspect-ratio, shrink-to-fit
   */
  layout?: 'vertical' | 'horizontal' | 'compact'
  href?: string
  onClick?: () => void
  className?: string
  /** Custom footer slot — rendered below badges/subtitle in vertical layout */
  footer?: React.ReactNode
  /** Custom children replace the entire card interior */
  children?: React.ReactNode
}

// ── Status dot colors ────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red: 'bg-rose-500',
  muted: 'bg-muted-foreground/20',
}

// ── Component ────────────────────────────────────────────────────────────────

export function EntityCard({
  title,
  subtitle,
  description,
  icon,
  label,
  labelVariant = 'primary',
  badges,
  actions,
  visual,
  overlay,
  status,
  active = false,
  layout = 'vertical',
  href,
  onClick,
  className = '',
  footer,
  children,
}: EntityCardProps) {

  const cardClasses = [
    'entity-card',
    'relative rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:scale-[1.02]',
    layout === 'vertical'
      ? 'flex flex-col aspect-[5/6]'           /* ← portrait ratio */
      : layout === 'compact'
        ? 'flex flex-col'                        /* ← no forced aspect ratio */
        : 'flex flex-row',
    active
      ? 'border-primary/40 shadow-sm ring-1 ring-primary/10'
      : 'border-border hover:border-border/80 hover:shadow-sm',
    className,
  ].join(' ')

  // Wrapper: Link if href, clickable div if onClick, plain div otherwise
  const Wrapper = href
    ? (props: { children: React.ReactNode; className: string }) => (
        <Link to={href} onClick={onClick} className={props.className}>{props.children}</Link>
      )
    : onClick
      ? (props: { children: React.ReactNode; className: string }) => (
          <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()} className={`cursor-pointer ${props.className}`}>{props.children}</div>
        )
      : (props: { children: React.ReactNode; className: string }) => (
          <div className={props.className}>{props.children}</div>
        )

  // ── Shared sub-components ──────────────────────────────────────────────

  const avatarEl = icon && (
    <div
      className={cn(
        "entity-card-icon flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white overflow-hidden shrink-0",
        icon.node ? "bg-transparent text-foreground" : ""
      )}
      style={!icon.node ? { backgroundColor: icon.src ? undefined : (icon.color ?? 'hsl(var(--muted))') } : undefined}
    >
      {icon.node ? (
        icon.node
      ) : icon.src ? (
        <img src={icon.src} alt="" className="h-7 w-7 rounded-md object-cover" />
      ) : (
        icon.letter ?? '?'
      )}
    </div>
  )

  const labelEl = label && (
    <span className={`entity-card-label inline-block text-[7px] font-medium px-1 py-[1px] rounded ${
      labelVariant === 'primary'
        ? 'text-primary bg-primary/10'
        : 'text-muted-foreground bg-muted'
    }`}>
      {label}
    </span>
  )

  const statusEl = status && (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status.color]}`}
      title={status.label}
    />
  )

  const badgesEl = badges && badges.length > 0 && (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map((badge, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
          title={badge.title}
        >
          <badge.icon size={8} />
          {badge.count}
        </span>
      ))}
    </div>
  )

  const actionsEl = actions && actions.length > 0 && !overlay && (
    <div className="flex items-center gap-0.5 shrink-0">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); action.onClick(e) }}
          className={`h-5 w-5 inline-flex items-center justify-center rounded transition-colors ${
            action.variant === 'destructive'
              ? 'text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10'
              : 'text-muted-foreground/30 hover:text-foreground hover:bg-muted'
          }`}
          title={action.title}
        >
          <action.icon size={10} />
        </button>
      ))}
    </div>
  )

  return (
    <Wrapper className={cardClasses}>
      {overlay}

      {children ? (
        <div className="entity-card-custom relative z-[1] h-full">{children}</div>
      ) : layout === 'horizontal' ? (
        /* ── HORIZONTAL / LANDSCAPE layout ── */
        <>
          {/* Left: info column */}
          <div className="flex-1 flex flex-col justify-between p-3 min-w-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {avatarEl}
                {statusEl}
              </div>
              <p className="entity-card-title text-xs font-semibold text-foreground leading-tight line-clamp-2">
                {title}
              </p>
              {subtitle && (
                <p className="entity-card-subtitle text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                  {subtitle}
                </p>
              )}
              {labelEl && <div className="mt-1">{labelEl}</div>}
            </div>
            <div className="mt-auto pt-2">
              {badgesEl}
            </div>
          </div>

          {/* Right: visual area — generic content slot */}
          {visual && (
            <div className="entity-card-visual w-[35%] shrink-0 flex items-center justify-center p-3 overflow-hidden border-l border-border/20">
              {visual}
            </div>
          )}

          {/* Actions — top right absolute */}
          {actionsEl && (
            <div className="absolute top-2 right-2 z-[2]">
              {actionsEl}
            </div>
          )}
        </>
      ) : (
        /* ── VERTICAL / COMPACT layout ── */
        <>
          {/* Header: avatar + title + actions */}
          <div className="entity-card-header flex items-start gap-2 p-3 pb-0 shrink-0">
            {avatarEl}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="entity-card-title text-xs font-semibold text-foreground leading-tight line-clamp-2">
                  {title}
                </p>
                {statusEl}
              </div>
              {labelEl && <div className="mt-0.5">{labelEl}</div>}
            </div>
            {actionsEl}
          </div>

          {/* Description — multi-line text (compact / content-rich cards) */}
          {description && (
            <p className="entity-card-description text-[11px] text-muted-foreground leading-relaxed line-clamp-3 px-3 pt-1.5">
              {description}
            </p>
          )}
          {/* Spacer — pushes footer to bottom in compact mode */}
          {layout === 'compact' && <div className="flex-1 min-h-1" />}

          {/* Visual area — generic content slot, fills remaining space */}
          {visual && (
            <div className={`entity-card-visual flex items-center justify-center p-3 overflow-hidden min-h-0${layout === 'vertical' ? ' flex-1' : ''}`}>
              {visual}
            </div>
          )}
          {!visual && layout === 'vertical' && (
            <div className="entity-card-visual flex-1 flex items-center justify-center p-3 overflow-hidden min-h-0">
              <div className="w-8 h-8 rounded-lg bg-muted/30" />
            </div>
          )}

          {/* Footer */}
          {(badges || subtitle || footer) && (
            <div className="entity-card-footer border-t border-border/50 px-3 py-2 shrink-0 mt-auto">
              {badgesEl}
              {subtitle && (
                <p className="entity-card-subtitle text-[9px] text-muted-foreground line-clamp-2 mt-0.5">
                  {subtitle}
                </p>
              )}
              {footer}
            </div>
          )}
        </>
      )}
    </Wrapper>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function EntityCardSkeleton({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' | 'compact' }) {
  if (layout === 'horizontal') {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse flex flex-row">
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <div className="h-7 w-7 rounded-md bg-muted mb-2" />
            <div className="h-3 w-24 rounded bg-muted mb-1" />
            <div className="h-2.5 w-32 rounded bg-muted/50" />
          </div>
          <div className="flex gap-1.5 mt-2">
            <div className="h-3 w-10 rounded bg-muted/40" />
            <div className="h-3 w-10 rounded bg-muted/40" />
          </div>
        </div>
        <div className="w-[35%] bg-muted/10 border-l border-border/20" />
      </div>
    )
  }
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden animate-pulse flex flex-col${layout === 'vertical' ? ' aspect-[5/6]' : ''}`}>
      <div className="flex items-center gap-2 p-3 pb-0">
        <div className="h-7 w-7 rounded-md bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
      <div className="flex-1 flex items-center justify-center p-3 min-h-0">
        <div className="w-8 h-8 rounded-lg bg-muted/30" />
      </div>
      <div className="border-t border-border/50 px-3 py-2 flex gap-1.5">
        <div className="h-3 w-8 rounded bg-muted/40" />
        <div className="h-3 w-8 rounded bg-muted/40" />
      </div>
    </div>
  )
}

// ── "Add New" card ───────────────────────────────────────────────────────────

export function EntityCardNew({
  label = 'New item',
  onClick,
  layout = 'vertical',
  icon: Icon,
}: {
  label?: string
  onClick: () => void
  layout?: 'vertical' | 'horizontal'
  icon?: LucideIcon
}) {
  const PlusIcon = Icon ?? (({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ))

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border border-dashed border-border hover:border-primary/40 bg-card/30 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all hover:shadow-sm ${
        layout === 'vertical' ? 'flex-col aspect-[5/6]' : 'min-h-[100px]'
      }`}
    >
      <PlusIcon size={16} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
