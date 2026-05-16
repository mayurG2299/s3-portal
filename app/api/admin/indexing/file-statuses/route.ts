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

  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 200)
  if (ids.length === 0) return NextResponse.json({})

  const rows = await prisma.fileEmbedding.findMany({
    where: { fileId: { in: ids } },
    select: { fileId: true, status: true },
  })

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.fileId] = row.status
  }

  return NextResponse.json(result)
}
