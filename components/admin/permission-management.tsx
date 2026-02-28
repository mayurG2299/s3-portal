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
      <div className="flex p-1.5 bg-slate-900/50 border border-white/10 rounded-2xl w-fit backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
            activeTab === 'users'
              ? "bg-gradient-to-r from-[#8c2bee] to-[#6a1bbf] text-white shadow-[0_0_15px_rgba(140,43,238,0.4)]"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
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
              ? "bg-gradient-to-r from-[#8c2bee] to-[#6a1bbf] text-white shadow-[0_0_15px_rgba(140,43,238,0.4)]"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <Zap size={14} strokeWidth={activeTab === 'roles' ? 3 : 2} />
          <span>Authority Matrix</span>
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="glass-card !p-0 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-900/20">
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Active Team Personnel</h3>
              <p className="text-sm text-slate-400 font-medium">Assign orchestrator roles and operational scopes.</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary-gradient h-11 px-6 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} strokeWidth={3} />
                  Initiate Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl glass-card border-white/10 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-white">Personnel Invitation</DialogTitle>
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
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-lg font-black text-white tracking-tight">Access Control Hierarchies</h3>
            <p className="text-sm text-slate-500 font-medium">Engineer specialized roles with granular permission protocols.</p>
          </div>
          <div className="p-2 sm:p-6">
            <RoleManagement teamId={teamId} />
          </div>
        </div>
      )}
    </div>
  )
}
