import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InviteUserForm } from '@/components/admin/invite-user-form'
import { UserRoleManagement } from '@/components/admin/user-role-management'
import { cn } from '@/lib/utils'
import { Users, Info, UserPlus, ShieldAlert } from 'lucide-react'

export default async function TeamsPage() {
  const session = await requireUser()
  const teamId = session.user.teamId

  if (!teamId) {
    redirect('/dashboard')
  }

  const hasAccess = await canManageTeam(session.user.id, teamId)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          role: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!team) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 animate-fade-in text-center lg:text-left">
        <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight mb-2">
          Team <span className="gradient-text">Management</span>
        </h2>
        <p className="text-slate-400 font-medium">
          Organize your workspace, manage roles and collaborate securely.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Team Members */}
          <div className="glass-card !p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#8c2bee]/10 flex items-center justify-center text-[#b673ff]">
                  <Users size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-bold text-white tracking-tight">Active Members</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Review and update member roles</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <UserRoleManagement
                teamMembers={team.members}
                currentUserId={session.user.id}
                teamId={team.id}
              />
            </div>
          </div>

          {/* Invite Members */}
          <div className="glass-card !p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <UserPlus size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-bold text-white tracking-tight">Expand Workspace</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Add users and assign initial roles</p>
                </div>
              </div>
              <Button
                variant="ghost"
                asChild
                className="h-8 px-3 rounded-lg hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#b673ff] border border-white/5"
              >
                <Link href="/dashboard/admin/permissions">
                  <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                  Advanced Permissions
                </Link>
              </Button>
            </div>
            <div className="p-6">
              <InviteUserForm teamId={team.id} />
            </div>
          </div>
        </div>

        <div className="space-y-8 lg:sticky lg:top-8 self-start animate-slide-up" style={{ animationDelay: '200ms' }}>
          {/* Team Info Sidebar */}
          <div className="glass-card !p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Info className="h-12 w-12 text-white" />
            </div>
            <h3 className="font-bold text-white tracking-tight mb-6 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8c2bee]" />
              Workspace Details
            </h3>

            <div className="space-y-6">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Team Identifier</Label>
                <div className="text-sm font-bold text-white tracking-tight bg-white/5 px-3 py-2 rounded-lg border border-white/5">{team.name}</div>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Access Slug</Label>
                <div className="text-sm font-bold text-[#b673ff] tracking-tight font-mono bg-[#8c2bee]/5 px-3 py-2 rounded-lg border border-[#8c2bee]/10">/{team.slug}</div>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Administrator</Label>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#8c2bee] to-violet-500 flex items-center justify-center text-[10px] font-black text-white border-2 border-slate-900 ring-2 ring-white/5">
                    {team.owner?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white tracking-tight truncate">{team.owner?.name || 'Owner'}</p>
                    <p className="text-[10px] font-medium text-slate-500 truncate">{team.owner?.email || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Capacity Used</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{team.members.length} / UNLIMITED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={className}>{children}</span>
}
