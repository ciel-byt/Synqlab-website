/**
 * ChatDropZone — wraps the agent chat input bar to accept file drops.
 * Phase 13 D-09 / D-11. Native HTML5 drag-drop (no third-party library).
 */

import { useCallback, useImperativeHandle, useRef, useState, forwardRef, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'

const ALLOWED_EXTENSIONS = ['.pdb', '.fasta', '.fa', '.csv', '.json'] as const
const MAX_BYTES = 10 * 1024 * 1024

function extOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export interface ChatDropZoneHandle {
  openPicker: () => void
}

interface ChatDropZoneProps {
  sessionId: string
  onUploaded: (artifactId: string) => void
  children: ReactNode
}

export const ChatDropZone = forwardRef<ChatDropZoneHandle, ChatDropZoneProps>(
  function ChatDropZone({ sessionId, onUploaded, children }, ref) {
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      openPicker: () => inputRef.current?.click(),
    }), [])

    const handleFile = useCallback(async (file: File) => {
      const ext = extOf(file.name)
      if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
        toast.error(
          'File type not supported. Use .pdb, .fasta, .fa, .csv, or .json.',
        )
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error('File too large. Maximum 10 MB per attachment.')
        return
      }
      try {
        const artifact = await api.uploadArtifact(sessionId, file)
        toast.success(`${file.name} attached`)
        onUploaded(artifact.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        toast.error(`Upload failed: ${msg}`)
      }
    }, [sessionId, onUploaded])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    }, [handleFile])

    return (
      <div
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative ${dragging ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''}`}
      >
        {dragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 pointer-events-none">
            <Upload className="h-8 w-8 text-primary" />
            <span className="ml-2 text-sm">Drop file to attach…</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        {children}
      </div>
    )
  },
)
