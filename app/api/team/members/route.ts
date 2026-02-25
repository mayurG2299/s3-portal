import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam } from '@/lib/permissions'

// Add user to team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ADD',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { teamId, userId, roleId } = await request.json()

    // Default to viewer role if not specified
    const finalRoleId = roleId || 'role_viewer'

    // Verify admin access
    const hasAccess = await canManageTeam(session.user.id!, teamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ADD',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'Only admins can add team members',
      })
      return NextResponse.json(
        { error: 'Only admins can add team members' },
        { status: 403 }
      )
    }

    // Check if user already exists in team
    const existing = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
      },
    })

    if (existing) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ADD',
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: 'teamMember',
        resourceId: existing.id,
        errorMessage: 'User is already a member of this team',
      })
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      )
    }

    // Add user to team
    const member = await prisma.teamMember.create({
      data: {
        userId,
        teamId,
        roleId: finalRoleId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    await logUserAction({
      request,
      action: 'TEAM_MEMBER_ADD',
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: 'teamMember',
      resourceId: member.id,
      metadata: {
        addedUserId: userId,
        roleId: finalRoleId,
      },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Add team member error:', error)
    await logUserAction({
      request,
      action: 'TEAM_MEMBER_ADD',
      success: false,
      errorMessage: 'Failed to add team member',
    })
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    )
  }
}

// List team members
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID required' }, { status: 400 })
    }

    // Verify user is member of team
    const isMember = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        teamId,
      },
    })

    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      )
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        screenPermissions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('List team members error:', error)
    return NextResponse.json(
      { error: 'Failed to list team members' },
      { status: 500 }
    )
  }
}
