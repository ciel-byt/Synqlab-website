import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Settings, Trash2, UserCircle2, User, Lock, Link2, Sparkles, Palette, Check } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useTheme, THEME_PRESETS, type ThemePreset } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/initials'

import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

// ── Sidebar sections ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'profile',    label: 'Profile',    icon: User },
  { id: 'links',      label: 'Links',      icon: Link2 },
  { id: 'security',   label: 'Security',   icon: Lock },
  { id: 'appearance', label: 'Appearance', icon: Palette },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

// ── Density picker (needs own state to re-render on click) ───────────────────

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', desc: 'Dense, less whitespace' },
  { value: 'default', label: 'Default', desc: 'Balanced' },
  { value: 'comfortable', label: 'Comfortable', desc: 'More space' },
] as const

function DensityPicker() {
  const [density, setDensity] = useState(() =>
    (typeof window !== 'undefined' ? localStorage.getItem('synqlab-ws-density') : null) ?? 'default'
  )
  return (
    <div className="flex gap-2">
      {DENSITY_OPTIONS.map((opt) => {
        const isActive = density === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setDensity(opt.value)
              localStorage.setItem('synqlab-ws-density', opt.value)
              document.documentElement.setAttribute('data-density', opt.value)
            }}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-left transition-all',
              isActive
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-card hover:border-muted-foreground/30',
            )}
          >
            <p className={cn('text-xs font-medium', isActive ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const { preset, setPreset } = useTheme()
  const [activeSection, setActiveSection] = useState<SectionId>('profile')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [professionalTitle, setProfessionalTitle] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [scholarUrl, setScholarUrl] = useState('')
  const [skills, setSkills] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name || '')
    setEmail(user.email || '')
    setProfessionalTitle(user.professional_title || '')
    setShortBio(user.short_bio || '')
    setLinkedinUrl(user.linkedin_url || '')
    setScholarUrl(user.scholar_url || '')
    setSkills(user.skills || '')
  }, [user])

  async function saveProfile(ev: FormEvent) {
    ev.preventDefault()
    if (newPassword && newPassword !== confirmNewPassword) {
      setStatus('New password confirmation does not match.')
      return
    }
    if ((email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase() || newPassword) && !currentPassword) {
      setStatus('Current password is required to change email or password.')
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      await updateProfile({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
        professional_title: professionalTitle.trim() || null,
        short_bio: shortBio.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        scholar_url: scholarUrl.trim() || null,
        skills: skills.trim() || null,
      })
      setStatus('Saved ✓')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (error) {
      setStatus((error as Error).message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  async function removeImage() {
    setSaving(true)
    setStatus(null)
    try {
      await updateProfile({ avatar_url: null })
      setStatus('Image removed')
    } catch (error) {
      setStatus((error as Error).message || 'Could not remove image')
    } finally {
      setSaving(false)
    }
  }

  async function onAvatarFileSelected(file: File | null) {
    if (!file) return
    setUploading(true)
    setStatus(null)
    try {
      await uploadAvatar(file)
      setStatus('Image uploaded ✓')
    } catch (error) {
      setStatus((error as Error).message || 'Could not upload image')
    } finally {
      setUploading(false)
    }
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const sidebar = (
    <PageSidebar
      title="Settings"
      actions={
        <Settings size={14} className="text-muted-foreground" />
      }
    >
      {/* Avatar preview in sidebar */}
      <div className="px-4 py-3 flex flex-col items-center gap-2 border-b border-border">
        <Avatar className="h-14 w-14">
          {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user?.full_name} />}
          <AvatarFallback className="text-sm">{initials(user?.full_name, { fallback: 'U' })}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <div key={s.id}>
              <button
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all text-[12px]',
                  activeSection === s.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-foreground/70 hover:bg-sidebar-accent/50',
                )}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="font-medium">{s.label}</span>
              </button>
            </div>
          )
        })}
      </div>
    </PageSidebar>
  )

  // ── Main content ─────────────────────────────────────────────────────────

  return (
    <ModularPageLayout sidebar={sidebar}>
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={saveProfile} className="max-w-2xl space-y-6">

          {/* Profile section */}
          {activeSection === 'profile' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Profile</h2>
                <p className="text-xs text-muted-foreground">Manage your personal information</p>
              </div>

              <Separator />

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative rounded-full"
                  title="Change profile photo"
                >
                  <Avatar className="h-16 w-16">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="Profile" />}
                    <AvatarFallback>
                      <UserCircle2 size={26} className="text-muted-foreground/70" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 hidden items-center justify-center rounded-full bg-foreground/50 text-[10px] font-medium text-white group-hover:flex">
                    Change
                  </div>
                </button>
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <div className="font-medium text-foreground/80">Profile image</div>
                  <div>Click the avatar to upload a new image.</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeImage}
                    disabled={saving || uploading || !user?.avatar_url}
                    className="h-7 gap-1 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 size={11} />
                    Remove
                  </Button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => onAvatarFileSelected(e.target.files?.[0] ?? null)}
                />
              </div>

              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lab.org"
                hint="Changing email requires current password"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Professional title"
                  value={professionalTitle}
                  onChange={(e) => setProfessionalTitle(e.target.value)}
                  placeholder="e.g. Computational Biology Researcher"
                />
                <Input
                  label="Skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. Protein design, MD simulation, ML"
                  hint="Comma-separated"
                />
              </div>

              <Textarea
                label="Short bio"
                value={shortBio}
                onChange={(e) => setShortBio(e.target.value)}
                placeholder="A concise summary of your research interests and expertise."
                hint="Shown in People hover profile cards"
                rows={3}
              />
            </>
          )}

          {/* Links section */}
          {activeSection === 'links' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Links</h2>
                <p className="text-xs text-muted-foreground">External profile links visible to your team</p>
              </div>

              <Separator />

              <Input
                label="LinkedIn URL"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
              />

              <Input
                label="Google Scholar URL"
                value={scholarUrl}
                onChange={(e) => setScholarUrl(e.target.value)}
                placeholder="https://scholar.google.com/citations?user=..."
              />
            </>
          )}

          {/* Security section */}
          {activeSection === 'security' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Security</h2>
                <p className="text-xs text-muted-foreground">Update your password</p>
              </div>

              <Separator />

              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required for sensitive changes"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>
            </>
          )}

          {/* Appearance section */}
          {activeSection === 'appearance' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Appearance</h2>
                <p className="text-xs text-muted-foreground">Customize the look and feel of SynqLab</p>
              </div>

              <Separator />


              {/* Theme preset picker */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">Color Theme</label>
                <div className="grid grid-cols-4 gap-3">
                  {THEME_PRESETS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreset(t.id as ThemePreset)}
                      className={cn(
                        'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all',
                        preset === t.id
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50',
                      )}
                    >
                      {preset === t.id && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check size={12} />
                        </span>
                      )}
                      <span
                        className="h-8 w-8 rounded-full border border-border/50 shadow-sm"
                        style={{ background: `hsl(${t.hue})` }}
                      />
                      <span className="text-[11px] font-medium text-foreground/80">{t.label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Border radius */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">Border Radius</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="16"
                    step="2"
                    defaultValue="8"
                    onChange={(e) => {
                      document.documentElement.style.setProperty('--radius', `${e.target.value}px`)
                      document.documentElement.style.setProperty('--radius-sm', `${Math.max(2, Number(e.target.value) - 2)}px`)
                      document.documentElement.style.setProperty('--radius-lg', `${Number(e.target.value) + 4}px`)
                    }}
                    className="flex-1 accent-primary"
                  />
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-[var(--radius-sm)] border-2 border-primary/40 bg-primary/10" />
                    <div className="h-8 w-8 rounded-[var(--radius)] border-2 border-primary/40 bg-primary/10" />
                    <div className="h-8 w-8 rounded-[var(--radius-lg)] border-2 border-primary/40 bg-primary/10" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Adjusts corner rounding across all components</p>
              </div>

              <Separator />

              {/* Table density */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">Table Density</label>
                <DensityPicker />
              </div>
            </>
          )}

          <Separator />

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {status && (
                <span className={cn(
                  status.includes('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                )}>
                  {status}
                </span>
              )}
            </div>
            <Button
              type="submit"
              disabled={saving || uploading}
              size="sm"
            >
              <Sparkles size={12} />
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </form>
      </div>
    </ModularPageLayout>
  )
}
