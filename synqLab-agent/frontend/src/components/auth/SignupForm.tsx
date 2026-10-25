/**
 * Signup form — glass-card design with Firooze brand accents.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignupForm({
  className,
  handleAuth,
  error,
  submitting,
  ...props
}: React.ComponentProps<'div'> & {
  handleAuth: (email: string, password: string, fullName: string) => void
  error: string | null
  submitting: boolean
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }
    handleAuth(email, password, fullName)
  }

  const displayError = localError || error

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="auth-card rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-8 depth-2">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Get started with SynqLab
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-5">
            {displayError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                {displayError}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="signup-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="Jane Doe"
                required
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="h-10 bg-background/50 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                id="signup-email"
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
              <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input
                id="signup-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-10 bg-background/50 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-confirm" className="text-xs font-medium text-muted-foreground">Confirm Password</Label>
              <Input
                id="signup-confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="h-10 bg-background/50 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
            <Button type="submit" className="w-full h-10 btn-pop font-medium" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="spinner spinner-white" />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
