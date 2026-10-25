/**
 * OrgSettingsView — routed view for /workspace/settings.
 *
 * Explicit edit forms for org name, avatar, and delete.
 * No double-click, no right-click — all via buttons.
 */
import { useState } from 'react'
import { ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { useWorkspace } from '@/pages/WorkspacePage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials, formatDate } from '../helpers'
import { entityColorHsl } from '@/lib/entity-colors'

export function OrgSettingsView() {
  const d = useWorkspace()
  const org = d.activeOrg
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(org?.name ?? '')
  const [saving, setSaving] = useState(false)

  if (!org) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No organization selected</p>
      </div>
    )
  }

  async function handleSaveName() {
    const next = nameDraft.trim()
    if (!next || next === org!.name) {
      setEditingName(false)
      setNameDraft(org!.name)
      return
    }
    setSaving(true)
    try {
      await d.renameOrgInline(org!.id, next)
      setEditingName(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto flex flex-col h-full overflow-y-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Organization Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Manage your organization profile and preferences.</p>

      {/* Avatar section */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Avatar</h2>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-16 w-16 rounded-xl shadow-sm">
              {org.avatar_url && <AvatarImage src={org.avatar_url} alt={org.name} className="object-cover" />}
              <AvatarFallback className="rounded-xl text-xl font-bold text-white" style={{ backgroundColor: entityColorHsl(org.id) }}>
                {initials(org.name).slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{org.name}</p>
              <p className="text-xs text-muted-foreground">Recommended: 256×256px, PNG or JPG</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => d.triggerOrgAvatarUpload(org.id)}
            >
              <ImagePlus size={12} className="mr-1.5" /> Change avatar
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Name section */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Name</h2>
        <Card>
          <CardContent className="p-4">
            {editingName ? (
              <div className="flex items-center gap-3">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName()
                    if (e.key === 'Escape') { setEditingName(false); setNameDraft(org.name) }
                  }}
                  autoFocus
                  disabled={saving}
                  className="flex-1"
                />
                <Button size="sm" onClick={() => void handleSaveName()} loading={saving}>Save</Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditingName(false); setNameDraft(org.name) }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">@{org.slug} · {org.plan_tier} · Created {formatDate(org.created_at)}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setNameDraft(org.name); setEditingName(true) }}>
                  <Pencil size={12} className="mr-1.5" /> Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-destructive/70 mb-3">Danger Zone</h2>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete organization</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete {org.name} and all its teams, projects, and data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => d.setDeleteCtx({ kind: 'org', orgId: org.id, label: org.name })}
            >
              <Trash2 size={12} className="mr-1.5" /> Delete
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
