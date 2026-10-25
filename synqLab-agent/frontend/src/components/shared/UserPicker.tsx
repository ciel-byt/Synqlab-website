/**
 * UserPicker — searchable org member selector.
 *
 * Props:
 *   orgId       – limits search to this org's members
 *   onSelect    – called with the chosen user
 *   placeholder – input placeholder text
 *   excluded    – list of user IDs to exclude from results
 */

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface PickedUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role?: string
}

interface UserPickerProps {
  orgId: string
  onSelect: (user: PickedUser) => void
  placeholder?: string
  excluded?: string[]
  className?: string
}

import { initials } from '@/lib/initials'

export function UserPicker({ orgId, onSelect, placeholder = 'Search people…', excluded = [], className }: UserPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickedUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function search() {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/people/org/${orgId}/search?q=${encodeURIComponent(query.trim())}&limit=15`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as PickedUser[]
        setResults(data.filter(u => !excluded.includes(u.id)))
        setOpen(true)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Could not search members')
        }
        // abort or network error — silently ignore
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(search, 220)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, orgId, excluded])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function handleSelect(user: PickedUser) {
    onSelect(user)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
        <Search size={13} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={12} />
          </button>
        )}
        {loading && <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin flex-shrink-0" />}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg text-sm">
          {results.map(u => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(u)}
                className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.full_name} className="h-7 w-7 rounded-full object-cover" />
                    : initials(u.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.role && (
                  <span className="ml-auto text-xs text-muted-foreground capitalize flex-shrink-0">{u.role}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg">
          No members found for "{query}"
        </div>
      )}
      {open && !loading && results.length === 0 && !query.trim() && !error && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg">
          Type a name or email to search organization members.
        </div>
      )}
      {open && !loading && error && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}
