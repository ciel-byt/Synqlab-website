/**
 * Login form — production glass-card design.
 */
import { useState, type FormEvent } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm({
  className,
  handleAuth,
  error,
  submitting,
  ...props
}: React.ComponentProps<'div'> & {
  handleAuth: (email: string, password: string) => void
  error: string | null
  submitting: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    handleAuth(email, password)
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="auth-card rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-8 depth-2">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-medium text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your SynqLab account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-10 bg-background/50 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-10 bg-background/50 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
            <Button type="submit" className="w-full h-10 btn-pop font-medium" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="spinner spinner-white" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-card/80 px-3 text-muted-foreground/50">or</span>
            </div>
          </div>

          {/* Waiting list CTA */}
          <div className="text-center">
            <p className="text-[12px] text-muted-foreground/70 mb-3">
              Don&apos;t have an account?
            </p>
            <button
              type="button"
              disabled
              className="w-full h-10 rounded-lg border border-border/50 bg-muted/30 text-sm font-medium text-muted-foreground/60 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              Request Access
              <span className="ml-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/40 border border-border/40 rounded px-1.5 py-0.5">Soon</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
