'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { SCREENS } from '@/lib/screen-permissions'
import { Check, X, Eye, Edit } from 'lucide-react'

type TeamMemberWithUser = {
  id: string
  userId: string
  role: Role
  user: {
    id: string
    email: string
    name: string | null
  }
  screenPermissions: Array<{
    id: string
    screenName: string
    permissionLevel: string
  }>
}

type Props = {
  teamMembers: TeamMemberWithUser[]
  teamId: string
}

const SCREEN_GROUPS = {
  'Files': ['FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE'],
  'Credentials': ['CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE'],
  'Links': ['LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE'],
  'Team': ['TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE'],
  'Admin': ['ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS'],
}

export function ScreenPermissionMatrix({ teamMembers, teamId }: Props) {
  const [updating, setUpdating] = useState<string | null>(null)
  const { toast } = useToast()

  const getPermissionLevel = (member: TeamMemberWithUser, screenName: string) => {
    const permission = member.screenPermissions.find(p => p.screenName === screenName)
    return permission?.permissionLevel || null
  }

  const togglePermission = async (
    userId: string,
    screenName: string,
    currentLevel: string | null
  ) => {
    setUpdating(`${userId}-${screenName}`)
    
    try {
      let response
      
      if (currentLevel === null) {
        // Grant VIEW permission
        response = await fetch('/api/permissions/screens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            teamId,
            screenName,
            permissionLevel: 'VIEW',
          }),
        })
      } else if (currentLevel === 'VIEW') {
        // Upgrade to EDIT permission
        response = await fetch('/api/permissions/screens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            teamId,
            screenName,
            permissionLevel: 'EDIT',
          }),
        })
      } else {
        // Remove permission
        response = await fetch('/api/permissions/screens', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            teamId,
            screenName,
          }),
        })
      }

      if (!response.ok) {
        throw new Error('Failed to update permission')
      }

      toast({
        title: 'Permission updated',
        description: 'Screen permission has been updated successfully',
      })

      window.location.reload()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update permission',
        variant: 'destructive',
      })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <X className="h-4 w-4" />
          <span>No Access</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span>View Only</span>
        </div>
        <div className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          <span>Edit Access</span>
        </div>
      </div>

      {Object.entries(SCREEN_GROUPS).map(([groupName, screens]) => (
        <div key={groupName} className="space-y-2">
          <h3 className="font-semibold text-lg">{groupName}</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border border-border font-medium">Screen</th>
                  {teamMembers.map((member) => (
                    <th key={member.id} className="p-3 border border-border font-medium text-center min-w-[120px]">
                      <div className="text-sm">{member.user.email.split('@')[0]}</div>
                      <div className="text-xs text-muted-foreground font-normal">{member.role.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screens.map((screenKey) => {
                  const screenName = SCREENS[screenKey as keyof typeof SCREENS]
                  if (!screenName) return null

                  return (
                    <tr key={screenName} className="hover:bg-muted/50">
                      <td className="p-3 border border-border font-medium text-sm">
                        {screenKey.replace(/_/g, ' ')}
                      </td>
                      {teamMembers.map((member) => {
                        const level = getPermissionLevel(member, screenName)
                        const isUpdating = updating === `${member.userId}-${screenName}`

                        return (
                          <td key={member.id} className="p-3 border border-border text-center">
                            <Button
                              size="sm"
                              variant={level === 'EDIT' ? 'default' : level === 'VIEW' ? 'secondary' : 'ghost'}
                              onClick={() => togglePermission(member.userId, screenName, level)}
                              disabled={isUpdating}
                              className="w-20"
                            >
                              {isUpdating ? (
                                '...'
                              ) : level === 'EDIT' ? (
                                <Edit className="h-4 w-4" />
                              ) : level === 'VIEW' ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
