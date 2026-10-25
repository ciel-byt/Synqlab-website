import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'

type InvitePreview = {
  org_name: string
  role: string
  expires_at: string
  valid: boolean
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const normalizedToken = useMemo(() => {
    const raw = (token ?? '').trim().replace(/^\/+|\/+$/g, '')
    return raw.replace(/[^a-zA-Z0-9_-]/g, '')
  }, [token])

  const nextPath = useMemo(() => (normalizedToken ? `/invite/${normalizedToken}` : '/workspace'), [normalizedToken])

  useEffect(() => {
    if (!normalizedToken) {
      setError('Invitation token is missing.')
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .previewInvite(normalizedToken)
      .then(data => {
        setPreview(data)
        setError(null)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load invitation.'))
      .finally(() => setLoading(false))
  }, [normalizedToken])

  async function accept(): Promise<void> {
    if (!normalizedToken) return
    setAccepting(true)
    setError(null)
    try {
      const result = await api.acceptInvite(normalizedToken)
      setAcceptedMessage(`Joined ${result.org_name} as ${result.role}. Redirecting...`)
      window.setTimeout(() => navigate('/workspace', { replace: true }), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation.')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading invitation...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Organization Invitation</h1>
        {preview?.valid ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You are invited to join <span className="font-medium text-foreground">{preview.org_name}</span> as{' '}
            <span className="font-medium capitalize text-foreground">{preview.role}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            This invite is invalid or already used. Ask the organization admin for a new one.
          </p>
        )}
        {preview?.expires_at && (
          <p className="mt-2 text-xs text-muted-foreground">Expires at: {new Date(preview.expires_at).toLocaleString()}</p>
        )}
        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {acceptedMessage && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {acceptedMessage}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!preview?.valid ? (
            <Link to="/organization" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-foreground/90">
              Go to organization page
            </Link>
          ) : !user ? (
            <>
              <Link
                to={`/login?next=${encodeURIComponent(nextPath)}`}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-foreground/90"
              >
                Sign in to accept
              </Link>
              <Link
                to={`/signup?next=${encodeURIComponent(nextPath)}`}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/80 hover:bg-surface"
              >
                Create account
              </Link>
            </>
          ) : (
            <button
              onClick={accept}
              disabled={accepting}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-foreground/90 disabled:opacity-60"
            >
              {accepting ? 'Accepting...' : 'Accept invitation'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
