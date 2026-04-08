import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const requestedTeamId =
      searchParams.get('teamId') ||
      request.cookies.get('selectedTeamId')?.value?.trim() ||
      session?.user?.teamId ||
      null

    if (!session?.user?.id || !requestedTeamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = requestedTeamId
    const limitParam = searchParams.get('limit')
    const cursor = searchParams.get('cursor')
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const resourceType = searchParams.get('resourceType')
    const successParam = searchParams.get('success')

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    const role = await getUserRoleInTeam(session.user.id, teamId)
    if (!isOwner(role || undefined)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const limit = Math.min(Number(limitParam) || 50, 200)
    const where: any = { teamId }

    if (action) where.action = action
    if (userId) where.userId = userId
    if (resourceType) where.resourceType = resourceType
    if (successParam !== null) {
      if (successParam === 'true') where.success = true
      if (successParam === 'false') where.success = false
    }

    const logs = await prisma.accessLog.findMany({
      where,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } },
      },
    })

    const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null

    return NextResponse.json({ items: logs, nextCursor })
  } catch (error) {
    console.error('Audit log fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
