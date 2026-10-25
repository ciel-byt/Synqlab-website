/**
 * ToolDetailView — routed view for /lab/tools/:toolId.
 *
 * Full detail page with back button, reusing the existing ToolDetail component.
 * Follows the same pattern as workspace MemberDetailView / TeamDetailView.
 */
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToolsContext } from '@/pages/ToolsPage'
import { ToolDetail } from '../components/ToolDetail'


export function ToolDetailView() {
  const data = useToolsContext()
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()

  const tool = data.tools.find(t => t.id === toolId)

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Tool not found</p>
        <button
          onClick={() => navigate('/lab/computers')}
          className="text-xs text-primary hover:underline"
        >
           ← Back to computers
        </button>
      </div>
    )
  }

  // Resolve per-tool cached inputs (initialised from tool defaults)
  const toolInputs = data.inputsCache[tool.id] ??
    Object.fromEntries(
      (tool.inputs || []).map(inp => [
        inp.name,
        inp.default !== undefined ? String(inp.default) : '',
      ]),
    )

  const toolResults = data.resultsCache[tool.id] ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back button */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <button
          onClick={() => navigate('/lab/computers')}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={11} />
          Computers
        </button>
      </div>

      {/* ToolDetail fills the rest */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ToolDetail
          key={tool.id}
          tool={tool}
          health={data.health[tool.id]}
          compute={data.compute}
          inputs={toolInputs}
          onInputsChange={inputs => data.updateInputsForTool(tool.id, inputs)}
          results={toolResults}
          onAddResult={entry => data.addResultForTool(tool.id, entry)}
          onUpdateResult={(jobId, result) => data.updateResultForTool(tool.id, jobId, result)}
        />
      </div>
    </div>
  )
}
