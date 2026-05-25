import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createFileEventStream } from '@/lib/events/files'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const teamId = request.nextUrl.searchParams.get('teamId')
  if (!teamId) {
    return new Response('teamId is required', { status: 400 })
  }

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  })
  if (!member) {
    return new Response('Forbidden', { status: 403 })
  }

  const stream = createFileEventStream(teamId)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
