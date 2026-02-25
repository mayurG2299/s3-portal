import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { logUserAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session.user.teamId) {
      await logUserAction({
        request,
        action: 'ROLE_PERMISSION_UPDATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roleId, screenName, permissionLevel } = await request.json()

    if (!roleId || !screenName || !permissionLevel) {
      await logUserAction({
        request,
        action: 'ROLE_PERMISSION_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Missing required fields',
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user is admin
    if (!(await canManageTeam(session.user.id, session.user.teamId))) {
      await logUserAction({
        request,
        action: 'ROLE_PERMISSION_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Forbidden',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
    })

    if (!role) {
      await logUserAction({
        request,
        action: 'ROLE_PERMISSION_UPDATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        resourceType: 'role',
        resourceId: roleId,
        errorMessage: 'Role not found',
      })
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Create or update role permission
    const permission = await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId,
          screenName,
        },
      },
      create: {
        roleId,
        screenName,
        permissionLevel,
      },
      update: {
        permissionLevel,
      },
    })

    await logUserAction({
      request,
      action: 'ROLE_PERMISSION_UPDATE',
      success: true,
      userId: session.user.id,
      teamId: session.user.teamId,
      resourceType: 'role',
      resourceId: roleId,
      metadata: { screenName, permissionLevel },
    })

    return NextResponse.json(permission)
  } catch (error) {
    console.error('[roles/permissions] Error:', error)
    await logUserAction({
      request,
      action: 'ROLE_PERMISSION_UPDATE',
      success: false,
      errorMessage: 'Internal server error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
