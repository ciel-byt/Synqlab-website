import { Crown, Shield, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roleChipClass, type Role } from '@/lib/roleStyle'

/**
 * RoleChip — owner/admin/member/viewer/guest pill with icon.
 *
 * Replaces the parallel role color maps that used to live in
 * `OrganizationPage.roleBadgeClass` and `PeoplePage.roleMeta`. Tokens-based
 * palette wins so it adapts to dark mode automatically.
 */

const ICONS: Record<string, React.ReactNode> = {
  owner: <Crown size={11} />,
  admin: <ShieldCheck size={11} />,
  guest: <UserRound size={11} />,
  viewer: <Shield size={11} />,
  member: <UserRound size={11} />,
}

function iconFor(role: string): React.ReactNode {
  return ICONS[role] ?? ICONS.member
}

interface RoleChipProps {
  role: Role | undefined
  className?: string
  showIcon?: boolean
}

export function RoleChip({ role, className, showIcon = true }: RoleChipProps) {
  const r = (role ?? 'member').toLowerCase()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1',
        roleChipClass(r),
        className,
      )}
    >
      {showIcon && iconFor(r)}
      {r}
    </span>
  )
}
