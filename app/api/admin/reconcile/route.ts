import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { reconcileTeam, reconcileBucket } from '@/lib/s3-sync'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { teamId, bucketId } = body as { teamId?: string; bucketId?: string }

  // Require admin settings permission for the target team (body.teamId if provided)
  const targetTeamId = teamId || session.user.teamId!
  try {
    await requireScreenPermission(session, targetTeamId, 'ADMIN_SETTINGS', 'EDIT')
  } catch (err) {
    return ApiResponse.forbidden()
  }

  if (bucketId) {
    const res = await reconcileBucket(bucketId)
    return NextResponse.json({ ok: true, bucketId, result: res })
  }

  if (teamId) {
    const res = await reconcileTeam(teamId)
    return NextResponse.json({ ok: true, teamId, result: res })
  }

  return NextResponse.json({ message: 'teamId or bucketId required' }, { status: 400 })
}
