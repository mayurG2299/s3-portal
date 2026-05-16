import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: request.nextUrl.searchParams.get('teamId'),
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'VIEW')

  const [total, indexed, pending, failed] = await Promise.all([
    prisma.file.count(),
    prisma.fileEmbedding.count({ where: { status: 'DONE' } }),
    prisma.fileEmbedding.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.fileEmbedding.count({ where: { status: 'FAILED' } }),
  ])

  return NextResponse.json({
    total,
    indexed,
    pending,
    failed,
    unindexed: total - indexed - pending - failed,
    percentComplete: total === 0 ? 100 : Math.round((indexed / total) * 100),
  })
}
