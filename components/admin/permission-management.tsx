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
import { cn } from '@/lib/utils'

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
    <div className="space-y-8">
      <div className="flex p-1.5 bg-muted/50 border border-border rounded-2xl w-fit backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
            activeTab === 'users'
              ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(140,43,238,0.4)]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Users size={14} strokeWidth={activeTab === 'users' ? 3 : 2} />
          <span>Personnel</span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={cn(
            "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
            activeTab === 'roles'
              ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(140,43,238,0.4)]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Zap size={14} strokeWidth={activeTab === 'roles' ? 3 : 2} />
          <span>Permissions</span>
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="glass-card !p-0 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-muted/30">
            <div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Active Team Personnel</h3>
              <p className="text-sm text-muted-foreground font-medium">Assign orchestrator roles and operational scopes.</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary-gradient h-11 px-6 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} strokeWidth={3} />
                  Initiate Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl glass-card border-border shadow-2xl !bg-background">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-foreground">Personnel Invitation</DialogTitle>
                </DialogHeader>
                <InviteUserForm teamId={teamId} />
              </DialogContent>
            </Dialog>
          </div>
          <div className="p-2 sm:p-6">
            <UserRoleManagement
              teamMembers={teamMembers}
              currentUserId={currentUserId}
              teamId={teamId}
            />
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="glass-card !p-0 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-border bg-muted">
            <h3 className="text-lg font-black text-foreground tracking-tight">Access Control Hierarchies</h3>
            <p className="text-sm text-muted-foreground font-medium">Engineer specialized roles with granular permission protocols.</p>
          </div>
          <div className="p-2 sm:p-6">
            <RoleManagement teamId={teamId} />
          </div>
        </div>
      )}
    </div>
  )
}
