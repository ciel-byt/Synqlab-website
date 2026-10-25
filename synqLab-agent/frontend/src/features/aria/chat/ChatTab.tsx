import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquarePlus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { getJson, postJson } from '../api'
import { SelectBox } from '../SelectBox'
import type { VersionRow } from '../types'
import { ResultCard, type Card } from './ResultCard'

interface Chat { id: string; title: string; version_id: string; model: string; version: number; family: string }
interface Msg { id: string; role: 'user' | 'assistant'; text: string; payload: { cards: Card[] } | null }
interface Scenario { id: string; label: string; prompt: string }

const STAGES = ['Reading your request…', 'Generating the sequence…', 'Predicting the structure…', 'Scoring and annotating…']
const CHAT_FAMILIES = ['PF00237', 'PF00467', 'PF03652']
const vlabel = (r: VersionRow) => `${r.model} v${r.version}`

/** Chat with a model version: write a request or pick a scenario, get a generated protein with structure and features. */
export function ChatTab({ rows, startVersionId, onStarted }: { rows: VersionRow[]; startVersionId: string | null; onStarted: () => void }) {
  const usable = useMemo(() => rows.filter((r) => r.status === 'ready' && r.data_source === 'our-data' && r.family && CHAT_FAMILIES.includes(r.family)), [rows])
  const [chats, setChats] = useState<Chat[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [scen, setScen] = useState<Scenario[]>([])
  const [text, setText] = useState('')
  const [compare, setCompare] = useState('')
  const [newVer, setNewVer] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const chat = chats.find((c) => c.id === active) ?? null

  const loadChats = useCallback(() => getJson<Chat[]>('/api/aria/chats').then((c) => { setChats(c); return c }), [])
  useEffect(() => { loadChats().then((c) => { if (c.length && !startVersionId) setActive((a) => a ?? c[0].id) }).catch(() => setErr('Could not load chats.')) }, [loadChats]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = useCallback(async (versionId: string) => {
    setErr(null)
    try {
      const c = await postJson<Chat>('/api/aria/chats', { version_id: versionId })
      setChats((l) => [c, ...l]); setActive(c.id); setMsgs([])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start a chat.') }
  }, [])
  useEffect(() => { if (startVersionId) { create(startVersionId).then(onStarted) } }, [startVersionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!newVer && usable.length) setNewVer(usable[0].id) }, [usable, newVer])

  useEffect(() => {
    if (!active) { setMsgs([]); return }
    getJson<{ messages: Msg[] }>(`/api/aria/chats/${active}`).then((d) => setMsgs(d.messages)).catch(() => setErr('Could not load this chat.'))
  }, [active])
  useEffect(() => { if (chat) getJson<Scenario[]>(`/api/aria/chat/scenarios/${chat.family}`).then(setScen).catch(() => setScen([])); setCompare('') }, [chat?.family, chat?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length, busy])

  const send = async (payload: { text?: string; scenario_id?: string }) => {
    if (!chat || busy) return
    setBusy(true); setErr(null)
    try {
      const call = postJson<Msg[]>(`/api/aria/chats/${chat.id}/messages`, { ...payload, compare_version_id: compare || null })
      // the demo replays a recorded generation; take a few seconds so it reads like one, showing what is happening
      for (let i = 0; i < STAGES.length; i++) { setStage(i); await new Promise((r) => setTimeout(r, 900)) }
      const out = await call
      setMsgs((m) => [...m, ...out]); setText('')
      loadChats()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send.') } finally { setBusy(false) }
  }
  const changeModel = async (versionId: string) => {
    if (!chat || versionId === chat.version_id) return
    setErr(null)
    try { await apiFetch(`/api/aria/chats/${chat.id}`, { method: 'PATCH', body: JSON.stringify({ version_id: versionId }) }); setCompare(''); await loadChats() } catch { setErr('Could not switch model.') }
  }
  const remove = async (id: string) => {
    await apiFetch(`/api/aria/chats/${id}`, { method: 'DELETE' })
    setChats((l) => l.filter((c) => c.id !== id)); if (active === id) { setActive(null); setMsgs([]) }
  }

  const sameFamily = chat ? usable.filter((r) => r.family === chat.family && r.id !== chat.version_id) : []

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-13rem)] lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="space-y-2">
          <SelectBox className="flex w-full" value={newVer} onChange={(e) => setNewVer(e.target.value)} aria-label="Model for a new chat" disabled={!usable.length}>
            {usable.map((r) => <option key={r.id} value={r.id}>{vlabel(r)}</option>)}
            {!usable.length && <option>No model ready</option>}
          </SelectBox>
          <Button className="w-full" size="sm" disabled={!newVer} onClick={() => create(newVer)}><MessageSquarePlus className="mr-1.5 size-3.5" />New chat</Button>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {chats.map((c) => (
            <li key={c.id}>
              <div className={cn('group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm', active === c.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setActive(c.id)}><span className="block truncate">{c.title}</span><span className="block truncate text-[11px] font-normal text-muted-foreground">{c.model} v{c.version}</span></button>
                <button aria-label="Delete chat" className="hidden text-muted-foreground hover:text-destructive group-hover:block" onClick={() => remove(c.id)}><Trash2 className="size-3.5" /></button>
              </div>
            </li>
          ))}
          {!chats.length && <li className="px-2 py-3 text-xs text-muted-foreground">No chats yet. {usable.length ? 'Pick a model and start one.' : 'Train a model on a tuned family first.'}</li>}
        </ul>
      </aside>

      <section className="flex min-h-[520px] min-w-0 flex-col rounded-2xl border border-border bg-card">
        {!chat ? (
          <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
            <div><h3 className="mb-1 font-serif text-xl font-medium text-foreground">Chat with a model</h3>Describe the protein you want. Aria returns a sequence, a structure, and its features.</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{chat.title}</div><div className="text-[11px] text-muted-foreground">{chat.model} v{chat.version}</div></div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">Model 1
                  <SelectBox value={chat.version_id} onChange={(e) => changeModel(e.target.value)} aria-label="Model 1">
                    {usable.map((r) => <option key={r.id} value={r.id}>{vlabel(r)}</option>)}
                  </SelectBox>
                </label>
                <label className="flex items-center gap-2">Model 2
                  <SelectBox value={compare} onChange={(e) => setCompare(e.target.value)} aria-label="Model 2" disabled={!sameFamily.length}>
                    <option value="">None</option>
                    {sameFamily.map((r) => <option key={r.id} value={r.id}>{vlabel(r)}</option>)}
                  </SelectBox>
                </label>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {!msgs.length && <p className="text-sm text-muted-foreground">Try one of the scenarios below, or write your own, for example: <i>a 105 residue protein with net charge +7</i>.</p>}
              {msgs.map((m) => m.role === 'user' ? (
                <div key={m.id} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.text}</div></div>
              ) : (
                <div key={m.id} className="space-y-2">
                  <p className="text-sm text-muted-foreground">{m.text}</p>
                  <div className={cn('grid gap-3', (m.payload?.cards.length ?? 0) > 1 && 'xl:grid-cols-2')}>{m.payload?.cards.map((c) => <ResultCard key={c.version_id} c={c} compact={(m.payload?.cards.length ?? 0) > 1} />)}</div>
                </div>
              ))}
              {busy && (
                <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3 text-sm" role="status">
                  {STAGES.map((s, i) => (
                    <div key={s} className={cn('flex items-center gap-2', i < stage ? 'text-emerald-700 dark:text-emerald-300' : i === stage ? 'text-sky-700 dark:text-sky-300' : 'text-muted-foreground/60')}>
                      {i === stage ? <Loader2 className="size-3.5 animate-spin" /> : <span className={cn('size-1.5 rounded-full', i < stage ? 'bg-emerald-500' : 'bg-border')} />}{s}
                    </div>
                  ))}
                </div>
              )}
              <div ref={end} />
            </div>
            <div className="space-y-2 border-t border-border p-3">
              {scen.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scen.slice(0, 6).map((s) => (
                    <button key={s.id} disabled={busy} onClick={() => send({ scenario_id: s.id })} title={s.prompt}
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{s.label}</button>
                  ))}
                </div>
              )}
              {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ text: text.trim() }) }}>
                <input value={text} onChange={(e) => setText(e.target.value)} disabled={busy} aria-label="Your request" placeholder="Describe the protein you want, e.g. 105 residues, net charge +7, stable"
                  className="h-9 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                <Button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send className="size-4" /></Button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
