import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'ACCOUNT_DELETE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transferToUserId } = (await request.json().catch(() => ({}))) as {
      transferToUserId?: string
    }

    const ownedTeams = await prisma.team.findMany({
      where: { ownerId: session.user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    if (ownedTeams.length > 1) {
      return NextResponse.json(
        { error: 'You own multiple teams. Transfer or delete those teams before deleting your account.' },
        { status: 400 }
      )
    }

    const ownedTeamId = ownedTeams[0]?.id || null
    const teamId = ownedTeamId || request.cookies.get('selectedTeamId')?.value?.trim() || session.user.teamId || null
    const role = teamId ? await getUserRoleInTeam(session.user.id, teamId) : null
    const owner = ownedTeams.length === 1 || isOwner(role || undefined)

    if (owner && !transferToUserId) {
      return NextResponse.json(
        { error: 'Owner must transfer ownership before deletion.' },
        { status: 400 }
      )
    }

    if (owner) {
      if (transferToUserId === session.user.id) {
        return NextResponse.json(
          { error: 'Transfer target must be a different user.' },
          { status: 400 }
        )
      }

      const transferTeamId = ownedTeamId || teamId

      if (!transferTeamId) {
        return NextResponse.json(
          { error: 'No team available for ownership transfer.' },
          { status: 400 }
        )
      }

      const targetMember = await prisma.teamMember.findFirst({
        where: {
          teamId: transferTeamId,
          userId: transferToUserId,
        },
      })

      const targetUser = (await prisma.user.findUnique({
        where: { id: transferToUserId },
      })) as { deletedAt?: Date | null } | null

      if (!targetMember || targetUser?.deletedAt) {
        return NextResponse.json(
          { error: 'Transfer target must be a team member.' },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.team.update({
          where: { id: transferTeamId },
          data: { ownerId: transferToUserId },
        }),
        prisma.teamMember.update({
          where: { id: targetMember.id },
          data: { roleId: 'role_owner' },
        }),
        prisma.teamMember.updateMany({
          where: { teamId: transferTeamId, userId: session.user.id },
          data: { roleId: 'role_admin' },
        }),
      ])
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() },
    })

    await logUserAction({
      request,
      action: 'ACCOUNT_DELETE',
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: 'user',
      resourceId: session.user.id,
      metadata: { transferred: owner, transferToUserId: transferToUserId ?? null },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Account delete error:', error)
    await logUserAction({
      request,
      action: 'ACCOUNT_DELETE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
