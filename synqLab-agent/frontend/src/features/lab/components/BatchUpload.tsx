/**
 * BatchUpload — drag-and-drop file upload with CSV/FASTA preview.
 */

import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, Dna, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface BatchUploadProps {
  onSubmit: (content: string, format: 'csv' | 'fasta') => void
}

function detectFormat(content: string): 'csv' | 'fasta' | 'unknown' {
  const trimmed = content.trim()
  if (trimmed.startsWith('>')) return 'fasta'
  const lines = trimmed.split('\n')
  if (lines.length >= 2 && lines[0].includes(',')) return 'csv'
  return 'unknown'
}

function previewCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1, 6).map(line => line.split(',').map(c => c.trim()))
  return { headers, rows }
}

function previewFasta(content: string): { name: string; length: number }[] {
  const entries: { name: string; length: number }[] = []
  let currentName = ''
  let currentLen = 0

  for (const line of content.trim().split('\n')) {
    if (line.startsWith('>')) {
      if (currentName) entries.push({ name: currentName, length: currentLen })
      currentName = line.slice(1).trim()
      currentLen = 0
    } else {
      currentLen += line.trim().length
    }
  }
  if (currentName) entries.push({ name: currentName, length: currentLen })
  return entries.slice(0, 5)
}

export function BatchUpload({ onSubmit }: BatchUploadProps) {
  const [content, setContent] = useState<string | null>(null)
  const [format, setFormat] = useState<'csv' | 'fasta' | 'unknown'>('unknown')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const fmt = detectFormat(text)
      setContent(text)
      setFormat(fmt)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleClear = () => {
    setContent(null)
    setFormat('unknown')
    setFileName('')
  }

  return (
    <div className="space-y-3">
      {!content ? (
        /* Drop zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
            ${dragging ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border'}
          `}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">
            Drop a <strong>CSV</strong> or <strong>FASTA</strong> file here
          </p>
          <p className="text-[10px] text-muted-foreground">
            or click to browse • .csv, .fasta, .fa
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.fasta,.fa,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      ) : (
        /* Preview */
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/20">
            {format === 'csv' ? <FileText className="h-3.5 w-3.5 text-blue-500" /> : <Dna className="h-3.5 w-3.5 text-violet-500" />}
            <span className="text-xs font-medium flex-1 truncate">{fileName}</span>
            <Badge variant="outline" className="text-[8px] h-3.5 px-1">
              {format.toUpperCase()}
            </Badge>
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="p-3 max-h-[200px] overflow-y-auto">
            {format === 'csv' && (() => {
              const { headers, rows } = previewCsv(content)
              return (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border/20">
                      {headers.map((h, i) => (
                        <th key={i} className="text-left py-1 px-1.5 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/10">
                        {row.map((cell, j) => (
                          <td key={j} className="py-1 px-1.5 font-mono truncate max-w-[120px]">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}

            {format === 'fasta' && (
              <div className="space-y-1">
                {previewFasta(content).map((seq, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <Dna className="h-3 w-3 text-violet-500/50 flex-shrink-0" />
                    <span className="font-medium truncate flex-1">{seq.name}</span>
                    <span className="text-muted-foreground">{seq.length} aa</span>
                  </div>
                ))}
              </div>
            )}

            {format === 'unknown' && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Unrecognized format. Please use CSV or FASTA.
              </div>
            )}
          </div>

          {format !== 'unknown' && (
            <div className="px-3 py-2 border-t border-border/20 bg-muted/10">
              <Button
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => onSubmit(content, format as 'csv' | 'fasta')}
              >
                Submit Batch ({format === 'csv'
                  ? `${content.trim().split('\n').length - 1} rows`
                  : `${previewFasta(content).length} sequences`
                })
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
