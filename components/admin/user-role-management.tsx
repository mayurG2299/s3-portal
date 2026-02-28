'use client'

import { useState, useEffect } from 'react'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Shield, Crown, Eye } from 'lucide-react'

type TeamMemberWithUser = {
  id: string
  userId: string
  role: Role
  user: {
    id: string
    email: string
    name: string | null
  }
}

type Props = {
  teamMembers: TeamMemberWithUser[]
  currentUserId: string
  teamId: string
}

const getRoleIcon = (roleName: string, level: number) => {
  if (level >= 100 || roleName === 'OWNER') {
    return (
      <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        <Crown size={14} strokeWidth={3} />
      </div>
    )
  } else if (level >= 50 || roleName === 'ADMIN') {
    return (
      <div className="h-8 w-8 rounded-xl bg-[#8c2bee]/10 border border-[#8c2bee]/20 flex items-center justify-center text-[#8c2bee] shadow-[0_0_15px_rgba(140,43,238,0.1)]">
        <Shield size={14} strokeWidth={3} />
      </div>
    )
  } else {
    return (
      <div className="h-8 w-8 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400">
        <Eye size={14} strokeWidth={3} />
      </div>
    )
  }
}

export function UserRoleManagement({ teamMembers, currentUserId, teamId }: Props) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // Fetch all available roles
    fetch('/api/roles')
      .then(res => res.json())
      .then(data => {
        setAvailableRoles(data)
        setLoadingRoles(false)
      })
      .catch(err => {
        console.error('Failed to fetch roles:', err)
        setLoadingRoles(false)
      })
  }, [])

  const updateUserRole = async (userId: string, memberId: string, newRoleId: string) => {
    setUpdating(memberId)
    try {
      const response = await fetch('/api/team/members/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          userId,
          roleId: newRoleId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update role')
      }

      toast({
        title: 'Protocol Modified',
        description: `Authority level recalibrated successfully.`,
      })

      // Refresh the page
      window.location.reload()
    } catch (error) {
      toast({
        title: 'Sync Interrupted',
        description: error instanceof Error ? error.message : 'Failed to recalibrate role',
        variant: 'destructive',
      })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-3">
      {teamMembers.map((member, idx) => {
        const isCurrentUser = member.userId === currentUserId

        return (
          <div
            key={member.id}
            className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#8c2bee]/30 hover:bg-white/[0.04] transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${idx * 20}ms` }}
          >
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              {getRoleIcon(member.role.name, member.role.level)}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white tracking-tight">
                    {member.user.email}
                  </span>
                  {isCurrentUser && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#8c2bee]/20 border border-[#8c2bee]/30 text-[9px] font-black uppercase tracking-widest text-[#b673ff]">
                      You
                    </span>
                  )}
                </div>
                {member.user.name && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {member.user.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-8">
              <div className="hidden lg:block text-right max-w-[240px]">
                <p className="text-[10px] italic font-medium text-slate-500 leading-relaxed">
                  {member.role.description || "No security constraints defined."}
                </p>
              </div>
              
              <div className="relative w-full sm:w-auto">
                <Select
                  value={member.role.id}
                  onValueChange={(value) => updateUserRole(member.userId, member.id, value)}
                  disabled={isCurrentUser || updating === member.id || loadingRoles}
                >
                  <SelectTrigger className="w-full sm:w-44 h-10 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white focus:border-[#8c2bee]/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 backdrop-blur-xl">
                    {availableRoles
                      .sort((a, b) => b.level - a.level)
                      .map(role => (
                        <SelectItem key={role.id} value={role.id} className="text-xs font-bold text-slate-300 focus:bg-white/10 focus:text-white">
                          <div className="flex items-center gap-2.5">
                            {role.name}
                          </div>
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                {updating === member.id && (
                  <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-[#8c2bee]/30 border-t-[#8c2bee] rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {teamMembers.length === 0 && (
        <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            Collective database empty.
          </p>
        </div>
      )}
    </div>
  )
}
