import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { fileIndexingQueue } from '@/lib/indexing/queue'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')

  if (!fileIndexingQueue) return NextResponse.json({ message: 'Queue not configured (no REDIS_URL)' }, { status: 503 })

  await fileIndexingQueue.resume()
  return NextResponse.json({ ok: true, paused: false })
}
