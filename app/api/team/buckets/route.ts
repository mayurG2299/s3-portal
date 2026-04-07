// app/api/team/buckets/route.ts
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
    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const credentials = await prisma.aWSCredential.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        region: true,
        buckets: {
          select: { id: true, bucket: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ credentials })
  } catch (error) {
    console.error('Fetch team buckets error:', error)
    return NextResponse.json({ error: 'Failed to fetch buckets' }, { status: 500 })
  }
}
