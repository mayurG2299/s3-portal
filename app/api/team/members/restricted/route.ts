// app/api/team/members/restricted/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const bucketId = searchParams.get('bucketId')

    if (!teamId || !bucketId) {
      return NextResponse.json({ error: 'teamId and bucketId are required' }, { status: 400 })
    }

    if (teamId.length > 128 || bucketId.length > 128) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const bucketExists = await prisma.awsBucket.count({
      where: { id: bucketId, credential: { teamId } },
    })
    if (!bucketExists) {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 })
    }

    // Non-admin members who have some bucket access but NOT this bucket
    const restrictedMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        role: { level: { lt: 50 } },
        bucketAccess: {
          none: { bucketId },
          some: {},
        },
      },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true } },
        bucketAccess: { select: { bucketId: true } },
      },
    })

    return NextResponse.json({ members: restrictedMembers })
  } catch (error) {
    console.error('Get restricted members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
