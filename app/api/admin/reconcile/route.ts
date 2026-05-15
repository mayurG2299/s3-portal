import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { reconcileTeam, reconcileBucket } from '@/lib/s3-sync'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { teamId, bucketId } = body as { teamId?: string; bucketId?: string }

  const { teamId: targetTeamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: teamId,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })

  if (!targetTeamId) {
    return NextResponse.json({ message: 'Team not selected' }, { status: 400 })
  }
  try {
    await requireScreenPermission(session, targetTeamId, 'ADMIN_SETTINGS', 'EDIT')
  } catch (err) {
    return ApiResponse.forbidden()
  }

  if (bucketId) {
    const bucket = await prisma.awsBucket.findUnique({
      where: { id: bucketId },
      select: {
        credential: {
          select: { teamId: true },
        },
      },
    })

    if (!bucket || bucket.credential.teamId !== targetTeamId) {
      return ApiResponse.forbidden()
    }

    const res = await reconcileBucket(bucketId)
    return NextResponse.json({ ok: true, bucketId, result: res })
  }

  if (teamId) {
    const res = await reconcileTeam(teamId)
    return NextResponse.json({ ok: true, teamId, result: res })
  }

  return NextResponse.json({ message: 'teamId or bucketId required' }, { status: 400 })
}
