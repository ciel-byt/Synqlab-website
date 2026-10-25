/**
 * Organization modals — uses shadcn Dialog + AlertDialog.
 */
import { type FormEvent } from 'react'
import { Check } from 'lucide-react'
import type { Member, Team, TeamMember } from '../types'
import { initials } from '../helpers'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

// ── Types for modal state ────────────────────────────────────────────────────

export interface NewOrgModalState {
  open: boolean
  name: string
  slug: string
  setName: (v: string) => void
  setSlug: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}

export interface NewTeamModalState {
  ctx: { orgId: string } | null
  name: string
  desc: string
  setName: (v: string) => void
  setDesc: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}

export interface InviteModalState {
  ctx: { orgId: string } | null
  email: string
  role: 'admin' | 'member' | 'guest'
  setEmail: (v: string) => void
  setRole: (v: 'admin' | 'member' | 'guest') => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}

export interface RenameModalState {
  ctx: { kind: 'org' | 'team'; current: string } | null
  value: string
  setValue: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}

export interface DeleteModalState {
  ctx: { kind: string; label: string } | null
  onConfirm: () => void
  onClose: () => void
}

export interface AddMemberModalState {
  ctx: { orgId: string; teamId: string } | null
  picks: string[]
  role: 'member' | 'lead'
  addableMembers: Member[]
  setPicks: (v: string[] | ((prev: string[]) => string[])) => void
  setRole: (v: 'member' | 'lead') => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}

export interface AssignTeamsModalState {
  ctx: { orgId: string; userId: string; userLabel: string } | null
  selected: string[]
  roles: Record<string, 'member' | 'lead'>
  saving: boolean
  teams: Team[]
  teamMembers: Record<string, TeamMember[]>
  setSelected: (v: string[] | ((prev: string[]) => string[])) => void
  setRoles: (v: Record<string, 'member' | 'lead'> | ((prev: Record<string, 'member' | 'lead'>) => Record<string, 'member' | 'lead'>)) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}


// ── Submit footer helper ─────────────────────────────────────────────────────

function FormFooter({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <DialogFooter className="pt-2">
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
      <Button type="submit" size="sm" disabled={disabled}>{submitLabel}</Button>
    </DialogFooter>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function OrgModals({
  newOrg,
  newTeam,
  invite,
  rename,
  del,
  addMember,
  assignTeams,
}: {
  newOrg: NewOrgModalState
  newTeam: NewTeamModalState
  invite: InviteModalState
  rename: RenameModalState
  del: DeleteModalState
  addMember: AddMemberModalState
  assignTeams: AssignTeamsModalState
}) {
  return (
    <>
      {/* New Org */}
      <Dialog open={newOrg.open} onOpenChange={(open) => { if (!open) newOrg.onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New organization</DialogTitle></DialogHeader>
          <form onSubmit={newOrg.onSubmit} className="space-y-4">
            <Input label="Name" value={newOrg.name} onChange={(e) => newOrg.setName(e.target.value)} placeholder="e.g. Acme Biotech" autoFocus />
            <Input
              label="Slug"
              value={newOrg.slug}
              onChange={(e) => newOrg.setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-biotech"
              hint="Used in URLs and invites. Letters, numbers, dashes only."
            />
            <FormFooter onCancel={newOrg.onClose} submitLabel="Create" />
          </form>
        </DialogContent>
      </Dialog>

      {/* New Team */}
      <Dialog open={!!newTeam.ctx} onOpenChange={(open) => { if (!open) newTeam.onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New team</DialogTitle></DialogHeader>
          <form onSubmit={newTeam.onSubmit} className="space-y-4">
            <Input label="Team name" value={newTeam.name} onChange={(e) => newTeam.setName(e.target.value)} placeholder="e.g. Wet Lab" autoFocus />
            <Input label="Description" value={newTeam.desc} onChange={(e) => newTeam.setDesc(e.target.value)} placeholder="Short purpose or focus (optional)" />
            <FormFooter onCancel={newTeam.onClose} submitLabel="Create team" />
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite */}
      <Dialog open={!!invite.ctx} onOpenChange={(open) => { if (!open) invite.onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invite to organization</DialogTitle></DialogHeader>
          <form onSubmit={invite.onSubmit} className="space-y-4">
            <Input
              label="Email (optional)"
              value={invite.email}
              onChange={(e) => invite.setEmail(e.target.value)}
              placeholder="person@company.com"
              hint="Leave blank to create a shareable link anyone can use."
              autoFocus
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['guest', 'member', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => invite.setRole(r)}
                    className={`rounded-md border px-3 py-1.5 text-xs capitalize transition ${invite.role === r
                      ? 'border-foreground bg-foreground text-white'
                      : 'border-border text-foreground/80 hover:bg-surface'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <FormFooter onCancel={invite.onClose} submitLabel="Create invite" />
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!rename.ctx} onOpenChange={(open) => { if (!open) rename.onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename {rename.ctx?.kind}</DialogTitle></DialogHeader>
          <form onSubmit={rename.onSubmit} className="space-y-4">
            <Input label="Name" value={rename.value} onChange={(e) => rename.setValue(e.target.value)} autoFocus />
            <FormFooter onCancel={rename.onClose} submitLabel="Save" />
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member to team */}
      <Dialog open={!!addMember.ctx} onOpenChange={(open) => { if (!open) addMember.onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add member to team</DialogTitle></DialogHeader>
          <form onSubmit={addMember.onSubmit} className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">Select members</label>
                {addMember.addableMembers.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => addMember.setPicks(addMember.addableMembers.map((m) => m.user_id))} className="rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface">Select all</button>
                    <button type="button" onClick={() => addMember.setPicks([])} className="rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface">Clear</button>
                  </div>
                )}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-surface/40 p-1">
                {addMember.addableMembers.map((m) => {
                  const picked = addMember.picks.includes(m.user_id)
                  return (
                    <button
                      type="button"
                      key={m.user_id}
                      onClick={() => addMember.setPicks((prev) => picked ? prev.filter((id) => id !== m.user_id) : [...prev, m.user_id])}
                      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-xs transition ${picked ? 'bg-foreground text-white' : 'hover:bg-card'}`}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${picked ? 'border-white/80 bg-card/15 text-white' : 'border-border bg-card text-transparent'}`}>
                        <Check size={10} />
                      </span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white bg-foreground/60 dark:bg-foreground/40">
                        {initials(m.full_name || m.email)}
                      </span>
                      <span className="flex-1 truncate">{m.full_name || m.email}</span>
                      <span className={picked ? 'text-white/70' : 'text-muted-foreground/70'}>{m.role}</span>
                    </button>
                  )
                })}
                {addMember.addableMembers.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground/70">All organization members are already in this team.</div>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{addMember.picks.length} selected</div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['member', 'lead'] as const).map((r) => (
                  <button key={r} type="button" onClick={() => addMember.setRole(r)} className={`rounded-md border px-3 py-1.5 text-xs capitalize transition ${addMember.role === r ? 'border-foreground bg-foreground text-white' : 'border-border text-foreground/80 hover:bg-surface'}`}>{r}</button>
                ))}
              </div>
            </div>
            <FormFooter onCancel={addMember.onClose} submitLabel={addMember.picks.length > 1 ? `Add ${addMember.picks.length} members` : 'Add to team'} disabled={addMember.picks.length === 0} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign teams */}
      <Dialog open={!!assignTeams.ctx} onOpenChange={(open) => { if (!open && !assignTeams.saving) assignTeams.onClose() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Assign teams · {assignTeams.ctx?.userLabel}</DialogTitle></DialogHeader>
          <form onSubmit={assignTeams.onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Select teams</label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border bg-surface/40 p-1">
                {assignTeams.teams.map((team) => {
                  const membersInTeam = assignTeams.teamMembers[team.id] ?? []
                  const alreadyInTeam = membersInTeam.some((tm) => tm.user_id === assignTeams.ctx!.userId)
                  const picked = assignTeams.selected.includes(team.id)
                  const rowRole = assignTeams.roles[team.id] ?? 'member'
                  return (
                    <label key={team.id} className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-xs ${alreadyInTeam ? 'opacity-60' : 'cursor-pointer hover:bg-card'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-slate-900"
                        disabled={alreadyInTeam}
                        checked={picked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            assignTeams.setSelected((prev) => [...prev, team.id])
                            assignTeams.setRoles((prev) => ({ ...prev, [team.id]: prev[team.id] ?? 'member' }))
                          } else {
                            assignTeams.setSelected((prev) => prev.filter((id) => id !== team.id))
                          }
                        }}
                      />
                      <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-white bg-foreground/60 dark:bg-foreground/40">{initials(team.name).slice(0, 2)}</span>
                      <span className="flex-1 truncate text-foreground/80">{team.name}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={!picked || alreadyInTeam} onClick={(e) => { e.preventDefault(); e.stopPropagation(); assignTeams.setRoles((prev) => ({ ...prev, [team.id]: 'member' })) }} className={`rounded border px-2 py-0.5 text-[10px] ${rowRole === 'member' ? 'border-foreground bg-foreground text-white' : 'border-border bg-card text-muted-foreground'} disabled:opacity-40`}>Member</button>
                        <button type="button" disabled={!picked || alreadyInTeam} onClick={(e) => { e.preventDefault(); e.stopPropagation(); assignTeams.setRoles((prev) => ({ ...prev, [team.id]: 'lead' })) }} className={`rounded border px-2 py-0.5 text-[10px] ${rowRole === 'lead' ? 'border-foreground bg-foreground text-white' : 'border-border bg-card text-muted-foreground'} disabled:opacity-40`}>Lead</button>
                      </div>
                      <span className="text-muted-foreground/70">{alreadyInTeam ? 'Already in team' : `${team.member_count} members`}</span>
                    </label>
                  )
                })}
                {assignTeams.teams.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground/70">No teams available in this organization.</div>
                )}
              </div>
            </div>
            <FormFooter onCancel={assignTeams.onClose} submitLabel={assignTeams.saving ? 'Assigning…' : 'Assign teams'} disabled={assignTeams.saving || assignTeams.selected.length === 0} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!del.ctx} onOpenChange={(open) => { if (!open) del.onClose() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {del.ctx?.kind === 'org' && <>You are about to delete the organization <strong>{del.ctx.label}</strong>. This cannot be undone.</>}
              {del.ctx?.kind === 'team' && <>Delete team <strong>{del.ctx?.label}</strong>? Projects assigned to this team will become unassigned.</>}
              {del.ctx?.kind === 'member' && <>Remove <strong>{del.ctx?.label}</strong> from the organization?</>}
              {del.ctx?.kind === 'invite' && <>Revoke invite for <strong>{del.ctx?.label}</strong>? The invite link will no longer work.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del.onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.ctx?.kind === 'invite' ? 'Revoke' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
