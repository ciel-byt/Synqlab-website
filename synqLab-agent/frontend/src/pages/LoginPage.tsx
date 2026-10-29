/**
 * Login page — premium glass-card layout with animated background.
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginForm } from '@/components/auth/LoginForm'

function readNext(search: string): string {
  const params = new URLSearchParams(search)
  const next = params.get('next')
  if (!next || !next.startsWith('/')) return '/lab/agents'
  return next
}

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const next = readNext(location.search)

  async function onSubmit(email: string, password: string) {
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10 overflow-hidden">
      {/* Animated mesh background */}
      <div className="auth-mesh pointer-events-none absolute inset-0" />
      <div className="auth-glow pointer-events-none absolute inset-0" />

      <a
        href="/"
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:left-10 md:top-8"
      >
        <span aria-hidden="true">←</span> Back to website
      </a>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8 page-enter">
        <a href="/" className="flex items-center gap-2 self-center font-medium group">
          <img src="/Full.png" alt="SynqLab" className="h-14 w-auto select-none" />
        </a>
        <LoginForm
          handleAuth={onSubmit}
          error={error}
          submitting={submitting}
        />
        <p className="text-center text-[11px] text-muted-foreground/50">
          Self-improving AI agents for biology
        </p>
      </div>
    </div>
  )
}
