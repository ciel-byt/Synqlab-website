/**
 * WorkspaceDesktopView — the landing / home view for /workspace.
 *
 * Layout:
 *   1. Summary stat cards (Projects, Teams, Members)
 *   2. Quick actions
 *   3. Organizations — card grid with inline edit, avatar change, delete
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  FolderOpen,
  ImagePlus,
  Pencil,
  Trash2,
  Users,
  UsersRound,
  Plus,
} from 'lucide-react'
import { useWorkspace } from '@/pages/WorkspacePage'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EntityCard, CARD_GRID_CLASS } from '@/components/ui/entity-card'
import { entityColorHsl } from '@/lib/entity-colors'
import { initials } from '../helpers'

import { PageHeader } from '@/components/ui/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/* ── Tiny SVG visuals for workspace cards ─────────────────────────── */

function ProjectsVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect x="20" y="20" width="40" height="28" rx="4" fill="currentColor" opacity="0.1" />
      <path d="M20 24h40v6H20z" fill="currentColor" opacity="0.15" />
      <path d="M24 16h24v4H24z" fill="currentColor" opacity="0.08" />
      <circle cx="28" cy="27" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="34" cy="27" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="27" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

function TeamsVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <circle cx="40" cy="20" r="8" fill="hsl(200, 80%, 55%)" opacity="0.25" />
      <circle cx="26" cy="38" r="6" fill="currentColor" opacity="0.12" />
      <circle cx="54" cy="38" r="6" fill="currentColor" opacity="0.12" />
      <path d="M32 30 q 8 -10 16 0" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M26 46 q 14 -10 28 0" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
    </svg>
  )
}

function MembersVisual() {
  return (
    <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <circle cx="28" cy="24" r="6" fill="currentColor" opacity="0.15" />
      <path d="M18 42 c 0 -8 20 -8 20 0" fill="currentColor" opacity="0.1" />
      <circle cx="52" cy="28" r="5" fill="hsl(150, 60%, 50%)" opacity="0.2" />
      <path d="M44 42 c 0 -6 16 -6 16 0" fill="currentColor" opacity="0.08" />
    </svg>
  )
}

export function WorkspaceDesktopView() {
  const d = useWorkspace()
  const { user } = useAuth()
  const navigate = useNavigate()
  const org = d.activeOrg

  // Inline name editing — tracks which org is being edited
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)


  // Inline new-org form (desktop only — separate from the modal triggered by sidebar)
  const [inlineNewOrg, setInlineNewOrg] = useState(false)

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <UsersRound size={40} className="text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Welcome to Workspace</h2>
        <p className="text-sm text-muted-foreground mb-4">Create or select an organization to get started.</p>
        <Button size="sm" onClick={() => d.setNewOrgOpen(true)}>
          <Plus size={12} /> New organization
        </Button>
      </div>
    )
  }

  async function handleSaveName(orgId: string, originalName: string) {
    const next = nameDraft.trim()
    if (!next || next === originalName) {
      setEditingOrgId(null)
      return
    }
    setSaving(true)
    try {
      await d.renameOrgInline(orgId, next)
      setEditingOrgId(null)
    } finally {
      setSaving(false)
    }
  }


  // In-card delete confirmation
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteOrg(orgId: string) {
    setDeleting(true)
    try {
      await api.deleteOrg(orgId)
      // Trigger a full page reload to refresh org state
      // (setOrgs is internal to workspace hooks and not directly exposed)
      d.showToast('success', 'Organization deleted')
      window.location.reload()
    } catch (err) {
      d.showToast('error', (err as Error).message || 'Delete failed')
      setDeleting(false)
      setDeletingOrgId(null)
    }
  }


  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto flex flex-col h-full overflow-y-auto w-full">
      <PageHeader
        title="Workspace Overview"
        description="Manage organizations, projects, and teams. Switch org context across the platform."
        size="large"
      />

      {/* Quick Access Section */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Access</h2>
        <div className={CARD_GRID_CLASS}>
          <EntityCard
            title="Projects"
            subtitle={`${d.projects.filter(p => p.org_id === org.id).length} Active Projects`}
            href="/workspace/projects"
            icon={{ node: <FolderOpen size={16} className="text-muted-foreground" /> }}
            visual={<div className="w-full h-full text-foreground"><ProjectsVisual /></div>}
            layout="vertical"
          />
          <EntityCard
            title="Teams"
            subtitle="Manage Research Teams"
            href="/workspace/teams"
            icon={{ node: <UsersRound size={16} className="text-muted-foreground" /> }}
            visual={<div className="w-full h-full text-foreground"><TeamsVisual /></div>}
            layout="vertical"
          />
          <EntityCard
            title="Members"
            subtitle="Manage Organization Members"
            href="/workspace/members"
            icon={{ node: <Users size={16} className="text-muted-foreground" /> }}
            visual={<div className="w-full h-full text-foreground"><MembersVisual /></div>}
            layout="vertical"
          />
        </div>
      </div>

      {/* Organizations Section */}
      <div>
        {(() => {
          const myOrgs = d.orgs.filter(o => {
            const me = (d.members[o.id] ?? []).find(m => m.user_id === user?.id)
            return me?.role === 'owner'
          })
          const invitedOrgs = d.orgs.filter(o => {
            const me = (d.members[o.id] ?? []).find(m => m.user_id === user?.id)
            return !me || me.role !== 'owner'
          })
          return (
            <>
              {myOrgs.length > 0 && (
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">My Organizations</h2>
              )}
              {myOrgs.length === 0 && invitedOrgs.length === 0 && (
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Organizations</h2>
              )}

              <div className={CARD_GRID_CLASS}>
          {d.orgs.map(o => {
            const isActive = o.id === d.activeOrgId
            const isEditing = editingOrgId === o.id
            const isDeleting = deletingOrgId === o.id
            const projCount = d.projects.filter(p => p.org_id === o.id).length
            const teamCount = (d.teams[o.id] ?? []).length
            const memberCount = (d.members[o.id] ?? []).length

            return (
              <div
                key={o.id}
                onClick={() => { if (!isEditing && !isDeleting) { d.setActiveOrgId(o.id); navigate('/workspace/projects') } }}
                className={`group relative rounded-xl border p-4 cursor-pointer transition-all ${
                  isDeleting
                    ? 'border-destructive/30 bg-destructive/[0.03] ring-1 ring-destructive/10'
                    : isEditing
                      ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10'
                      : isActive
                        ? 'border-primary/30 bg-primary/[0.03] shadow-sm ring-1 ring-primary/10'
                        : 'border-border/60 bg-card hover:border-border hover:shadow-sm'
                }`}
              >
                {/* Actions (top-right) — hidden during edit/delete */}
                {!isEditing && !isDeleting && (
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setNameDraft(o.name); setEditingOrgId(o.id); setDeletingOrgId(null) }} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Rename"><Pencil size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingOrgId(o.id); setEditingOrgId(null) }} className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete"><Trash2 size={12} /></button>
                  </div>
                )}

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 rounded-lg shadow-sm">
                      {o.avatar_url && <AvatarImage src={o.avatar_url} alt={o.name} className="object-cover" />}
                      <AvatarFallback className="rounded-lg text-xs font-bold text-white" style={{ backgroundColor: entityColorHsl(o.id) }}>
                        {initials(o.name).slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isActive) d.setActiveOrgId(o.id); d.triggerOrgAvatarUpload(o.id) }}
                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Change avatar"
                    >
                      <ImagePlus size={12} className="text-white" />
                    </button>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName(o.id, o.name); if (e.key === 'Escape') setEditingOrgId(null) }}
                          autoFocus
                          disabled={saving}
                          className="text-sm font-semibold tracking-tight text-foreground bg-transparent border-none outline-none p-0 w-full min-w-0 focus:ring-0"
                        />
                        <button
                          onClick={() => void handleSaveName(o.id, o.name)}
                          disabled={saving}
                          className="shrink-0 p-0.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          title="Save"
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold tracking-tight truncate text-foreground">{o.name}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground/70 truncate font-mono">@{o.slug}</span>
                  </div>
                </div>

                {/* Delete confirmation overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 z-10 rounded-xl backdrop-blur-sm bg-background/70 flex flex-col items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs font-medium text-destructive">Delete "{o.name}"?</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeletingOrgId(null)}
                        className="h-7 px-3 text-[11px] rounded-md text-muted-foreground hover:bg-muted border border-border transition-colors"
                      >
                        Cancel
                      </button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-3 text-[11px]"
                        onClick={() => void handleDeleteOrg(o.id)}
                        loading={deleting}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/projects') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Projects"><FolderOpen size={12} /> {projCount}</button>
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/teams') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Teams"><UsersRound size={12} /> {teamCount}</button>
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/members') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Members"><Users size={12} /> {memberCount}</button>
                  {isActive && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Invited section heading */}
          {invitedOrgs.length > 0 && myOrgs.length > 0 && (
            <h2 className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-1">Invited</h2>
          )}
          {invitedOrgs.map(o => {
            const isActive = o.id === d.activeOrgId
            const isEditing = editingOrgId === o.id
            const isDeleting = deletingOrgId === o.id
            const projCount = d.projects.filter(p => p.org_id === o.id).length
            const teamCount = (d.teams[o.id] ?? []).length
            const memberCount = (d.members[o.id] ?? []).length

            return (
              <div
                key={o.id}
                onClick={() => { if (!isEditing && !isDeleting) { d.setActiveOrgId(o.id); navigate('/workspace/projects') } }}
                className={`group relative rounded-xl border p-4 cursor-pointer transition-all ${
                  isDeleting
                    ? 'border-destructive/30 bg-destructive/[0.03] ring-1 ring-destructive/10'
                    : isEditing
                      ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10'
                      : isActive
                        ? 'border-primary/30 bg-primary/[0.03] shadow-sm ring-1 ring-primary/10'
                        : 'border-border/60 bg-card hover:border-border hover:shadow-sm'
                }`}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 rounded-lg shadow-sm">
                      {o.avatar_url && <AvatarImage src={o.avatar_url} alt={o.name} className="object-cover" />}
                      <AvatarFallback className="rounded-lg text-xs font-bold text-white" style={{ backgroundColor: entityColorHsl(o.id) }}>
                        {initials(o.name).slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold tracking-tight truncate text-foreground">{o.name}</span>
                    <span className="text-[11px] text-muted-foreground/70 truncate font-mono">@{o.slug}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/projects') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Projects"><FolderOpen size={12} /> {projCount}</button>
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/teams') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Teams"><UsersRound size={12} /> {teamCount}</button>
                  <button onClick={(e) => { e.stopPropagation(); d.setActiveOrgId(o.id); navigate('/workspace/members') }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Members"><Users size={12} /> {memberCount}</button>
                  {isActive && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {/* New Org card — inline form on desktop */}
          {inlineNewOrg ? (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.02] p-4 flex flex-col gap-3 min-h-[108px]">
              <form onSubmit={d.createOrg} className="flex flex-col gap-2">
                <Input
                  value={d.newOrgName}
                  onChange={(e) => { d.setNewOrgName(e.target.value); if (!d.newOrgSlug) d.setNewOrgSlug('') }}
                  placeholder="Organization name"
                  autoFocus
                  className="h-8 text-xs"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" className="h-7 px-3 text-[10px]">Create</Button>
                  <button
                    type="button"
                    onClick={() => { setInlineNewOrg(false); d.setNewOrgName(''); d.setNewOrgSlug('') }}
                    className="h-7 px-2 inline-flex items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setInlineNewOrg(true)}
              className="rounded-xl border-2 border-dashed border-border/50 p-4 cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-2 min-h-[108px]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50 transition-colors">
                <Plus size={16} />
              </div>
              <span className="text-xs font-medium text-muted-foreground/60">New Organization</span>
            </button>
          )}
        </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
