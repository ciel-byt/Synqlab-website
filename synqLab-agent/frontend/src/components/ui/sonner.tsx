import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Themed Sonner toaster — token-driven styling.
 * Mounted once at the root via App.tsx.
 *
 * When a ThemeProvider is added later, swap in `useTheme()` to
 * auto-detect light/dark and pass as `theme` prop.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
