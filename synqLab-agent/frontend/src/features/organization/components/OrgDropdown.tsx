/**
 * OrgDropdown — reusable "⋮" dropdown menu for org entities.
 *
 * Wraps shadcn DropdownMenu. Accepts the same ContextMenuItem[]
 * shape that the menu builder functions already return.
 */
import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import type { ContextMenuItem } from '../types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface OrgDropdownProps {
  items: ContextMenuItem[]
  /** Optional custom trigger element; defaults to a "⋮" icon button. */
  trigger?: ReactNode
  /** Alignment relative to trigger */
  align?: 'start' | 'center' | 'end'
}

export function OrgDropdown({ items, trigger, align = 'end' }: OrgDropdownProps) {
  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical size={14} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px]">
        {items.map((item, i) => {
          if (item.kind === 'divider') return <DropdownMenuSeparator key={`d${i}`} />
          return (
            <DropdownMenuItem
              key={item.label}
              disabled={item.disabled}
              onClick={item.onClick}
              className={item.destructive ? 'text-destructive focus:text-destructive' : ''}
            >
              <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
              {item.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
