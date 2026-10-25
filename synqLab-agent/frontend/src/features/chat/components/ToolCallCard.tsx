import { useState } from 'react'
import { ChevronRight, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCall } from '@/features/chat/types'

export function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5 rounded-md border border-blue-100 bg-blue-50 text-xs">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-blue-700 font-medium"
      >
        <Wrench size={11} />
        {call.name}
        <ChevronRight size={11} className={cn('ml-auto transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <pre className="px-3 pb-2 text-blue-600 text-[11px] whitespace-pre-wrap break-all">
          {JSON.stringify(call.arguments, null, 2)}
        </pre>
      )}
    </div>
  )
}
