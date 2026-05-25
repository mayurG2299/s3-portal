import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ApiResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return ApiResponse.unauthorized()

  try {
    const { name, slug } = await request.json()

    if (!name || !slug) return ApiResponse.error('Name and slug are required', 400)
    if (!/^[a-z0-9-]+$/.test(slug)) return ApiResponse.error('Slug must contain only lowercase letters, numbers, and hyphens', 400)

    const existing = await prisma.team.findUnique({ where: { slug } })
    if (existing) return ApiResponse.error('Team slug already exists', 409)

    const team = await prisma.team.create({
      data: { name, slug, ownerId: session.user.id },
    })

    const ownerRole = await prisma.role.findUnique({ where: { name: 'OWNER' } })
    if (ownerRole) {
      await prisma.teamMember.create({
        data: { userId: session.user.id, teamId: team.id, roleId: ownerRole.id },
      })
    }

    return ApiResponse.success({ id: team.id, name: team.name, slug: team.slug })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return ApiResponse.error(message)
  }
}

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
