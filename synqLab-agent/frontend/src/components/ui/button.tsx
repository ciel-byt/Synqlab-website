import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Button — production primitive built on Radix Slot + cva.
 *
 * Two variant axes are exposed:
 *   - shadcn-canonical:  `default | secondary | ghost | destructive | outline | link`
 *   - legacy aliases:    `primary` (= default), `danger` (= destructive)
 *
 * Existing pages use `variant="primary" | "secondary" | "ghost" | "danger"` —
 * those continue to work via the alias map. New code should prefer the
 * canonical names.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-full font-semibold tracking-wide font-sans leading-none',
    'border transition-all duration-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border-primary hover:bg-primary-hover shadow-xs hover:shadow-sm',
        secondary:
          'bg-card text-foreground border-border hover:bg-surface-muted shadow-xs',
        ghost:
          'bg-transparent text-muted-foreground border-transparent hover:bg-surface-muted hover:text-foreground',
        outline:
          'bg-transparent text-foreground border-border hover:bg-surface-muted',
        destructive:
          'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90 shadow-xs',
        link:
          'bg-transparent text-foreground border-transparent underline-offset-4 hover:underline shadow-none',
      },
      size: {
        sm: 'px-3.5 py-1.5 text-xs gap-1.5',
        md: 'px-5 py-2 text-[12.5px]',
        lg: 'px-6 py-2.5 text-sm',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

type CanonicalVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>
type LegacyVariant = 'primary' | 'danger'
type ButtonVariant = CanonicalVariant | LegacyVariant

const VARIANT_ALIAS: Record<LegacyVariant, CanonicalVariant> = {
  primary: 'default',
  danger:  'destructive',
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    Pick<VariantProps<typeof buttonVariants>, 'size'> {
  variant?: ButtonVariant
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const resolvedVariant: CanonicalVariant =
      variant && variant in VARIANT_ALIAS
        ? VARIANT_ALIAS[variant as LegacyVariant]
        : (variant as CanonicalVariant) ?? 'default'

    // When asChild is true, Slot expects exactly one child element.
    // We cannot render multiple children (spinner + child), so skip the spinner.
    const spinner = loading && !asChild ? (
      <span
        aria-hidden
        className={cn(
          'inline-block size-[13px] rounded-full border-2 animate-spin shrink-0',
          resolvedVariant === 'default' || resolvedVariant === 'destructive'
            ? 'border-white/30 border-t-white'
            : 'border-muted-foreground/30 border-t-foreground',
        )}
      />
    ) : null

    // When asChild, only pass children (Slot requires exactly one child)
    if (asChild) {
      return (
        <Comp
          ref={ref}
          disabled={disabled || loading}
          className={cn(buttonVariants({ variant: resolvedVariant, size }), className)}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant: resolvedVariant, size }), className)}
        {...props}
      >
        {spinner}
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
