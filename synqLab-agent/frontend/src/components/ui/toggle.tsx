import { Switch } from './switch'
import { cn } from '@/lib/utils'

/**
 * Legacy Toggle — preserves the `checked / onChange / label / hint` API
 * used across existing pages, but renders a Radix Switch underneath so
 * keyboard + screen-reader behaviour is correct.
 *
 * New code should prefer `<Switch>` directly with a separate `<Label>`.
 */
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  hint?: string
  className?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, hint, className, disabled }: ToggleProps) {
  return (
    <label className={cn('flex items-center gap-3 select-none', className)}>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label ?? 'Toggle'}
      />
      {label && (
        <span className="text-xs font-medium text-foreground">
          {label}
          {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
        </span>
      )}
    </label>
  )
}
