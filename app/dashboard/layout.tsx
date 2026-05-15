import { TeamRemovedModalClient } from '@/components/TeamRemovedModalClient'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveActiveTeamId } from '@/lib/active-team'
import { DashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { DashboardProvider } from '@/lib/contexts/dashboard-context'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireUser('dashboard/layout')
  const cookieStore = await cookies()

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

  // Get selections from cookies or defaults
  const cookieTeamId = cookieStore.get('selectedTeamId')?.value
  const currentTeamId = resolveActiveTeamId(teams, cookieTeamId, session.user.teamId)
  const initialIdentityId = cookieStore.get('selectedIdentityId')?.value
  const initialBucketId = cookieStore.get('selectedBucketId')?.value

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

    // Narrow usage results based on selected identity/bucket if present
    // Note: For now, the layout stats still reflect team-wide totals unless we want to filter them globally.
    // The implementation plan says "Refactor Dashboard stats to respect selection". 
    // I will add the filtering logic here as well.

    const usageWhere: any = { teamId: currentTeamId }
    if (initialIdentityId) usageWhere.credentialId = initialIdentityId
    if (initialBucketId) usageWhere.bucketId = initialBucketId

    const usageResult = await prisma.file.aggregate({
      where: usageWhere,
      _sum: { size: true }
    })
    storageUsedBytes = Number(usageResult._sum.size || 0)
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
    <DashboardProvider
      initialTeams={teams}
      initialTeamId={currentTeamId}
      initialIdentityId={initialIdentityId}
      initialBucketId={initialBucketId}
    >
      <TeamRemovedModalClient />
      <DashboardErrorBoundary>
        <DashboardChrome
          name={displayName}
          email={session.user.email || ''}
          roleTitle={roleTitle}
          storageUsedBytes={storageUsedBytes}
          storageLimitBytes={storageLimitBytes}
          initialTeams={teams}
          currentTeamId={currentTeamId}
          pendingInviteCount={pendingInviteCount}
        >
          {children}
        </DashboardChrome>
      </DashboardErrorBoundary>
    </DashboardProvider>
  )
}
