/**
 * AriaPage — Aria model workspace.
 *
 * Models: a queryable table of every model version with its performance (green/red change vs the Aria base).
 * Details open in a panel beside the table. New model: pick data, set up, and watch recorded rounds replay.
 */

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useModels, useRuns } from '@/features/aria/api'
import { ModelsTable } from '@/features/aria/ModelsTable'
import { NewModel } from '@/features/aria/NewModel'
import { ChatTab } from '@/features/aria/chat/ChatTab'
import { ComparePanel, VersionPanel } from '@/features/aria/VersionPanel'
import type { VersionRow } from '@/features/aria/types'

export function AriaPage() {
  const runs = useRuns()
  const { rows, error, reload } = useModels()
  const [tab, setTab] = useState<'models' | 'use'>('models')
  const [view, setView] = useState<'table' | 'new'>('table')
  const [chatFor, setChatFor] = useState<string | null>(null)
  const [panel, setPanel] = useState<{ kind: 'version'; id: string } | { kind: 'compare'; a: string; b: string } | null>(null)
  const [cont, setCont] = useState<VersionRow | null>(null)
  const [nonce, setNonce] = useState(0)

  const startNew = useCallback((from: VersionRow | null) => { setCont(from); setPanel(null); setNonce((n) => n + 1); setTab('models'); setView('new') }, [])
  const haveRounds = cont && rows ? Math.max(...rows.filter((r) => r.model_id === cont.model_id).map((r) => r.rounds)) : 0
  const find = (id: string) => rows?.find((r) => r.id === id)
  const vRow = panel?.kind === 'version' ? find(panel.id) : undefined
  const cA = panel?.kind === 'compare' ? find(panel.a) : undefined
  const cB = panel?.kind === 'compare' ? find(panel.b) : undefined

  return (
    <div className="w-full space-y-5 p-6">
      <PageHeader title="Aria" actions={<Button onClick={() => startNew(null)}>New model</Button>} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'models' | 'use')}>
        <TabsList><TabsTrigger value="models">Models</TabsTrigger><TabsTrigger value="use">Use models</TabsTrigger></TabsList>
      </Tabs>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {(!runs || !rows) && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>}

      {runs && rows && tab === 'models' && view === 'table' && (
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <ModelsTable rows={rows} runs={runs} onChanged={reload} selectedId={vRow?.id ?? null} onOpen={(r) => setPanel({ kind: 'version', id: r.id })} onCompare={(a, b) => setPanel({ kind: 'compare', a: a.id, b: b.id })} onNew={() => startNew(null)} />
          {vRow && <VersionPanel row={vRow} rows={rows} runs={runs} onClose={() => setPanel(null)} onChanged={reload} onNewVersion={startNew} onChat={(r) => { setPanel(null); setChatFor(r.id); setTab('use') }} />}
          {cA && cB && <ComparePanel a={cA} b={cB} runs={runs} onClose={() => setPanel(null)} />}
        </div>
      )}
      {runs && rows && tab === 'use' && <ChatTab rows={rows} startVersionId={chatFor} onStarted={() => setChatFor(null)} />}
      {runs && rows && tab === 'models' && view === 'new' && (
        <div className="space-y-4">
          <button className="text-sm text-primary underline" onClick={() => { setView('table'); setCont(null) }}>← Back to models</button>
          <NewModel key={nonce} runs={runs} continueFrom={cont} haveRounds={haveRounds} modelRows={rows.filter((r) => r.model_id === cont?.model_id)} onDone={() => { reload(); setCont(null); setView('table') }} />
        </div>
      )}
    </div>
  )
}
