import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ApiResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return ApiResponse.unauthorized()

  // 2. Fetch teams for the user
  try {
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return ApiResponse.success(teams)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return ApiResponse.error(message)
  }
}
