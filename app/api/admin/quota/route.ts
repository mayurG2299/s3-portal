import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { getQuotaForTeam, setQuotaLimit } from '@/lib/storage-quota'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: searchParams.get('teamId'),
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })

  if (!teamId) {
    return NextResponse.json({ message: 'Team not selected' }, { status: 400 })
  }

  try {
    await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'VIEW')
  } catch (err) {
    return ApiResponse.forbidden()
  }

  const quota = await prisma.storageQuota.findUnique({ where: { teamId } })
  if (quota) return NextResponse.json({ quota })

  const defaultQuota = await getQuotaForTeam(teamId)
  return NextResponse.json({ quota: defaultQuota })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: body.teamId,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })

  if (!teamId) {
    return NextResponse.json({ message: 'Team not selected' }, { status: 400 })
  }

  try {
    await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')
  } catch (err) {
    return ApiResponse.forbidden()
  }
  const limitBytes = body.limitBytes === null ? null : body.limitBytes

  if (limitBytes !== null && typeof limitBytes !== 'number' && typeof limitBytes !== 'bigint') {
    return NextResponse.json({ message: 'limitBytes must be a number or null' }, { status: 400 })
  }

  // Upsert quota
  const value = limitBytes === null ? null : BigInt(limitBytes)
  await setQuotaLimit(teamId, value as bigint | null)

  return NextResponse.json({ ok: true })
}
