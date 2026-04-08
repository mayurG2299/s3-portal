import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createMembershipEventStream } from '@/lib/events/membership'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const stream = createMembershipEventStream(userId)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}