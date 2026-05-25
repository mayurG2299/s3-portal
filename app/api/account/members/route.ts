import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownedTeams = await prisma.team.findMany({
      where: { ownerId: session.user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    const { teamId: effectiveTeamId } = await getResolvedUserTeamScope({
      userId: session.user.id,
      requestedTeamId: request.nextUrl.searchParams.get('teamId'),
      cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
      sessionTeamId: session.user.teamId,
    })

    if (!effectiveTeamId) {
      return NextResponse.json({
        teamId: null,
        isOwner: false,
        ownedTeamCount: ownedTeams.length,
        members: [],
      })
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: effectiveTeamId,
        userId: session.user.id,
      },
    })

    const ownsEffectiveTeam = ownedTeams.some((team) => team.id === effectiveTeamId)

    if (!membership && !ownsEffectiveTeam) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRoleInTeam(session.user.id, effectiveTeamId)
    const owner = isOwner(role || undefined)

    type TeamMemberWithUser = Prisma.TeamMemberGetPayload<{
      include: { user: { select: { id: true; email: true; name: true; deletedAt: true } } }
    }>

    const members = (await prisma.teamMember.findMany({
      where: {
        teamId: effectiveTeamId,
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
      teamId: effectiveTeamId,
      isOwner: owner,
      ownedTeamCount: ownedTeams.length,
      ownedTeams,
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
