'use client'

import { useState, useEffect } from 'react'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Shield, Crown, Eye, Mail, User, UserPlus } from 'lucide-react'

type Props = {
  teamId: string
}

export function InviteUserForm({ teamId }: Props) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'checking' | 'found' | 'not-found' | 'member'>('idle')
  const [foundUser, setFoundUser] = useState<{ id: string; email: string; name: string | null } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/roles')
        if (res.ok) {
          const data = await res.json()
          setRoles(data)
          const viewer = data.find((r: Role) => r.name === 'VIEWER')
          if (viewer) setRoleId(viewer.id)
        }
      } catch (err) {
        console.error('Failed to fetch roles:', err)
      }
    }
    fetchRoles()
  }, [])

  const handleLookup = async () => {
    if (!email) return
    setLoading(true)
    setLookupStatus('checking')
    setFoundUser(null)

    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(email)}&teamId=${teamId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to lookup user')
      }

      const data = await res.json()
      if (data.alreadyMember) {
        setLookupStatus('member')
        setFoundUser(data.user)
        return
      }

      if (data.user) {
        setLookupStatus('found')
        setFoundUser(data.user)
      } else {
        setLookupStatus('not-found')
      }
    } catch (error) {
      setLookupStatus('idle')
      toast({
        title: 'Lookup failed',
        description: error instanceof Error ? error.message : 'Failed to lookup user',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddExisting = async () => {
    if (!foundUser) return
    setLoading(true)

    try {
      const teamResponse = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, userId: foundUser.id, roleId }),
      })

      if (!teamResponse.ok) {
        const error = await teamResponse.json()
        throw new Error(error.error || 'Failed to add user to team')
      }

      const selectedRole = roles.find(r => r.id === roleId)
      toast({
        title: 'User added',
        description: `${foundUser.email} added as ${selectedRole?.name || 'member'}`,
      })

      resetForm()
      setTimeout(() => window.location.reload(), 800)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add user',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvite = async () => {
    if (!email) return
    setLoading(true)

    try {
      const inviteResponse = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, email, roleId }),
      })

      if (!inviteResponse.ok) {
        const error = await inviteResponse.json()
        throw new Error(error.error || 'Failed to send invite')
      }

      const selectedRole = roles.find(r => r.id === roleId)
      toast({
        title: 'Invite sent',
        description: `${email} invited as ${selectedRole?.name || 'member'}`,
      })

      resetForm()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invite',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setLookupStatus('idle')
    setFoundUser(null)
    const viewer = roles.find(r => r.name === 'VIEWER')
    if (viewer) setRoleId(viewer.id)
  }

  const getRoleIcon = (level: number) => {
    if (level >= 100) return <Crown className="h-4 w-4 text-yellow-600" />
    if (level >= 50) return <Shield className="h-4 w-4 text-blue-600" />
    return <Eye className="h-4 w-4 text-gray-600" />
  }

  return (
    <form className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setLookupStatus('idle')
                setFoundUser(null)
              }}
              required
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="invisible" htmlFor="check-email">Check</Label>
          <Button
            id="check-email"
            type="button"
            variant="outline"
            onClick={handleLookup}
            disabled={!email || loading}
            className="w-full"
          >
            {lookupStatus === 'checking' ? 'Checking...' : 'Check'}
          </Button>
        </div>
      </div>

      {lookupStatus === 'found' && foundUser && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <User className="h-4 w-4" />
            <span className="font-medium">User found:</span>
            <span>{foundUser.name || foundUser.email}</span>
          </div>
        </div>
      )}

      {lookupStatus === 'member' && foundUser && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <User className="h-4 w-4" />
            <span className="font-medium">Already a member:</span>
            <span>{foundUser.name || foundUser.email}</span>
          </div>
        </div>
      )}

      {lookupStatus === 'not-found' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Mail className="h-4 w-4" />
            <span className="font-medium">No account found.</span>
            <span>Send an invite to join this team.</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="role">Role *</Label>
        <Select value={roleId} onValueChange={(value) => setRoleId(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(role => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  {getRoleIcon(role.level)}
                  <div>
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          disabled={
            loading ||
            !roleId ||
            lookupStatus === 'checking' ||
            lookupStatus === 'idle' ||
            lookupStatus === 'member'
          }
          onClick={() => {
            if (lookupStatus === 'found') {
              handleAddExisting()
            } else if (lookupStatus === 'not-found') {
              handleSendInvite()
            }
          }}
        >
          {lookupStatus === 'found' && <UserPlus className="mr-2 h-4 w-4" />}
          {lookupStatus === 'not-found' ? 'Send Invite' : 'Add to Team'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={resetForm}
        >
          Clear
        </Button>
      </div>
    </form>
  )
}
