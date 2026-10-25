import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Row { id: string; email: string; full_name: string; is_admin: boolean; is_active: boolean; created_at: string | null }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await apiFetch(path, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Request failed.')
  return d as T
}

export function AdminPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ full_name: '', email: '', password: '', is_admin: false })
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null)

  const load = useCallback(() => {
    call<Row[]>('/api/admin/users').then(setRows).catch((e) => setErr(e.message))
  }, [])
  useEffect(() => { if (user?.is_admin) load() }, [user?.is_admin, load])

  if (user && !user.is_admin) return <Navigate to="/" replace />

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true); setErr(null); setOk(null)
    try { await fn(); setOk(done); load() } catch (e) { setErr(e instanceof Error ? e.message : 'Failed.') } finally { setBusy(false) }
  }
  const patch = (id: string, body: object) => call(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

  const add = (e: FormEvent) => {
    e.preventDefault()
    run(async () => { await call('/api/admin/users', { method: 'POST', body: JSON.stringify(f) }); setF({ full_name: '', email: '', password: '', is_admin: false }) }, 'User added.')
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-serif text-3xl font-medium">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add people to SynqLab and manage their access.</p>
      </div>

      {err && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      {ok && <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">{ok}</p>}

      <form onSubmit={add} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl font-medium">Add a user</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required />
          <Input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <Input type="password" placeholder="Password (8+ characters)" autoComplete="new-password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_admin} onChange={(e) => setF({ ...f, is_admin: e.target.checked })} /> Make admin</label>
          <Button type="submit" disabled={busy}>Add user</Button>
        </div>
        <p className="text-xs text-muted-foreground">They can sign in right away and join your organizations as members. Share the password with them yourself.</p>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Email</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3">{r.full_name}</td>
                <td className="p-3 text-muted-foreground">{r.email}</td>
                <td className="p-3">{r.is_admin ? 'Admin' : 'Member'}</td>
                <td className="p-3">{r.is_active ? 'Active' : 'Disabled'}</td>
                <td className="p-3">
                  {reset?.id === r.id ? (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await patch(r.id, { password: reset.password }); setReset(null) }, 'Password changed.') }}>
                      <Input type="password" placeholder="New password" autoComplete="new-password" minLength={8} value={reset.password} onChange={(e) => setReset({ id: r.id, password: e.target.value })} required />
                      <Button size="sm" type="submit" disabled={busy}>Save</Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => setReset(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setReset({ id: r.id, password: '' })}>Reset password</Button>
                      {r.id !== user?.id && <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => patch(r.id, { is_admin: !r.is_admin }), r.is_admin ? 'Admin removed.' : 'Admin added.')}>{r.is_admin ? 'Remove admin' : 'Make admin'}</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => patch(r.id, { is_active: !r.is_active }), r.is_active ? 'User disabled.' : 'User enabled.')}>{r.is_active ? 'Disable' : 'Enable'}</Button>
                      </>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
