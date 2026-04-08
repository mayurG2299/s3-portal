import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from "@/types/next-route-context";
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  context: RouteContext<{ id: string }>,
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const role = await prisma.role.findUnique({
      where: { id },
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
    const selectedTeamFromCookie = request.cookies
      .get("selectedTeamId")
      ?.value?.trim();
    const targetTeamId =
      searchParams.get("teamId")?.trim() ||
      selectedTeamFromCookie ||
      session.user.teamId;

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
