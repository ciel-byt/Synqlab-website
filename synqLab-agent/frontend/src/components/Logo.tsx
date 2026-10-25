import { Link } from 'react-router-dom'

type LogoSize = 'xs' | 'sm' | 'md' | 'lg'

interface LogoProps {
  size?: LogoSize
  showWordmark?: boolean
  tagline?: string
  wordmarkClassName?: string
  taglineClassName?: string
  to?: string
  className?: string
}

const SIZES: Record<LogoSize, { mark: string; wordmark: string; gap: string; tagline: string }> = {
  xs: { mark: 'h-6',  wordmark: 'text-[13px]', gap: 'gap-1.5', tagline: 'text-[10px]' },
  sm: { mark: 'h-7',  wordmark: 'text-sm',     gap: 'gap-2',   tagline: 'text-[11px]' },
  md: { mark: 'h-8',  wordmark: 'text-[15px]', gap: 'gap-2.5', tagline: 'text-xs'    },
  lg: { mark: 'h-10', wordmark: 'text-lg',     gap: 'gap-3',   tagline: 'text-xs'    },
}

/**
 * Canonical SynqLab logo — uses the actual brand PNG.
 * showWordmark: false → Logo_No_Words.png, true → Full.png
 */
export function Logo({
  size = 'md',
  showWordmark = false,
  tagline,
  taglineClassName = 'text-muted-foreground',
  to,
  className = '',
}: LogoProps) {
  const s = SIZES[size]
  const content = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      {showWordmark ? (
        <img
          src="/Full.png"
          alt="SynqLab"
          className={`${s.mark} w-auto select-none`}
          style={{ height: size === 'lg' ? '3rem' : undefined }}
        />
      ) : (
        <LogoMark className={s.mark} />
      )}
      {tagline && !showWordmark && (
        <span className="flex flex-col leading-none">
          <span className={`mt-0.5 ${s.tagline} ${taglineClassName}`}>{tagline}</span>
        </span>
      )}
    </span>
  )
  if (to) {
    return <Link to={to} className="no-underline">{content}</Link>
  }
  return content
}

/**
 * SynqLab mark — uses the brand icon PNG (no words).
 */
export function LogoMark({ className = 'h-8' }: { className?: string }) {
  return (
    <img
      src="/Logo_No_Words.png"
      alt="SynqLab"
      className={`${className} w-auto shrink-0 select-none`}
    />
  )
}
