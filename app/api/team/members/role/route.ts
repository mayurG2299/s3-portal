import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam, getUserRoleInTeam } from '@/lib/permissions'

// Update user role in team
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { teamId, userId, roleId } = await request.json()

    if (!roleId) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'roleId is required',
      })
      return NextResponse.json(
        { error: 'roleId is required' },
        { status: 400 }
      )
    }

    // Verify admin access
    const hasAccess = await canManageTeam(session.user.id!, teamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'Only admins can change user roles',
      })
      return NextResponse.json(
        { error: 'Only admins can change user roles' },
        { status: 403 }
      )
    }

    // Prevent users from changing their own role
    if (userId === session.user.id) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'You cannot change your own role',
      })
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    // Ensure the Team Workspace Owner cannot be modified
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (team?.ownerId === userId) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'The workspace owner\'s role cannot be modified',
      })
      return NextResponse.json(
        { error: 'The workspace owner\'s role cannot be modified' },
        { status: 403 }
      )
    }

    // Verify the new role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    })

    if (!role) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'Invalid role',
      })
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Role Hierarchy Validation:
    // Fetch Caller & Target Role
    const callerRole = await getUserRoleInTeam(session.user.id, teamId)
    const targetRole = await getUserRoleInTeam(userId, teamId)

    if (!callerRole || !targetRole) {
      return NextResponse.json({ error: 'Roles could not be verified' }, { status: 400 })
    }

    // Admins (Level 50) cannot modify anyone with Level >= 50
    if (callerRole.level < 100 && targetRole.level >= callerRole.level) {
      return NextResponse.json(
        { error: 'Cannot modify a member with equal or higher authority' },
        { status: 403 }
      )
    }

    // Admins cannot grant a role >= 50
    if (callerRole.level < 100 && role.level >= callerRole.level) {
       return NextResponse.json(
        { error: 'Cannot grant authority equal to or higher than your own' },
        { status: 403 }
      )
    }

    // Update the role
    const member = await prisma.teamMember.updateMany({
      where: {
        userId,
        teamId,
      },
      data: {
        roleId,
      },
    })

    if (member.count === 0) {
      await logUserAction({
        request,
        action: 'TEAM_MEMBER_ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: 'Team member not found',
      })
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    await logUserAction({
      request,
      action: 'TEAM_MEMBER_ROLE_UPDATE',
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: 'teamMember',
      resourceId: userId,
      metadata: { roleId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update role error:', error)
    await logUserAction({
      request,
      action: 'TEAM_MEMBER_ROLE_UPDATE',
      success: false,
      errorMessage: 'Failed to update role',
    })
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    )
  }
}
