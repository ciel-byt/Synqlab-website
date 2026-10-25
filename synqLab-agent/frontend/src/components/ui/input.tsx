import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Input + Textarea — token-driven form primitives.
 *
 * Two import patterns are supported:
 *   1. Bare primitive (shadcn-style): `<Input className="..." />` — caller
 *      composes the `<Label>` separately.
 *   2. Convenience-wrapped form field with `label` / `hint` / `error` — used by
 *      most existing pages. The wrapper renders a `<div>` group with a label
 *      and an inline error message.
 */

interface BaseProps {
  label?: string
  hint?: string
  error?: string
  /** Hide the convenience wrapper even if `label` is set. */
  bare?: boolean
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    BaseProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, id, bare, ...props }, ref) => {
    const reactId = useId()
    const inputId = id ?? `in-${reactId}`
    const hasWrapper = (label || hint || error) && !bare

    const input = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-full border bg-card px-4 py-2',
          'text-foreground text-sm placeholder:text-muted-foreground',
          'border-input shadow-xs transition-all duration-100',
          'outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
          className,
        )}
        {...props}
      />
    )

    if (!hasWrapper) return input

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-foreground">
            {label}
            {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
          </label>
        )}
        {input}
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-status-err">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, bare, ...props }, ref) => {
    const reactId = useId()
    const inputId = id ?? `ta-${reactId}`
    const hasWrapper = (label || hint || error) && !bare

    const textarea = (
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-2xl border bg-card px-4 py-2 resize-y',
          'text-foreground text-sm placeholder:text-muted-foreground',
          'border-input shadow-xs transition-all duration-100',
          'outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
          className,
        )}
        {...props}
      />
    )

    if (!hasWrapper) return textarea

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-foreground">
            {label}
            {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
          </label>
        )}
        {textarea}
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-status-err">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
