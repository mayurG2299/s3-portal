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

  // Identify Role Title
  let roleTitle = 'Viewer'
  if (isOwner) roleTitle = 'Administrator'
  else if (isAdmin) roleTitle = 'Manager'

  const rawName = session.user.name || ''
  const displayName = rawName.length > 0 ? rawName : (session.user.email?.split('@')[0] || 'User')

  // Calculate Storage Quota and Usage
  let storageLimitBytes = 1099511627776 // Default 1TB (1024 * 1024 * 1024 * 1024)
  let storageUsedBytes = 0

  if (currentTeamId) {
    const quota = await prisma.storageQuota.findUnique({
      where: { teamId: currentTeamId }
    })
    if (quota && quota.limitBytes) {
      storageLimitBytes = Number(quota.limitBytes)
    }

    const usageResult = await prisma.file.aggregate({
      where: { teamId: currentTeamId },
      _sum: { size: true }
    })
    const storageUsedBytes = Number(usageResult._sum.size || 0)
  }

  // Fetch pending invite count for the badge
  const pendingInviteCount = await prisma.teamInvite.count({
    where: {
      email: session.user.email || '',
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  })

  return (
    <DashboardChrome 
      name={displayName}
      email={session.user.email || ''} 
      roleTitle={roleTitle}
      storageUsedBytes={storageUsedBytes}
      storageLimitBytes={storageLimitBytes}
      isAdmin={isAdmin} 
      isOwner={isOwner}
      teams={teams}
      currentTeamId={currentTeamId}
      pendingInviteCount={pendingInviteCount}
    >
      {children}
    </DashboardChrome>
  )
}
