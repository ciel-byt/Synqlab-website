/**
 * ReportRenderer — renders markdown reports with metric highlights.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ReportRendererProps {
  title: string
  content: string
  reportType?: string
  artifactId?: string
}

/** Highlight key scientific metrics in markdown text. */
function highlightMetrics(text: string): string {
  return text
    // Highlight pLDDT values.
    .replace(/pLDDT\s*[:=]?\s*([\d.]+)/gi, (_match, val) => {
      const v = parseFloat(val)
      const color = v >= 70 ? '🟢' : v >= 50 ? '🟡' : '🔴'
      return `${color} pLDDT: **${val}**`
    })
    // Highlight ΔΔG values.
    .replace(/[ΔΔ]*G\s*[:=]?\s*([+-]?[\d.]+)\s*(kcal\/mol)?/gi, (_match, val, unit) => {
      const v = parseFloat(val)
      const color = v < 0 ? '🟢' : v < 2 ? '🟡' : '🔴'
      return `${color} ΔΔG: **${val}** ${unit || 'kcal/mol'}`
    })
}

export function ReportRenderer({ title, content, reportType }: ReportRendererProps) {
  const [expanded, setExpanded] = useState(true)

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 border-b border-border/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        }
        <FileText className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold flex-1 truncate">{title}</span>
        {reportType && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            {reportType}
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); handleDownload() }}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 max-h-[500px] overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
            {highlightMetrics(content)}
          </pre>
        </div>
      )}
    </div>
  )
}
