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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tight mb-2">
          Access <span className="gradient-text">Permissions</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Control team synergy through precise role and screen access management.
        </p>
      </div>

      <div className="animate-slide-up">
        <PermissionManagement
          teamMembers={teamMembers}
          currentUserId={session.user.id!}
          teamId={session.user.teamId!}
        />
      </div>
    </div>
  )
}
