import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DashboardChrome } from '@/components/dashboard/dashboard-chrome'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireUser()

  const isOwner = session.user.roleId === 'role_owner'
  const isAdmin = isOwner || session.user.roleId === 'role_admin'

  // Fetch user's teams
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Get current team ID (from session or first team)
  const currentTeamId = session.user.teamId || teams[0]?.id

  return (
    <DashboardChrome 
      email={session.user.email || ''} 
      isAdmin={isAdmin} 
      isOwner={isOwner}
      teams={teams}
      currentTeamId={currentTeamId}
    >
      {children}
    </DashboardChrome>
  )
}
