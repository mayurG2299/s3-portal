import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from "@/types/next-route-context";
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam } from '@/lib/permissions'
import { z } from 'zod'
import { PermissionLevel, ScreenName } from '@prisma/client'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

const updateRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  permissions: z.array(
    z.object({
      screenName: z.nativeEnum(ScreenName),
      permissionLevel: z.nativeEnum(PermissionLevel),
    })
  ),
})

const getRoleLevel = (
  permissions: Array<{
    permissionLevel: PermissionLevel
  }>
) => {
  const editCount = permissions.filter(permission => permission.permissionLevel === 'EDIT').length
  return Math.max(20, Math.min(49, 20 + editCount * 3))
}

export async function GET(
  request: NextRequest,
  context: RouteContext<{ id: string }>,
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url)
    const { teamId } = await getResolvedUserTeamScope({
      userId: session.user.id,
      requestedTeamId: searchParams.get('teamId')?.trim() ?? undefined,
      cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
      sessionTeamId: session.user.teamId,
    })

    const allowed = await canManageTeam(session.user.id, teamId ?? '')
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: true },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error("Failed to fetch role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<{ id: string }>,
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { teamId: targetTeamId } = await getResolvedUserTeamScope({
      userId: session.user.id,
      requestedTeamId: searchParams.get('teamId')?.trim(),
      cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
      sessionTeamId: session.user.teamId,
    })

    if (!targetTeamId) {
      return NextResponse.json({ error: 'Team not selected' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, targetTeamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        errorMessage: 'Forbidden',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const role = await prisma.role.findUnique({
      where: { id },
    })

    if (!role) {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        resourceType: 'role',
        resourceId: id,
        errorMessage: 'Role not found',
      })
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    if (role.isSystem) {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        resourceType: 'role',
        resourceId: id,
        errorMessage: 'System roles cannot be edited',
      })
      return NextResponse.json({ error: 'System roles cannot be edited' }, { status: 400 })
    }

    const body = await request.json()
    const validated = updateRoleSchema.parse(body)
    const level = getRoleLevel(validated.permissions)

    await prisma.role.update({
      where: { id },
      data: {
        name: validated.name,
        description: validated.description,
        level,
      },
    })

    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    })

    if (validated.permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: validated.permissions.map(permission => ({
          roleId: id,
          screenName: permission.screenName,
          permissionLevel: permission.permissionLevel,
        })),
      })
    }

    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: true },
    })

    await logUserAction({
      request,
      action: 'ROLE_UPDATE',
      success: true,
      userId: session.user.id,
      teamId: targetTeamId,
      resourceType: 'role',
      resourceId: id,
      metadata: {
        name: validated.name,
        level,
        permissionCount: validated.permissions.length,
      },
    })

    return NextResponse.json(updatedRole)
  } catch (error) {
    console.error('Failed to update role:', error)

    if (error instanceof z.ZodError) {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        errorMessage: error.errors[0].message,
      })
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    if ((error as any)?.code === 'P2002') {
      await logUserAction({
        request,
        action: 'ROLE_UPDATE',
        success: false,
        errorMessage: 'A role with this name already exists',
      })
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 409 }
      )
    }

    await logUserAction({
      request,
      action: 'ROLE_UPDATE',
      success: false,
      errorMessage: 'Internal server error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<{ id: string }>,
) {
  const { id } = await context.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: "ROLE_DELETE",
        success: false,
        errorMessage: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { teamId: targetTeamId } = await getResolvedUserTeamScope({
      userId: session.user.id,
      requestedTeamId: searchParams.get("teamId")?.trim(),
      cookieTeamId: request.cookies.get("selectedTeamId")?.value?.trim(),
      sessionTeamId: session.user.teamId,
    })

    if (!targetTeamId) {
      return NextResponse.json({ error: "Team not selected" }, { status: 400 });
    }

    // Only admins can delete roles
    const hasAccess = await canManageTeam(session.user.id, targetTeamId);
    if (!hasAccess) {
      await logUserAction({
        request,
        action: "ROLE_DELETE",
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        errorMessage: "Forbidden",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      await logUserAction({
        request,
        action: "ROLE_DELETE",
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        resourceType: "role",
        resourceId: id,
        errorMessage: "Role not found",
      });
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      await logUserAction({
        request,
        action: "ROLE_DELETE",
        success: false,
        userId: session.user.id,
        teamId: targetTeamId,
        resourceType: "role",
        resourceId: role.id,
        errorMessage: "System roles cannot be deleted",
      });
      return NextResponse.json(
        { error: "System roles cannot be deleted" },
        { status: 400 },
      );
    }

    // Delete the role
    await prisma.role.delete({
      where: { id },
    });

    await logUserAction({
      request,
      action: "ROLE_DELETE",
      success: true,
      userId: session.user.id,
      teamId: targetTeamId,
      resourceType: "role",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete role:", error);
    await logUserAction({
      request,
      action: "ROLE_DELETE",
      success: false,
      errorMessage: "Internal server error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
