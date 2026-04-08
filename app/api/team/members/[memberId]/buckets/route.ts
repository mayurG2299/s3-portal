// app/api/team/members/[memberId]/buckets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from '@/types/next-route-context'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { setBucketAccess } from '@/lib/bucket-access'
import { logUserAction } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  context: RouteContext<{ memberId: string }>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { memberId } = await context.params
    // Step 1: minimal fetch to get teamId for auth
    const memberMeta = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, teamId: true },
    })
    if (!memberMeta) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Step 2: authorize
    const hasAccess = await canManageTeam(session.user.id, memberMeta.teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Step 3: fetch bucket access
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { bucketAccess: { select: { bucketId: true } } },
    })
    return NextResponse.json({ bucketIds: member!.bucketAccess.map((ba) => ba.bucketId) })
  } catch (error) {
    console.error('Get member bucket access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<{ memberId: string }>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { memberId } = await context.params
    const { bucketIds } = await request.json()
    if (!Array.isArray(bucketIds) || bucketIds.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'bucketIds must be an array of strings' }, { status: 400 })
    }
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, teamId: true },
    })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    const hasAccess = await canManageTeam(session.user.id, member.teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (bucketIds.length > 0) {
      const validCount = await prisma.awsBucket.count({
        where: { id: { in: bucketIds }, credential: { teamId: member.teamId } },
      })
      if (validCount !== bucketIds.length) {
        return NextResponse.json({ error: 'Invalid bucket IDs' }, { status: 400 })
      }
    }
    await setBucketAccess(memberId, bucketIds)

    await logUserAction({
      request,
      action: 'MEMBER_BUCKET_ACCESS_UPDATE',
      success: true,
      userId: session.user.id,
      teamId: member.teamId,
      resourceType: 'teamMember',
      resourceId: memberId,
      metadata: { bucketIds, bucketCount: bucketIds.length },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update member bucket access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
