import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'
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

  const body = await request.json().catch(() => ({}))
  const { fileId } = body as { fileId?: string }

  if (fileId) {
    await prisma.fileEmbedding.update({
      where: { fileId },
      data: { status: 'PENDING', errorMessage: null },
    })
    await enqueueFileIndexing(fileId, 5)
    return NextResponse.json({ ok: true, requeued: 1 })
  }

  const failed = await prisma.fileEmbedding.findMany({
    where: { status: 'FAILED' },
    select: { fileId: true },
  })

  await prisma.fileEmbedding.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', errorMessage: null },
  })

  for (const { fileId: fid } of failed) {
    await enqueueFileIndexing(fid, 5)
  }

  return NextResponse.json({ ok: true, requeued: failed.length })
}
