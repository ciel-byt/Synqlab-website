import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

/** "Describe your problem" form. Saves to /api/aria/requests (signed-in users only). */
export function RequestForm({ family, famName, source = 'aria-demo', intro }: { family?: string; famName?: string; source?: 'aria-demo'; intro?: string }) {
  const { user } = useAuth()
  const [f, setF] = useState({ email: user?.email ?? '', name: user?.full_name ?? '', org: '', problem: '', data_description: '' })
  const [state, setState] = useState<{ s: 'idle' | 'sending' | 'done' | 'error'; msg?: string }>({ s: 'idle' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const input = 'w-full rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState({ s: 'sending' })
    try {
      const r = await apiFetch('/api/aria/requests', { method: 'POST', body: JSON.stringify({ ...f, family: family || null, source }) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Could not send.') }
      setState({ s: 'done' })
    } catch (err) {
      setState({ s: 'error', msg: err instanceof Error ? err.message : 'Could not send.' })
    }
  }

  if (state.s === 'done') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-5">
        <CheckCircle2 className="mt-0.5 size-5 text-primary" />
        <div><p className="font-medium">Thank you.</p><p className="text-sm text-muted-foreground">We got your request and will reply by email.</p></div>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        {intro ?? 'Describe the protein problem you are working on. We will tell you whether Aria can help and what we would need.'}
        {family && <> Family on your mind: <b className="text-foreground">{family}</b>{famName ? `, ${famName}` : ''}.</>}
      </p>
      <label className="block space-y-1.5 text-sm font-medium">What are you trying to design?
        <textarea required minLength={10} value={f.problem} onChange={set('problem')} className={cn(input, 'min-h-24 rounded-2xl')} placeholder="For example: binders for a target, or enzymes with a certain property." />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">What data do you have? <span className="font-normal text-muted-foreground">Describe it here. Please do not paste sensitive data. We will arrange sharing on a call.</span>
        <textarea value={f.data_description} onChange={set('data_description')} className={cn(input, 'min-h-24 rounded-2xl')} placeholder="For example: 200 measured sequences with activity values." />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-medium">Work email<input required type="email" value={f.email} onChange={set('email')} className={input} /></label>
        <label className="block space-y-1.5 text-sm font-medium">Name<input value={f.name} onChange={set('name')} className={input} /></label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">Organization<input value={f.org} onChange={set('org')} className={input} /></label>
      <Button type="submit" disabled={state.s === 'sending'}>{state.s === 'sending' ? 'Sending…' : 'Send request'}</Button>
      {state.s === 'error' && <p role="alert" className="text-sm text-destructive">{state.msg}</p>}
    </form>
  )
}

