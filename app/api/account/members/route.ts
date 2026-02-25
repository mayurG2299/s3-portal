import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = session.user.teamId
    const role = await getUserRoleInTeam(session.user.id, teamId)
    const owner = isOwner(role || undefined)

    type TeamMemberWithUser = Prisma.TeamMemberGetPayload<{
      include: { user: { select: { id: true; email: true; name: true; deletedAt: true } } }
    }>

    const members = (await prisma.teamMember.findMany({
      where: {
        teamId,
        userId: { not: session.user.id },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            deletedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })) as TeamMemberWithUser[]

    return NextResponse.json({
      teamId,
      isOwner: owner,
      members: members
        .filter((member) => !member.user.deletedAt)
        .map((member) => ({
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
        })),
    })
  } catch (error) {
    console.error('Account members error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
