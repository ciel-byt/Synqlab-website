import type { ReactNode } from 'react'
import { PageShell, type PageState } from '@/components/blocks/PageShell'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export interface ModularPageLayoutProps {
  /** The domain-specific sidebar component */
  sidebar: ReactNode
  /** The main content area */
  children: ReactNode
  /** Additional classes for the SidebarInset */
  contentClassName?: string
  /** Passed down to PageShell */
  state?: PageState
  /** Passed down to PageShell */
  emptyState?: ReactNode
}

/**
 * A standardized layout wrapper for modular domain pages (Projects, Chat, People).
 * Enforces a pixel-perfect, full-height rounded container with a sidebar and main area.
 */
export function ModularPageLayout({ sidebar, children, contentClassName, state, emptyState }: ModularPageLayoutProps) {
  return (
    <PageShell
      state={state}
      emptyState={emptyState}
      scrollable={false}
      width="full"
      className="h-full"
      contentClassName="h-full"
    >
      <SidebarProvider className="glass-card relative h-full w-full rounded-xl overflow-hidden flex bg-sidebar/80">
        {sidebar}
        <SidebarInset className={cn("flex-1 flex flex-col min-w-0 bg-card overflow-y-auto", contentClassName)}>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </PageShell>
  )
}
