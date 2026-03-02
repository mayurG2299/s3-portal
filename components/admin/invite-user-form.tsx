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
    if (level >= 100) return (
      <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
        <Crown size={10} strokeWidth={3} />
      </div>
    )
    if (level >= 50) return (
      <div className="h-6 w-6 rounded-lg bg-[#8c2bee]/10 border border-[#8c2bee]/20 flex items-center justify-center text-[#8c2bee]">
        <Shield size={10} strokeWidth={3} />
      </div>
    )
    return (
      <div className="h-6 w-6 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400">
        <Eye size={10} strokeWidth={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] items-end">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">Identity Endpoint (Email)</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#8c2bee] transition-colors">
              <Mail size={16} />
            </div>
            <Input
              id="email"
              type="email"
              placeholder="operator@system.io"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setLookupStatus('idle')
                setFoundUser(null)
              }}
              required
              className="h-12 pl-12 bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#8c2bee]/30 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={handleLookup}
          disabled={!email || loading}
          className="h-12 px-8 rounded-xl bg-slate-100 border-slate-200 dark:bg-white/5 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
        >
          {lookupStatus === 'checking' ? (
            <div className="h-4 w-4 border-2 border-slate-500 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
          ) : 'Check System'}
        </Button>
      </div>

      {lookupStatus === 'found' && foundUser && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 animate-fade-in shadow-[0_0_20px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-3 text-emerald-400">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <User size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Entity Recognized</p>
              <p className="text-sm font-bold">{foundUser.name || foundUser.email}</p>
            </div>
          </div>
        </div>
      )}

      {lookupStatus === 'member' && foundUser && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 animate-fade-in shadow-[0_0_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-center gap-3 text-amber-400">
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Redundant Operation</p>
              <p className="text-sm font-bold">{foundUser.name || foundUser.email} is already synced.</p>
            </div>
          </div>
        </div>
      )}

      {lookupStatus === 'not-found' && (
        <div className="rounded-2xl border border-[#8c2bee]/20 bg-[#8c2bee]/5 p-4 animate-fade-in shadow-[0_0_20px_rgba(140,43,238,0.05)]">
          <div className="flex items-center gap-3 text-[#8c2bee]">
            <div className="h-8 w-8 rounded-full bg-[#8c2bee]/10 flex items-center justify-center">
              <Mail size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">External Identity</p>
              <p className="text-sm font-bold">No records found. Protocol: System Invitation.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="role" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">Authority Archetype *</Label>
        <Select value={roleId} onValueChange={(value) => setRoleId(value)}>
          <SelectTrigger className="h-12 bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#8c2bee]/30">
            <SelectValue placeholder="Assign level" />
          </SelectTrigger>
          <SelectContent className="bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-white/10 backdrop-blur-xl">
            {roles.map(role => (
              <SelectItem key={role.id} value={role.id} className="focus:bg-slate-100 dark:focus:bg-white/10 rounded-lg p-2.5">
                <div className="flex items-center gap-3">
                  {getRoleIcon(role.level)}
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{role.name}</p>
                    <p className="text-[10px] font-medium text-slate-500 mt-1 italic">{role.description}</p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-white/5">
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
          className="flex-1 btn-primary-gradient h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {lookupStatus === 'found' ? <UserPlus size={16} strokeWidth={3} /> : <Mail size={16} strokeWidth={3} />}
              {lookupStatus === 'not-found' ? 'Transmit Invite' : 'Authorize Entrance'}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resetForm}
          className="h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-transparent"
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
