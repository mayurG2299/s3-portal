import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Failed to fetch role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.teamId) {
      await logUserAction({
        request,
        action: 'ROLE_DELETE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete roles
    const hasAccess = await canManageTeam(session.user.id, session.user.teamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'ROLE_DELETE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Forbidden',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!role) {
      await logUserAction({
        request,
        action: 'ROLE_DELETE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        resourceType: 'role',
        resourceId: params.id,
        errorMessage: 'Role not found',
      })
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      await logUserAction({
        request,
        action: 'ROLE_DELETE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        resourceType: 'role',
        resourceId: role.id,
        errorMessage: 'System roles cannot be deleted',
      })
      return NextResponse.json(
        { error: 'System roles cannot be deleted' },
        { status: 400 }
      )
    }

    // Delete the role
    await prisma.role.delete({
      where: { id: params.id },
    })

    await logUserAction({
      request,
      action: 'ROLE_DELETE',
      success: true,
      userId: session.user.id,
      teamId: session.user.teamId,
      resourceType: 'role',
      resourceId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete role:', error)
    await logUserAction({
      request,
      action: 'ROLE_DELETE',
      success: false,
      errorMessage: 'Internal server error',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
