import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canManageTeam } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all roles ordered by level descending
    const roles = await prisma.role.findMany({
      orderBy: { level: 'desc' },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error('Failed to fetch roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || !session?.user?.teamId) {
      await logUserAction({
        request,
        action: 'ROLE_CREATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can create roles
    const hasAccess = await canManageTeam(session.user.id, session.user.teamId)
    if (!hasAccess) {
      await logUserAction({
        request,
        action: 'ROLE_CREATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Forbidden',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, level } = body

    if (!name || !description || level === undefined) {
      await logUserAction({
        request,
        action: 'ROLE_CREATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Missing required fields: name, description, level',
      })
      return NextResponse.json(
        { error: 'Missing required fields: name, description, level' },
        { status: 400 }
      )
    }

    // Validate level (custom roles should be between 10-90 to avoid conflicts)
    if (level < 10 || level > 90) {
      await logUserAction({
        request,
        action: 'ROLE_CREATE',
        success: false,
        userId: session.user.id,
        teamId: session.user.teamId,
        errorMessage: 'Custom role level must be between 10 and 90',
      })
      return NextResponse.json(
        { error: 'Custom role level must be between 10 and 90' },
        { status: 400 }
      )
    }

    // Create the role
    const role = await prisma.role.create({
      data: {
        name,
        description,
        level,
        isSystem: false,
      },
    })

    await logUserAction({
      request,
      action: 'ROLE_CREATE',
      success: true,
      userId: session.user.id,
      teamId: session.user.teamId,
      resourceType: 'role',
      resourceId: role.id,
      metadata: { name, level },
    })

    return NextResponse.json(role, { status: 201 })
  } catch (error) {
    console.error('Failed to create role:', error)
    
    // Handle unique constraint violation
    if ((error as any)?.code === 'P2002') {
      await logUserAction({
        request,
        action: 'ROLE_CREATE',
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
      action: 'ROLE_CREATE',
      success: false,
      errorMessage: 'Internal server error',
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
