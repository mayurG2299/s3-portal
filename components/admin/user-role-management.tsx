'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { Shield, Crown, Eye, Lock, ShieldAlert, UserMinus } from 'lucide-react'
import { cn } from '@/lib/utils'

import { useSearchParams } from 'next/navigation'
import { BucketAccessManager } from '@/components/admin/BucketAccessManager'

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
  /** ID of the team's owner — their role row will be locked */
  ownerId?: string
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
      <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_hsl(var(--brand)/0.1)]">
        <Shield size={14} strokeWidth={3} />
      </div>
    )
  } else {
    return (
      <div className="h-8 w-8 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
        <Eye size={14} strokeWidth={3} />
      </div>
    )
  }
}

export function UserRoleManagement({ teamMembers, currentUserId, teamId, ownerId }: Props) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const highlightMemberId = searchParams.get('memberId')
  const [updating, setUpdating] = useState<string | null>(null)
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [accessDenied, setAccessDenied] = useState<string | null>(null)
  const { toast } = useToast()
  const { teamRemoved } = useTeamRemoved();

  // Caller's own role level – needed for filtering the dropdown and disabling rows
  const callerMember = teamMembers.find(m => m.userId === currentUserId)
  const callerLevel = callerMember?.role.level ?? 0

  useEffect(() => {
    // Fetch all available roles
    fetch(`/api/roles?teamId=${encodeURIComponent(teamId)}`)
      .then(res => res.json())
      .then(data => {
        setAvailableRoles(data)
        setLoadingRoles(false)
      })
      .catch(err => {
        console.error('Failed to fetch roles:', err)
        setLoadingRoles(false)
      })
  }, [teamId])

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

      const json = await response.json()

      if (!response.ok) {
        const errorMsg = json.error || json.message || 'Failed to update role'
        // 403 means a role-hierarchy violation — show the beautiful dialog
        if (response.status === 403) {
          setAccessDenied(errorMsg)
          return
        }
        throw new Error(errorMsg)
      }

      if (!teamRemoved) {
        const currentMember = teamMembers.find((m) => m.id === memberId)
        const oldLevel = currentMember?.role.level ?? 0
        const newRole = availableRoles.find((r) => r.id === newRoleId)
        const newLevel = newRole?.level ?? 0

        // Detect admin → restricted demotion: the user now has zero bucket access
        if (oldLevel >= 50 && newLevel < 50) {
          toast({
            title: 'Bucket access needed',
            description: 'This member was demoted to a restricted role and now has no bucket access. Configure it using the Bucket Access panel.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Protocol Modified',
            description: `Authority level recalibrated successfully.`,
          })
        }
      }

      // Refresh the page
      window.location.reload()
    } catch (error) {
      if (!teamRemoved) {
        toast({
          title: 'Sync Interrupted',
          description: error instanceof Error ? error.message : 'Failed to recalibrate role',
          variant: 'destructive',
        })
      }
    } finally {
      setUpdating(null)
    }
  }

  const removeMember = async (userId: string, memberId: string, email: string) => {
    if (!confirm(`Remove ${email} from this team?`)) return
    setUpdating(memberId)
    try {
      const response = await fetch(
        `/api/team/members?teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      )
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || json.message || 'Failed to remove member')
      }

      if (!teamRemoved) {
        toast({
          title: 'Member Removed',
          description: `${email} was removed from the team.`,
        })
      }
      window.location.reload()
    } catch (error) {
      if (!teamRemoved) {
        toast({
          title: 'Removal Failed',
          description: error instanceof Error ? error.message : 'Failed to remove member',
          variant: 'destructive',
        })
      }
    } finally {
      setUpdating(null)
    }
  }

  return (
    <>
      {/* Access Denied Beautiful Dialog */}
      <Dialog open={!!accessDenied} onOpenChange={() => setAccessDenied(null)}>
        <DialogContent className="sm:max-w-md glass-card !bg-background border-destructive/20">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
                <ShieldAlert size={40} strokeWidth={1.5} />
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-black text-foreground tracking-tight">
              Access Restricted
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground font-medium mt-1">
              {accessDenied}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-2">
            <Button
              onClick={() => setAccessDenied(null)}
              className="btn-primary-gradient h-10 px-8 rounded-xl font-black uppercase tracking-widest text-xs"
            >
              Understood
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {teamMembers.map((member, idx) => {
          const isCurrentUser = member.userId === currentUserId
          const isOwner = member.role.level >= 100 || member.userId === ownerId
          const isHighlighted = highlightMemberId === member.id

          // Row is locked if: it's you, it's the owner (and you're not the owner), or your level <= their level
          const isLocked = isCurrentUser || (isOwner && !isCurrentUser) || (callerLevel < 100 && member.role.level >= callerLevel && !isOwner)
          const canRemove = !isCurrentUser && !isOwner && !isLocked

          return (
            <div
              key={member.id}
              id={`member-${member.id}`}
              className={cn(
                "group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all duration-500 animate-fade-in",
                isOwner ? "bg-amber-500/5 border-amber-500/20 dark:border-amber-500/10" : "bg-muted/30 border-border hover:border-primary/50 hover:bg-muted/50",
                isHighlighted && "ring-2 ring-brand border-brand shadow-[0_0_20px_hsl(var(--brand)/0.2)] dark:shadow-[0_0_40px_hsl(var(--brand)/0.1)] bg-primary/[0.03] scale-[1.02] z-10"
              )}
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                {getRoleIcon(member.role.name, member.role.level)}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground tracking-tight">
                      {member.user.email}
                    </span>
                    {isCurrentUser && (
                      <span className="px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30 text-[9px] font-black uppercase tracking-widest text-primary">
                        You
                      </span>
                    )}
                    {isOwner && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                        <Lock size={8} strokeWidth={3} /> Owner
                      </span>
                    )}
                  </div>
                  {member.user.name && (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {member.user.name}
                    </p>
                  )}
                  <BucketAccessManager
                    member={member}
                    teamId={teamId}
                    currentUserId={currentUserId}
                    ownerId={ownerId ?? ''}
                  />
                </div>
              </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-8">
                <div className="hidden lg:block text-right max-w-[240px]">
                  <p className="text-[10px] italic font-medium text-muted-foreground/80 leading-relaxed">
                    {member.role.description || "No security constraints defined."}
                  </p>
                </div>

                <div className="relative w-full sm:w-auto">
                  {isOwner ? (
                    // Owner row is always visually locked
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-500">
                      <Lock size={12} strokeWidth={3} />
                      <span className="text-xs font-black uppercase tracking-widest">{member.role.name}</span>
                    </div>
                  ) : (
                      <Select
                        value={member.role.id}
                        onValueChange={(value) => updateUserRole(member.userId, member.id, value)}
                        disabled={isLocked || updating === member.id || loadingRoles}
                      >
                        <SelectTrigger className="w-full sm:w-44 h-10 bg-background border-border rounded-xl text-xs font-bold text-foreground focus:border-primary/50 disabled:opacity-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border backdrop-blur-xl">
                          {availableRoles
                            .filter(r => r.level < 100) // Never show OWNER in dropdown
                            .sort((a, b) => b.level - a.level)
                            .map(role => {
                              // Callers below 100 (Owner) can only grant roles strictly below their own level
                              const cantGrant = callerLevel < 100 && role.level >= callerLevel
                              return (
                                <SelectItem
                                  key={role.id}
                                  value={role.id}
                                  disabled={cantGrant}
                                  className="text-xs font-bold text-foreground/80 focus:bg-accent focus:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {role.name}
                                    {cantGrant && <span className="text-[9px] text-muted-foreground font-normal">(requires higher access)</span>}
                                  </div>
                                </SelectItem>
                              )
                            })
                          }
                        </SelectContent>
                      </Select>
                  )}
                  {updating === member.id && (
                    <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {canRemove && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-10 rounded-xl font-black uppercase tracking-widest text-[10px]"
                    disabled={updating === member.id}
                    onClick={() => removeMember(member.userId, member.id, member.user.email)}
                  >
                    <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )
        })}

        {teamMembers.length === 0 && (
          <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Collective database empty.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
