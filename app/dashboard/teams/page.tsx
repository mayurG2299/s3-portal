import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InviteUserForm } from '@/components/admin/invite-user-form'
import { UserRoleManagement } from '@/components/admin/user-role-management'

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
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <p className="text-muted-foreground mt-2">
          Manage your team, invite members, and adjust roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Details</CardTitle>
          <CardDescription>Primary team information for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Team Name</div>
            <div className="text-base font-medium">{team.name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Team Slug</div>
            <div className="text-base font-medium">{team.slug}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Owner</div>
            <div className="text-base font-medium">
              {team.owner?.name || 'Owner'} ({team.owner?.email || 'Unknown'})
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Members</div>
            <div className="text-base font-medium">{team.members.length}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Invite Members</CardTitle>
            <CardDescription>Add users and assign initial roles.</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/admin/permissions">Advanced Permissions</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <InviteUserForm teamId={team.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Review and update member roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserRoleManagement
            teamMembers={team.members}
            currentUserId={session.user.id}
            teamId={team.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
