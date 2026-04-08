import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'
import { publishMembershipChanged } from "@/lib/events/membership";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const invites = await prisma.teamInvite.findMany({
      where: {
        email: user.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        role: { select: { id: true, name: true, description: true } },
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invites)
  } catch (error) {
    console.error('Fetch invites error:', error)
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 })
  }
}

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


    const { teamId, email, roleId: inputRoleId, bucketIds } = await request.json();
    if (!teamId || !email) {
      return NextResponse.json(
        { error: "Team and email are required" },
        { status: 400 },
      );
    }
    let roleId = inputRoleId;
    if (!roleId) {
      // Find ADMIN role
      const adminRole = await prisma.role.findUnique({
        where: { name: "ADMIN" },
      });
      if (!adminRole) {
        return NextResponse.json(
          { error: "ADMIN role not found" },
          { status: 500 },
        );
      }
      roleId = adminRole.id;
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

    // Validate role exists and enforce hierarchy — cannot invite to a role >= your own level
    const [inviterMembership, targetRole] = await Promise.all([
      prisma.teamMember.findFirst({
        where: { userId: session.user.id, teamId },
        select: { role: { select: { level: true } } },
      }),
      prisma.role.findUnique({ where: { id: roleId }, select: { level: true } }),
    ])
    if (!targetRole) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (!inviterMembership || targetRole.level >= inviterMembership.role.level) {
      return NextResponse.json(
        { error: 'Cannot invite to a role equal to or higher than your own' },
        { status: 403 }
      )
    }

    const normalizedBucketIds: string[] = [...new Set(Array.isArray(bucketIds) ? bucketIds : [])]
    if (normalizedBucketIds.length > 0) {
      const validCount = await prisma.awsBucket.count({
        where: {
          id: { in: normalizedBucketIds },
          credential: { teamId },
        },
      })
      if (validCount !== normalizedBucketIds.length) {
        return NextResponse.json(
          { error: 'One or more bucket IDs are invalid for this team' },
          { status: 400 }
        )
      }
    }

    const normalizedEmail = String(email).toLowerCase()

    // Check if user is already a member of the team
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      const alreadyMember = await prisma.teamMember.findFirst({
        where: { userId: existingUser.id, teamId },
      })
      if (alreadyMember) {
        return NextResponse.json({ error: 'User is already a member of this team.' }, { status: 400 })
      }
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
      return NextResponse.json({ error: 'Invite already sent to this email.' }, { status: 400 })
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
        inviteBucketIds: normalizedBucketIds,
      },
    })

    const invitedUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (invitedUser?.id) {
      publishMembershipChanged(invitedUser.id);
    }

    await logUserAction({
      request,
      action: 'TEAM_INVITE_SEND',
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: 'teamInvite',
      resourceId: invite.id,
      metadata: { email: normalizedEmail, roleId, bucketIds: normalizedBucketIds },
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
