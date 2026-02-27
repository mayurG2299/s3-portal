import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { PermissionManagement } from '@/components/admin/permission-management'

export default async function PermissionsPage() {
  const session = await requireUser()

  // Only admins and owners can access this page
  const hasAccess = await canManageTeam(session.user.id!, session.user.teamId!)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  // Fetch team members with their permissions
  const teamMembers = await prisma.teamMember.findMany({
    where: {
      teamId: session.user.teamId!,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      role: true,
      screenPermissions: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Permission Management</h1>
        <p className="text-slate-500 mt-2">
          Manage user roles and screen-level permissions for your team
        </p>
      </div>

      <PermissionManagement 
        teamMembers={teamMembers} 
        currentUserId={session.user.id!}
        teamId={session.user.teamId!}
      />
    </div>
  )
}
