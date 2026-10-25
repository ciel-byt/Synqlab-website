import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge — token-driven status pill.
 *
 * Variants:
 *   - canonical:  `default | secondary | outline | success | warning | error | info`
 *   - legacy:     `ok` (= success), `running` (= info),
 *                 `gray` (= secondary), `amber` (= warning), `indigo` (= info)
 */
const badgeVariants = cva(
  [
    'inline-flex items-center px-2.5 py-0.5 rounded-full',
    'text-[10px] font-bold font-mono tracking-wider',
    'border transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default:   'bg-primary text-primary-foreground border-primary',
        secondary: 'bg-muted text-muted-foreground border-border',
        outline:   'bg-transparent text-foreground border-border',
        success:   'bg-status-ok-bg text-status-ok-text border-status-ok/30',
        warning:   'bg-status-warn-bg text-status-warn-text border-status-warn/30',
        error:     'bg-status-err-bg text-status-err-text border-status-err/30',
        info:      'bg-status-info-bg text-status-info-text border-status-info/30',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
)

type CanonicalVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>
type LegacyVariant = 'ok' | 'error' | 'running' | 'gray' | 'amber' | 'indigo'
type BadgeVariant = CanonicalVariant | LegacyVariant

const VARIANT_ALIAS: Record<LegacyVariant, CanonicalVariant> = {
  ok:      'success',
  error:   'error',
  running: 'info',
  gray:    'secondary',
  amber:   'warning',
  indigo:  'info',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  const resolved: CanonicalVariant =
    variant && variant in VARIANT_ALIAS
      ? VARIANT_ALIAS[variant as LegacyVariant]
      : (variant as CanonicalVariant) ?? 'secondary'
  return (
    <span className={cn(badgeVariants({ variant: resolved }), className)} {...props}>
      {children}
    </span>
  )
}

export { badgeVariants }
