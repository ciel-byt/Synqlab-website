import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export interface SidebarCollapsibleGroupProps {
  title: string
  titleClassName?: string
  action?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function SidebarCollapsibleGroup({
  title,
  titleClassName,
  action,
  children,
  defaultOpen = true,
  className,
}: SidebarCollapsibleGroupProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("group/collapsible mb-1.5 last:mb-0", className)}>
      <SidebarGroup className="p-0.5 rounded-lg border border-border bg-background/60 dark:bg-background/40 transition-all">
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
          <CollapsibleTrigger asChild>
            <div className="flex flex-1 items-center justify-between cursor-pointer outline-none overflow-hidden">
              <SidebarGroupLabel className={cn("p-0 h-auto text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden bg-transparent shrink-0 truncate", titleClassName)}>
                {title}
              </SidebarGroupLabel>
              <div className="hidden group-data-[collapsible=icon]:flex w-full items-center justify-center">
                <span className="font-bold text-sidebar-foreground/60 text-xs">{title.charAt(0)}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden text-sidebar-foreground/40 shrink-0 ml-2" />
            </div>
          </CollapsibleTrigger>
          {action && (
            <div className="ml-2 flex-shrink-0 group-data-[collapsible=icon]:hidden flex items-center justify-center">
              {action}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <SidebarGroupContent className="mt-0.5">
            <SidebarMenu>
              {children}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
