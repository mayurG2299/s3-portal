'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserRoleManagement } from './user-role-management'
import { RoleManagement } from './role-management'
import { InviteUserForm } from './invite-user-form'
import { Users, Zap, Plus } from 'lucide-react'

type TeamMemberWithUser = {
  id: string
  userId: string
  teamId: string
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
  currentUserId: string
  teamId: string
}

export function PermissionManagement({ teamMembers, currentUserId, teamId }: Props) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Users
        </Button>
        <Button
          variant={activeTab === 'roles' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('roles')}
          className="gap-2"
        >
          <Zap className="h-4 w-4" />
          Roles
        </Button>
      </div>

      {activeTab === 'users' && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Assign roles to team members. Use the Invite button to add new users to the team.
              </CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                </DialogHeader>
                <InviteUserForm teamId={teamId} />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <UserRoleManagement
              teamMembers={teamMembers}
              currentUserId={currentUserId}
              teamId={teamId}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Create custom roles with specific permissions. System roles (OWNER, ADMIN, VIEWER) cannot be deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleManagement teamId={teamId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
