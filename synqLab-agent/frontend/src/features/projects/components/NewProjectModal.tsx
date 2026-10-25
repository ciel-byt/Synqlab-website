/**
 * NewProjectModal — Dialog for creating a new project.
 */
import { useState, useEffect, useRef } from 'react'
import { api } from '@/api/client'
import type { Org, Team, Project } from '@/features/projects/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const projectSchema = z.object({
  orgId: z.string().min(1, "Organization is required"),
  teamId: z.string().min(1, "Team is required"),
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  visibility: z.string()
})

type ProjectValues = z.infer<typeof projectSchema>

export interface NewProjectModalProps {
  orgs: Org[]
  teams: Record<string, Team[]>
  defaultOrgId?: string
  defaultTeamId?: string
  onCreated: (p: Project) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewProjectModal({ orgs, teams, defaultOrgId, defaultTeamId, onCreated, open, onOpenChange }: NewProjectModalProps) {
  const initialOrgId = defaultOrgId || orgs[0]?.id || ''
  const initialTeamId = defaultTeamId ?? ((teams[initialOrgId] ?? [])[0]?.id ?? '')

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      orgId: initialOrgId,
      teamId: initialTeamId,
      name: '',
      description: '',
      visibility: 'private',
    }
  })

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const watchOrgId = form.watch('orgId')
  const orgTeams = teams[watchOrgId] ?? []

  // Only reset form when dialog first opens (not on every parent re-render)
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      const oId = defaultOrgId || orgs[0]?.id || ''
      form.reset({
        orgId: oId,
        teamId: defaultTeamId ?? ((teams[oId] ?? [])[0]?.id ?? ''),
        name: '',
        description: '',
        visibility: 'private',
      })
      setError('')
      setCreating(false)
    }
    prevOpen.current = open
  }, [open])

  async function onSubmit(data: ProjectValues) {
    setCreating(true)
    setError('')
    try {
      const proj = await api.createProject({
        org_id: data.orgId,
        team_id: data.teamId,
        name: data.name.trim(),
        description: data.description || null,
        visibility: data.visibility,
      })
      onCreated(proj)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Create a new project in your organization.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="orgId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); form.setValue('teamId', (teams[v] ?? [])[0]?.id ?? '') }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orgTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {orgTeams.length === 0 && <p className="text-[11px] text-status-warn-text">Create a team first.</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. GFP11 Variant Design" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Briefly describe the goal…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select visibility" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="private">Private — only you and members</SelectItem>
                      <SelectItem value="team">Team — all team members</SelectItem>
                      <SelectItem value="org">Organization — all org members</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !form.formState.isValid}>
                {creating ? 'Creating…' : 'Create project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
