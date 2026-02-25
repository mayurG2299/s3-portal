import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'TEAM_INVITE_SEND',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { teamId, email, roleId } = await request.json()
    if (!teamId || !email || !roleId) {
      return NextResponse.json({ error: 'Team, email, and role are required' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'TEAM_INVITE_SEND',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'Only admins can invite users',
      })
      return NextResponse.json({ error: 'Only admins can invite users' }, { status: 403 })
    }

    const normalizedEmail = String(email).toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists. Add them directly to the team.' },
        { status: 400 }
      )
    }

    const pendingInvite = await prisma.teamInvite.findFirst({
      where: {
        teamId,
        email: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })

    if (pendingInvite) {
      return NextResponse.json({ error: 'Invite already sent' }, { status: 400 })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email: normalizedEmail,
        roleId,
        invitedById: session.user.id,
        status: 'PENDING',
        token: randomUUID(),
        expiresAt,
      },
    })

    await logUserAction({
      request,
      action: 'TEAM_INVITE_SEND',
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: 'teamInvite',
      resourceId: invite.id,
      metadata: { email: normalizedEmail, roleId },
    })

    return NextResponse.json({ inviteId: invite.id })
  } catch (error) {
    console.error('Send invite error:', error)
    await logUserAction({
      request,
      action: 'TEAM_INVITE_SEND',
      success: false,
      errorMessage: 'Failed to send invite',
    })
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
