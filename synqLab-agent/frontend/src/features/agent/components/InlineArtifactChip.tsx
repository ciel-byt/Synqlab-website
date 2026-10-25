/**
 * InlineArtifactChip — compact in-chat affordance shown right after a tool
 * call that produced a persisted artifact (write_report, save_artifact).
 *
 * Provides a one-click Download and an inline expandable preview, so the
 * model's "you can view here" promise actually has a target in the chat.
 */

import { useState } from 'react'
import { Download, FileText, Dna, BarChart3, FlaskConical, ChevronDown, ChevronRight, Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import type { AgentArtifact, ArtifactType } from '@/features/agent/types'

const ARTIFACT_ICONS: Record<ArtifactType, { icon: typeof FileText; color: string; label: string }> = {
  markdown_report: { icon: FileText, color: 'text-emerald-500', label: 'Report' },
  pdb_structure: { icon: Dna, color: 'text-violet-500', label: 'PDB' },
  score_table: { icon: BarChart3, color: 'text-blue-500', label: 'Scores' },
  sequence_fasta: { icon: FlaskConical, color: 'text-amber-500', label: 'FASTA' },
}

interface InlineArtifactChipProps {
  sessionId: string
  artifact: AgentArtifact
}

export function InlineArtifactChip({ sessionId, artifact }: InlineArtifactChipProps) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState<string | null>(artifact.content ?? null)
  const [loading, setLoading] = useState(false)

  const info = ARTIFACT_ICONS[artifact.artifact_type] ?? ARTIFACT_ICONS.markdown_report
  const Icon = info.icon

  const ensureContent = async (): Promise<string | null> => {
    if (content !== null) return content
    setLoading(true)
    try {
      const full = await api.getArtifact(sessionId, artifact.id)
      const body = full.content ?? null
      setContent(body)
      return body
    } catch {
      setContent('Failed to load content')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    if (!expanded) await ensureContent()
    setExpanded(!expanded)
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const body = await ensureContent()
    if (body == null) return
    const blob = new Blob([body], { type: artifact.content_type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = artifact.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePromote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.promoteArtifact(artifact.id)
      toast.success('Promoted to project Datasets')
      // The right panel will refresh on the next list-fetch; the chip itself
      // will re-render once the parent passes a new artifact.scope. For
      // immediate feedback we don't mutate local state — the next refresh
      // hides the Promote button.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to promote'
      toast.error(`Failed to promote: ${msg}`)
    }
  }

  return (
    <div className="my-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          }
          <Icon className={`h-4 w-4 ${info.color} flex-shrink-0`} />
          <span className="text-xs font-semibold truncate">{artifact.name}</span>
          <Badge variant="outline" className={`text-[11px] font-semibold h-5 px-1.5 ${info.color} border-current/20 flex-shrink-0`}>
            {info.label}
          </Badge>
          {artifact.scope !== 'session' && (
            <Badge variant="outline" className="text-[11px] font-semibold h-5 px-1.5 text-muted-foreground border-current/20 flex-shrink-0">
              {artifact.scope === 'project' ? 'Project' : 'Bundled'}
            </Badge>
          )}
        </button>
        {artifact.scope === 'session' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[11px] flex-shrink-0 hover:text-primary hover:bg-primary/10"
            onClick={handlePromote}
            disabled={loading}
            aria-label={`Promote ${artifact.name} to project Datasets`}
            title="Save to project Datasets so other sessions can use it"
          >
            <Bookmark className="h-3 w-3" />
            Promote
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[11px] flex-shrink-0"
          onClick={handleDownload}
          disabled={loading}
        >
          <Download className="h-3 w-3" />
          Download
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-emerald-500/20">
          {loading && content === null ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">Loading…</div>
          ) : (
            <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap max-h-[260px] overflow-y-auto bg-background/40">
              {content ?? '(no content)'}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
