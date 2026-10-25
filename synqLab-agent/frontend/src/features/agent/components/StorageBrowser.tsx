/**
 * StorageBrowser — namespace-aware file tree browser for agent artifacts.
 *
 * Left panel: collapsible namespace tree.
 * Right panel: file listing with breadcrumb nav, preview sheet, and download.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MessageSquare, Dna, FlaskConical, Beaker, GitBranch, Package, Terminal,
  Brain, BarChart3, FolderOpen, ChevronRight, ChevronDown, Download,
  FileText, Loader2, type LucideIcon,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { api, type StorageEntry } from '@/api/client'

// ── Namespace metadata ──────────────────────────────────────────────────

const NAMESPACE_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  sessions: { icon: MessageSquare, color: 'text-blue-500', label: 'Sessions' },
  folding: { icon: Dna, color: 'text-violet-500', label: 'Folding' },
  foldx: { icon: FlaskConical, color: 'text-amber-500', label: 'FoldX' },
  candidates: { icon: Beaker, color: 'text-emerald-500', label: 'Candidates' },
  pipelines: { icon: GitBranch, color: 'text-cyan-500', label: 'Pipelines' },
  bundled: { icon: Package, color: 'text-muted-foreground', label: 'Bundled Samples' },
  sandbox: { icon: Terminal, color: 'text-orange-500', label: 'Sandbox' },
  brightness_models: { icon: Brain, color: 'text-pink-500', label: 'Models' },
  training_datasets: { icon: BarChart3, color: 'text-indigo-500', label: 'Datasets' },
}

const FALLBACK_META = { icon: FolderOpen, color: 'text-muted-foreground', label: '' }

// ── Helpers ─────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Tree Node ───────────────────────────────────────────────────────────

function NamespaceNode({
  entry,
  activePath,
  onNavigate,
}: {
  entry: StorageEntry
  activePath: string
  onNavigate: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<StorageEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  const meta = NAMESPACE_META[entry.name] ?? { ...FALLBACK_META, label: entry.display_name || entry.name }
  const Icon = meta.icon
  const isActive = activePath === entry.path || activePath.startsWith(entry.path + '/')
  const depth = entry.path.split('/').length - 1

  const handleToggle = async () => {
    if (!open && children === null) {
      setLoading(true)
      try {
        const parts = entry.path.split('/')
        const ns = parts[0]
        const sub = parts.slice(1).join('/')
        const res = await api.browseStorageRaw(ns, sub)
        setChildren(res.entries.filter(e => e.is_dir))
      } catch { setChildren([]) }
      setLoading(false)
    }
    setOpen(!open)
    onNavigate(entry.path)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          onClick={handleToggle}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors rounded-sm ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''
            }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {open
            ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          }
          <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${meta.color}`} />
          <span className="truncate flex-1 text-left text-sm">
            {meta.label || entry.name}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children?.map(child => (
          <NamespaceNode
            key={child.path}
            entry={child}
            activePath={activePath}
            onNavigate={onNavigate}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Main Component ──────────────────────────────────────────────────────

export function StorageBrowser() {
  const [rootEntries, setRootEntries] = useState<StorageEntry[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<StorageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState<StorageEntry | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load root namespace list on mount
  useEffect(() => {
    api.browseStorageRaw()
      .then(res => {
        setRootEntries(res.entries.filter(e => e.is_dir))
      })
      .catch(() => setRootEntries([]))
      .finally(() => setLoading(false))
  }, [])

  // Load content when path changes
  const loadContent = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const parts = path.split('/')
      const ns = parts[0]
      const sub = parts.slice(1).join('/')
      const res = await api.browseStorageRaw(ns, sub)
      setEntries(res.entries)
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [])

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path)
    loadContent(path)
  }, [loadContent])

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return []
    return currentPath.split('/').filter(Boolean)
  }, [currentPath])

  // File preview
  const openPreview = async (entry: StorageEntry) => {
    if (entry.is_dir) {
      handleNavigate(entry.path)
      return
    }
    // Only preview text-like files under 1MB
    if (entry.size && entry.size > 1024 * 1024) {
      window.open(api.downloadStorageUrl(entry.path), '_blank')
      return
    }
    setPreviewFile(entry)
    setPreviewLoading(true)
    try {
      const url = api.downloadStorageUrl(entry.path)
      const res = await fetch(url)
      const text = await res.text()
      setPreviewContent(text)
    } catch {
      setPreviewContent('[Unable to load preview]')
    }
    setPreviewLoading(false)
  }

  // File icon based on extension
  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdb': return <Dna className="h-4 w-4 text-violet-500" />
      case 'fasta':
      case 'fa': return <Dna className="h-4 w-4 text-emerald-500" />
      case 'json': return <FileText className="h-4 w-4 text-amber-500" />
      case 'csv': return <BarChart3 className="h-4 w-4 text-blue-500" />
      default: return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex h-full border border-border/40 rounded-lg overflow-hidden bg-card">
      {/* ── Left: namespace tree ──────────────────────────────────── */}
      <div className="w-[260px] flex-shrink-0 border-r border-border/40 bg-surface flex flex-col">
        <div className="px-3 py-2 border-b border-border/30">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Namespaces
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            {rootEntries.map(entry => (
              <NamespaceNode
                key={entry.path}
                entry={entry}
                activePath={currentPath}
                onNavigate={handleNavigate}
              />
            ))}
            {rootEntries.length === 0 && !loading && (
              <div className="px-4 py-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No namespaces</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right: content listing ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb header */}
        <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="cursor-pointer text-xs hover:text-primary transition-colors"
                  onClick={() => { setCurrentPath(''); setEntries([]) }}
                >
                  storage
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((segment, i) => {
                const segPath = breadcrumbs.slice(0, i + 1).join('/')
                const isLast = i === breadcrumbs.length - 1
                const meta = i === 0 ? NAMESPACE_META[segment] : null
                return (
                  <BreadcrumbItem key={segPath}>
                    <BreadcrumbSeparator />
                    {isLast ? (
                      <BreadcrumbPage className="text-xs font-medium">
                        {meta?.label || segment}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        className="cursor-pointer text-xs hover:text-primary transition-colors"
                        onClick={() => handleNavigate(segPath)}
                      >
                        {meta?.label || segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Content area */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
              ))}
            </div>
          ) : !currentPath ? (
            /* Root: show all namespaces as cards */
            <div className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {rootEntries.map(entry => {
                  const meta = NAMESPACE_META[entry.name] ?? { ...FALLBACK_META, label: entry.display_name || entry.name }
                  const Icon = meta.icon
                  return (
                    <button
                      key={entry.path}
                      onClick={() => handleNavigate(entry.path)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:bg-muted/30 hover:border-primary/20 transition-all text-left group"
                    >
                      <div className={`w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{meta.label || entry.name}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.name}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {rootEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <h3 className="text-sm font-medium text-muted-foreground">No artifacts</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Start an agent session to generate artifacts, or drop files into the chat.
                  </p>
                </div>
              )}
            </div>
          ) : entries.length === 0 ? (
            /* Empty directory */
            <div className="flex flex-col items-center justify-center py-16">
              <FolderOpen className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <h3 className="text-sm font-medium text-muted-foreground">No files yet</h3>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs text-center">
                This namespace will be populated when the agent produces artifacts of this type.
              </p>
            </div>
          ) : (
            /* File listing */
            <div className="divide-y divide-border/20">
              {entries.map(entry => (
                <button
                  key={entry.path}
                  onClick={() => openPreview(entry)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left group"
                >
                  {entry.is_dir ? (
                    <FolderOpen className="h-4 w-4 text-primary/60 flex-shrink-0" />
                  ) : (
                    getFileIcon(entry.name)
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm">{entry.display_name || entry.name}</span>
                  {entry.is_dir ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5">dir</Badge>
                  ) : (
                    <>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatSize(entry.size)}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-14 text-right">
                        {timeAgo(entry.modified)}
                      </span>
                      <a
                        href={api.downloadStorageUrl(entry.path)}
                        download
                        onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </a>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Preview Sheet ────────────────────────────────────────── */}
      <Sheet open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="font-mono text-sm truncate">
              {previewFile?.name}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all p-4 bg-muted/30 rounded">
                {previewContent}
              </pre>
            )}
          </ScrollArea>
          <SheetFooter className="mt-4">
            {previewFile && (
              <a href={api.downloadStorageUrl(previewFile.path)} download>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </a>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
