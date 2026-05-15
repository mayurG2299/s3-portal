import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InviteUserForm } from '@/components/admin/invite-user-form'
import { PendingInvitesList } from '@/components/dashboard/PendingInvitesList'
import { UserRoleManagement } from '@/components/admin/user-role-management'
import { cn } from '@/lib/utils'
import { Users, Info, UserPlus, PlusCircle, Pencil } from 'lucide-react'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { DeleteTeamButton } from '@/components/dashboard/DeleteTeamButton'

async function updateTeamAction(formData: FormData) {
  'use server'

  const session = await requireUser()
  const teamId = String(formData.get('teamId') || '')
  const name = String(formData.get('name') || '').trim()

  if (!teamId || !name) return

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team || team.ownerId !== session.user.id) return

  await prisma.team.update({
    where: { id: teamId },
    data: { name },
  })

  await logUserAction({
    action: 'TEAM_UPDATE',
    success: true,
    userId: session.user.id,
    teamId,
    resourceType: 'team',
    resourceId: teamId,
    metadata: { name },
  })

  revalidatePath('/dashboard/teams')
}

async function deleteTeamAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  'use server'

  const session = await requireUser()
  const teamId = String(formData.get('teamId') || '')

  if (!teamId) return { error: 'Team ID is missing.' }

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team || team.ownerId !== session.user.id) return { error: 'You do not own this team.' }

  const [memberCount, credentialCount, fileCount] = await Promise.all([
    prisma.teamMember.count({ where: { teamId } }),
    prisma.aWSCredential.count({ where: { teamId } }),
    prisma.file.count({ where: { teamId } }),
  ])

  if (memberCount > 1 || credentialCount > 0 || fileCount > 0) {
    const reasons = [
      memberCount > 1 && `${memberCount} active members`,
      credentialCount > 0 && `${credentialCount} credentials`,
      fileCount > 0 && `${fileCount} files`,
    ]
      .filter(Boolean)
      .join(', ')
    return { error: `Cannot delete: team still has ${reasons}. Remove these first.` }
  }

  await prisma.team.delete({ where: { id: teamId } })

  await logUserAction({
    action: 'TEAM_DELETE',
    success: true,
    userId: session.user.id,
    teamId,
    resourceType: 'team',
    resourceId: teamId,
    metadata: { teamName: team.name },
  })

  revalidatePath('/dashboard/teams')
  return {}
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: Promise<{ teamId?: string }>
}) {
  const session = await requireUser()
  const cookieStore = await cookies()
  const resolvedSearchParams = (await searchParams) || {}
  const queryTeamId = resolvedSearchParams.teamId?.trim()
  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: queryTeamId,
    cookieTeamId: cookieStore.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })

  if (!teamId) {
    redirect('/dashboard')
  }

  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        select: { id: true, name: true, slug: true, ownerId: true },
      },
      role: {
        select: { name: true, level: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

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
      <div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
        <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
          Team <span className="gradient-text">Management</span>
        </h2>
        <p className="text-muted-foreground font-medium">
          Organize your workspace, manage roles and collaborate securely.
        </p>
        <div className="mt-4 flex items-center gap-2 justify-center lg:justify-start">
          <Button asChild className="h-9 rounded-xl">
            <Link href="/dashboard/teams/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Team
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Team Members */}
          <div className="glass-card !p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand-light">
                  <Users size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground tracking-tight">Active Members</h3>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Review and update member roles</p>
                </div>
              </div>
            </div>
            <div key={`members-${team.id}`} className="p-6">
              <UserRoleManagement
                teamMembers={team.members}
                currentUserId={session.user.id}
                teamId={team.id}
                ownerId={team.ownerId}
              />
            </div>
          </div>

          {/* Pending Invites */}
          <PendingInvitesList teamId={team.id} />

          {/* Invite Members */}
          <div className="glass-card !p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <UserPlus size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground tracking-tight">Invite Team Members</h3>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Add people to your team</p>
                </div>
              </div>
            </div>
            <div key={`invite-${team.id}`} className="p-6">
              <InviteUserForm teamId={team.id} />
            </div>
          </div>
        </div>

        <div className="space-y-8 lg:sticky lg:top-8 self-start animate-slide-up" style={{ animationDelay: '200ms' }}>
          {/* Team Info Sidebar */}
          <div className="glass-card !p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Info className="h-12 w-12 text-foreground" />
            </div>
            <h3 className="font-bold text-foreground tracking-tight mb-6 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Workspace Details
            </h3>

            <div className="space-y-6">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Team Identifier</Label>
                <div className="text-sm font-bold text-foreground tracking-tight bg-muted px-3 py-2 rounded-lg border border-border">{team.name}</div>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Team URL</Label>
                <div className="text-sm font-bold text-primary tracking-tight font-mono bg-primary/5 px-3 py-2 rounded-lg border border-primary/10">/{team.slug}</div>
              </div>

              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Administrator</Label>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-[10px] font-black text-white border-2 border-background ring-2 ring-border">
                    {team.owner?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground tracking-tight truncate">{team.owner?.name || 'Owner'}</p>
                    <p className="text-[10px] font-medium text-muted-foreground truncate">{team.owner?.email || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team Members</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{team.members.length} member{team.members.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Teams</h4>
                <div className="space-y-2">
                  {userTeams.map((membership) => {
                    const isActive = membership.team.id === team.id
                    return (
                      <div
                        key={membership.id}
                        className={cn(
                          'rounded-lg border px-3 py-2 flex items-center justify-between gap-2',
                          isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{membership.team.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{membership.role.name}</p>
                        </div>
                        {!isActive && (
                          <Button variant="outline" size="sm" asChild className="h-7 px-2 text-[10px]">
                            <Link href={`/dashboard/teams?teamId=${membership.team.id}`}>Manage</Link>
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {team.ownerId === session.user.id && (
                <div className="pt-4 border-t border-border space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team CRUD</h4>
                  <form action={updateTeamAction} className="space-y-2">
                    <input type="hidden" name="teamId" value={team.id} />
                    <input
                      name="name"
                      defaultValue={team.name}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
                      maxLength={100}
                      required
                    />
                    <Button type="submit" variant="outline" className="h-8 w-full text-[10px] font-black uppercase tracking-widest">
                      <Pencil className="mr-2 h-3 w-3" />
                      Update Team Name
                    </Button>
                  </form>

                  <DeleteTeamButton teamId={team.id} action={deleteTeamAction} />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Team delete is allowed only when this team has no files, no credentials, and no other members.
                  </p>
                </div>
              )}
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
