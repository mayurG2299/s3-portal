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
    if (level >= 100) return <Crown className="h-4 w-4 text-yellow-600" />
    if (level >= 50) return <Shield className="h-4 w-4 text-blue-600" />
    return <Eye className="h-4 w-4 text-gray-600" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">All Roles</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a custom role and assign screen permissions. Select which screens users with this role can access.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Developer, Accountant, Viewer"
                  required
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="What can users with this role do?"
                  required
                  disabled={creating}
                />
              </div>

              <div className="space-y-3">
                <Label>Screen Permissions</Label>
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg max-h-80 overflow-y-auto">
                  {Object.entries(SCREEN_OPTIONS).map(([category, screens]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">{category}</h4>
                      <div className="space-y-2 ml-4">
                        {screens.map(screen => {
                          const permission = screenPermissions.find(sp => sp.screen === screen)
                          return (
                            <div key={screen} className="flex items-center justify-between">
                              <label className="text-sm text-gray-600 flex-1">
                                {screen.replace(/_/g, ' ')}
                              </label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={permission?.level === 'VIEW'}
                                    onChange={() => toggleScreenPermission(screen, 'VIEW')}
                                    disabled={creating}
                                  />
                                  <span className="text-xs text-gray-600">Read</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={permission?.level === 'EDIT'}
                                    onChange={() => toggleScreenPermission(screen, 'EDIT')}
                                    disabled={creating}
                                  />
                                  <span className="text-xs text-gray-600">Write</span>
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

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Role'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              {getRoleIcon(role.level)}
              <div>
                <p className="font-medium">{role.name}</p>
                <p className="text-sm text-gray-600">{role.description}</p>
                <p className="text-xs text-gray-500">Level {role.level} {role.isSystem && '(System)'}</p>
              </div>
            </div>

            {!role.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteRole(role.id, role.name)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {roles.length === 0 && !loading && (
          <p className="text-center text-gray-500 py-8">No roles found</p>
        )}
      </div>
    </div>
  )
}
