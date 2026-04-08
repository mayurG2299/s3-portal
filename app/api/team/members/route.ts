import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam, getUserRoleInTeam } from '@/lib/permissions'
import { publishMembershipChanged } from "@/lib/events/membership";

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

    publishMembershipChanged(userId);

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

// Remove user from team
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        errorMessage: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const userId = searchParams.get("userId");

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "teamId and userId are required" },
        { status: 400 },
      );
    }

    const hasAccess = await canManageTeam(session.user.id!, teamId);
    if (!hasAccess) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: "Only admins can remove team members",
      });
      return NextResponse.json(
        { error: "Only admins can remove team members" },
        { status: 403 },
      );
    }

    if (userId === session.user.id) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: "teamMember",
        resourceId: userId,
        errorMessage: "Use leave-team flow to remove yourself",
      });
      return NextResponse.json(
        { error: "Use leave-team flow to remove yourself" },
        { status: 400 },
      );
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        errorMessage: "Team not found",
      });
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.ownerId === userId) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: "teamMember",
        resourceId: userId,
        errorMessage: "Workspace owner cannot be removed",
      });
      return NextResponse.json(
        { error: "Workspace owner cannot be removed" },
        { status: 403 },
      );
    }

    const callerRole = await getUserRoleInTeam(session.user.id, teamId);
    const targetRole = await getUserRoleInTeam(userId, teamId);
    if (!callerRole || !targetRole) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: "teamMember",
        resourceId: userId,
        errorMessage: "Roles could not be verified",
      });
      return NextResponse.json(
        { error: "Roles could not be verified" },
        { status: 400 },
      );
    }

    if (callerRole.level < 100 && targetRole.level >= callerRole.level) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: "teamMember",
        resourceId: userId,
        errorMessage: "Cannot remove a member with equal or higher authority",
      });
      return NextResponse.json(
        { error: "Cannot remove a member with equal or higher authority" },
        { status: 403 },
      );
    }

    const deleted = await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId,
      },
    });

    if (deleted.count === 0) {
      await logUserAction({
        request,
        action: "TEAM_MEMBER_REMOVE",
        success: false,
        userId: session.user.id,
        teamId,
        resourceType: "teamMember",
        resourceId: userId,
        errorMessage: "Team member not found",
      });
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 },
      );
    }

    await logUserAction({
      request,
      action: "TEAM_MEMBER_REMOVE",
      success: true,
      userId: session.user.id,
      teamId,
      resourceType: "teamMember",
      resourceId: userId,
      metadata: {
        removedUserId: userId,
      },
    });

    // Broadcast SSE event to removed user
    publishMembershipChanged(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error)
    await logUserAction({
      request,
      action: 'TEAM_MEMBER_REMOVE',
      success: false,
      errorMessage: 'Failed to remove team member',
    })
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
