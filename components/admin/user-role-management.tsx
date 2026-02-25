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
    return <Crown className="h-4 w-4 text-yellow-600" />
  } else if (level >= 50 || roleName === 'ADMIN') {
    return <Shield className="h-4 w-4 text-blue-600" />
  } else {
    return <Eye className="h-4 w-4 text-gray-600" />
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
        title: 'Role updated',
        description: `User role changed successfully`,
      })

      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-4">
      {teamMembers.map((member) => {
        const isCurrentUser = member.userId === currentUserId
        const isOwner = member.role.level >= 100

        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getRoleIcon(member.role.name, member.role.level)}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {member.user.email}
                    {isCurrentUser && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  {member.user.name && (
                    <div className="text-sm text-gray-500">{member.user.name}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500 text-right max-w-xs">
                {member.role.description}
              </div>
              
              <Select
                value={member.role.id}
                onValueChange={(value) => updateUserRole(member.userId, member.id, value)}
                disabled={isCurrentUser || updating === member.id || loadingRoles}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles
                    .sort((a, b) => b.level - a.level)
                    .map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role.name, role.level)}
                          {role.name}
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      })}

      {teamMembers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No team members found. Invite users to get started.
        </div>
      )}
    </div>
  )
}
