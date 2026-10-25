import { cn } from '@/lib/utils'

export type Status = 'queued' | 'progress' | 'done' | 'simulated'
const STYLE: Record<Status, string> = {
  queued: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  simulated: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
}
const LABEL: Record<Status, string> = { queued: 'Queued', progress: 'In progress', done: 'Done', simulated: 'Simulated' }

/** Small coloured status tag: Queued (amber), In progress (blue), Done (green), Simulated (violet). */
export function StatusChip({ kind, className, title }: { kind: Status; className?: string; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center rounded-full px-2 py-px font-sans text-[10px] font-semibold leading-4', STYLE[kind], className)}>{LABEL[kind]}</span>
}
