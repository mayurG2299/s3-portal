import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json() // 'accept' | 'decline'
    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'Action must be accept or decline' }, { status: 400 })
    }

    // Fetch the invite
    const invite = await prisma.teamInvite.findUnique({
      where: { id: params.id },
      include: {
        team: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Make sure this invite belongs to the current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })

    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({ error: 'This invite is not for you' }, { status: 403 })
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invite is no longer pending' }, { status: 400 })
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })
    }

    if (action === 'accept') {
      // Check not already a member
      const alreadyMember = await prisma.teamMember.findFirst({
        where: { userId: session.user.id, teamId: invite.teamId },
      })

      if (!alreadyMember) {
        await prisma.teamMember.create({
          data: {
            userId: session.user.id,
            teamId: invite.teamId,
            roleId: invite.roleId,
          },
        })
      }

      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      })

      await logUserAction({
        request,
        action: 'TEAM_INVITE_ACCEPT',
        success: true,
        userId: session.user.id,
        teamId: invite.teamId,
        resourceType: 'teamInvite',
        resourceId: invite.id,
        metadata: { teamName: invite.team.name, role: invite.role.name },
      })

      return NextResponse.json({ success: true, teamId: invite.teamId, teamName: invite.team.name })
    } else {
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'CANCELLED' },
      })

      await logUserAction({
        request,
        action: 'TEAM_INVITE_CANCEL',
        success: true,
        userId: session.user.id,
        teamId: invite.teamId,
        resourceType: 'teamInvite',
        resourceId: invite.id,
        metadata: { teamName: invite.team.name },
      })

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Invite action error:', error)
    return NextResponse.json({ error: 'Failed to process invite' }, { status: 500 })
  }
}
