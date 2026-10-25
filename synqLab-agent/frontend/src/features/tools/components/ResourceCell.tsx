/**
 * ResourceCell — compact resource profile badge for tool cards/tables.
 * Extracted from ToolsPage.tsx.
 */
import type { ResourceProfile } from '@/types'
import { cn } from '@/lib/utils'
import { fmtDisk, fmtRam, COMPUTE_STYLE, COMPUTE_LABEL } from '../helpers'

export function ResourceCell({ rp, dark = false }: { rp?: ResourceProfile; dark?: boolean }) {
  if (!rp) return <span className="text-[11px] text-muted-foreground/50">—</span>
  const isGpu = rp.gpu && rp.gpu !== 'none'
  const computeType = isGpu ? 'gpu' : 'cpu'
  return (
    <div className={cn('flex flex-col gap-0.5', dark && 'opacity-80')}>
      <div className="flex items-center gap-1">
        <span className={cn('text-[9px] font-mono font-semibold px-1 py-0.5 border rounded-sm', dark ? 'bg-card/10 text-white/70 border-white/20' : COMPUTE_STYLE[computeType] ?? COMPUTE_STYLE.cpu)}>
          {COMPUTE_LABEL[computeType] ?? computeType.toUpperCase()}
        </span>
        {isGpu && (
          <span className={cn('text-[9px] font-mono', dark ? 'text-white/40' : 'text-muted-foreground/70')}>
            {rp.gpu!.toUpperCase()}
          </span>
        )}
      </div>
      <div className={cn('flex items-center gap-2 text-[10px]', dark ? 'text-white/50' : 'text-muted-foreground')}>
        <span title="Disk">💾 {fmtDisk(rp.disk_gb)}</span>
        <span title="RAM">🧠 {fmtRam(rp.ram_gb)}</span>
      </div>
    </div>
  )
}
