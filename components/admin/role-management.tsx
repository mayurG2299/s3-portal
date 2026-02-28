'use client'

import { useState, useEffect } from 'react'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, Crown, Shield, Eye } from 'lucide-react'

type Props = {
  teamId: string
}

const SCREEN_OPTIONS = {
  'Files': ['FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE'],
  'Credentials': ['CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE'],
  'Links': ['LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE'],
  'Team': ['TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE'],
  'Admin': ['ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS'],
}

type ScreenPermission = {
  screen: string
  level: 'VIEW' | 'EDIT' | null
}

export function RoleManagement({ teamId }: Props) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [screenPermissions, setScreenPermissions] = useState<ScreenPermission[]>(
    Object.values(SCREEN_OPTIONS).flat().map(screen => ({ screen, level: null }))
  )
  const { toast } = useToast()

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(data)
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleScreenPermission = (screen: string, level: 'VIEW' | 'EDIT') => {
    setScreenPermissions(prev =>
      prev.map(sp => {
        if (sp.screen === screen) {
          // If clicking same level, toggle off; if different level, set to new level
          return { ...sp, level: sp.level === level ? null : level }
        }
        return sp
      })
    )
  }

  const handleCreateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    // Calculate level based on number of edit permissions
    const editCount = screenPermissions.filter(sp => sp.level === 'EDIT').length
    const level = Math.max(20, Math.min(80, 20 + editCount * 3)) // Range from 20-80

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, level }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create role')
      }

      const newRole = await res.json()

      // Create role permissions
      const permissionsToCreate = screenPermissions.filter(sp => sp.level !== null)
      if (permissionsToCreate.length > 0) {
        await Promise.all(
          permissionsToCreate.map(sp =>
            fetch('/api/roles/permissions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roleId: newRole.id,
                screenName: sp.screen,
                permissionLevel: sp.level,
              }),
            })
          )
        )
      }

      setRoles([...roles, newRole])
      setOpen(false)
      setScreenPermissions(
        Object.values(SCREEN_OPTIONS).flat().map(screen => ({ screen, level: null }))
      )
      ;(e.target as HTMLFormElement).reset()

      toast({
        title: 'Success',
        description: `Role "${name}" created with ${permissionsToCreate.length} screen permissions`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create role',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the "${roleName}" role?`)) {
      return
    }

    try {
      const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete role')
      }

      setRoles(roles.filter(r => r.id !== roleId))
      toast({
        title: 'Success',
        description: `Role "${roleName}" deleted successfully`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete role',
      })
    }
  }

  const getRoleIcon = (level: number) => {
    if (level >= 100) return (
      <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <Crown size={14} strokeWidth={3} />
      </div>
    )
    if (level >= 50) return (
      <div className="h-8 w-8 rounded-xl bg-[#8c2bee]/10 border border-[#8c2bee]/20 flex items-center justify-center text-[#8c2bee] shadow-[0_0_15px_rgba(140,43,238,0.1)]">
        <Shield size={14} strokeWidth={3} />
      </div>
    )
    return (
      <div className="h-8 w-8 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400">
        <Eye size={14} strokeWidth={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] shadow-[0_0_8px_rgba(140,43,238,0.5)]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Authority Definitions</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary-gradient h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} strokeWidth={3} />
              Engineer Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden glass-card border-white/10 shadow-2xl p-0 flex flex-col">
            <div className="p-6 border-b border-white/5 bg-white/[0.03]">
              <DialogTitle className="text-xl font-black text-white">Authority Archetype Creation</DialogTitle>
              <DialogDescription className="text-slate-500 text-xs font-medium mt-1">
                Configure permission parameters for specialized system roles.
              </DialogDescription>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Designation</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., ARCHITECT, AUDITOR"
                    required
                    className="h-12 bg-white/5 border-white/10 rounded-xl text-sm font-bold text-white focus:border-[#8c2bee]/30"
                    disabled={creating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Operational Scope</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Brief definition of role purpose"
                    required
                    className="h-12 bg-white/5 border-white/10 rounded-xl text-sm font-bold text-white focus:border-[#8c2bee]/30"
                    disabled={creating}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Permission Schematics</Label>
                <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl overflow-y-auto max-h-[40vh] custom-scrollbar">
                  {Object.entries(SCREEN_OPTIONS).map(([category, screens]) => (
                    <div key={category} className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <h4 className="text-[9px] font-black tracking-[0.2em] text-[#8c2bee] uppercase">{category} MODULES</h4>
                      <div className="space-y-3">
                        {screens.map(screen => {
                          const permission = screenPermissions.find(sp => sp.screen === screen)
                          return (
                            <div key={screen} className="flex items-center justify-between group/row">
                              <label className="text-[11px] font-bold text-slate-400 group-hover/row:text-slate-300 transition-colors uppercase tracking-tight">
                                {screen.replace(/_/g, ' ')}
                              </label>
                              <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer group/label">
                                  <Checkbox
                                    checked={permission?.level === 'VIEW'}
                                    onCheckedChange={() => toggleScreenPermission(screen, 'VIEW')}
                                    disabled={creating}
                                    className="border-white/20 bg-white/5 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#8c2bee] data-[state=checked]:to-[#6a1bbf] data-[state=checked]:border-[#8c2bee]"
                                  />
                                  <span className="text-[10px] font-black text-slate-500 group-hover/label:text-slate-300 uppercase tracking-widest">READ</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group/label">
                                  <Checkbox
                                    checked={permission?.level === 'EDIT'}
                                    onCheckedChange={() => toggleScreenPermission(screen, 'EDIT')}
                                    disabled={creating}
                                    className="border-white/20 bg-white/5 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#8c2bee] data-[state=checked]:to-[#6a1bbf] data-[state=checked]:border-[#8c2bee]"
                                  />
                                  <span className="text-[10px] font-black text-slate-500 group-hover/label:text-slate-300 uppercase tracking-widest">WRITE</span>
                                </label>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={creating}
                  className="h-11 px-6 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="btn-primary-gradient h-11 px-8 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl"
                >
                  {creating ? 'Engineering...' : 'Commit Protocol'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {roles.map((role, idx) => (
          <div
            key={role.id}
            className="group flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#8c2bee]/30 hover:bg-white/[0.04] transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${idx * 20}ms` }}
          >
            <div className="flex items-center gap-4">
              {getRoleIcon(role.level)}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-white tracking-tight leading-none uppercase">{role.name}</p>
                  {role.isSystem && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-[0.15em] text-slate-500">
                      System
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 italic leading-relaxed">{role.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-1 w-1 rounded-full bg-slate-700" />
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Authority Tier {role.level}</p>
                </div>
              </div>
            </div>

            {!role.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteRole(role.id, role.name)}
                className="h-9 w-9 rounded-xl text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 border border-white/0 hover:border-rose-500/20 transition-all"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        ))}

        {roles.length === 0 && !loading && (
          <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
              Zero authority archetypes detected.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
