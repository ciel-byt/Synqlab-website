import { cn } from '@/lib/utils'
import { initials as buildInitials } from '@/lib/initials'
import { avatarSeedColor } from '@/lib/hashPalette'

/**
 * InitialsAvatar — name → initials → palette → tinted square/circle avatar.
 *
 * Consolidates the inline avatar circles that used to live in OrganizationPage,
 * PeoplePage, ChatPage, and UserPicker. Pass `imageUrl` to render a real photo
 * with the initials fallback baked in for graceful degradation.
 */
export interface InitialsAvatarProps {
  name: string | null | undefined
  /** Optional image URL — when present, renders the photo; falls back to initials on error. */
  imageUrl?: string | null
  /** Pixel size; defaults to 36. */
  size?: number
  /** `circle` (default) or `rounded`. */
  shape?: 'circle' | 'rounded'
  className?: string
}

export function InitialsAvatar({
  name,
  imageUrl,
  size = 36,
  shape = 'circle',
  className,
}: InitialsAvatarProps) {
  const text = buildInitials(name, { fallback: 'U' })
  const palette = avatarSeedColor(name ?? text)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-md'
  const fontPx = Math.max(10, Math.round(size * 0.4))

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold leading-none',
        radius,
        palette.bg,
        palette.text,
        className,
      )}
      style={{ width: size, height: size, fontSize: fontPx }}
      aria-label={name ?? 'Avatar'}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name ?? ''}
          className={cn('size-full object-cover', radius)}
          onError={e => {
            const img = e.currentTarget
            img.style.display = 'none'
          }}
        />
      ) : (
        text
      )}
    </div>
  )
}
