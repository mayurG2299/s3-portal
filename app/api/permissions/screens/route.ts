import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkAuth, ApiResponse } from '@/lib/api-utils'
import { logUserAction } from '@/lib/audit'
import {
  getUserScreenPermissions,
  canManageTeam,
  grantScreenPermission,
  revokeScreenPermission,
} from '@/lib/permissions'
import type { ScreenName, PermissionLevel } from '@prisma/client'
import { z } from 'zod'

const grantPermissionSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  screenName: z.string(),
  permissionLevel: z.enum(['VIEW', 'EDIT']),
})

const revokePermissionSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  screenName: z.string(),
})

const setMultiplePermissionsSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  permissions: z.array(
    z.object({
      screenName: z.string(),
      permissionLevel: z.enum(['VIEW', 'EDIT']),
    })
  ),
})

/**
 * GET - Get screen permissions for current user
 * ?teamId=team-123 -> Get all screen permissions for user in this team
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_GRANT',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return error
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return ApiResponse.validationError('teamId is required')
    }

    // Get user's screen permissions
    const permissions = await getUserScreenPermissions(auth!.userId, teamId)

    return ApiResponse.success(permissions)
  } catch (error) {
    console.error('Error fetching screen permissions:', error)
    return ApiResponse.error('Internal server error')
  }
}

/**
 * POST - Grant screen permission to a user
 * Body: { teamId, userId, screenName, permissionLevel }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) return error

    const body = await request.json()
    const validated = grantPermissionSchema.parse(body)

    // Check if caller is admin in the team
    const canManage = await canManageTeam(auth!.userId, validated.teamId)
    if (!canManage) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_GRANT',
        success: false,
        userId: auth!.userId,
        teamId: validated.teamId,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    // Grant permission
    const permission = await grantScreenPermission(
      validated.userId,
      validated.teamId,
      validated.screenName as ScreenName,
      validated.permissionLevel as PermissionLevel
    )

    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_GRANT',
      success: true,
      userId: auth!.userId,
      teamId: validated.teamId,
      resourceType: 'screenPermission',
      resourceId: permission.id,
      metadata: {
        userId: validated.userId,
        screenName: validated.screenName,
        permissionLevel: validated.permissionLevel,
      },
    })

    return ApiResponse.success(permission, 201)
  } catch (error: any) {
    console.error('Error granting screen permission:', error)

    if (error instanceof z.ZodError) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_GRANT',
        success: false,
        errorMessage: error.errors[0].message,
      })
      return ApiResponse.validationError(error.errors[0].message)
    }

    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_GRANT',
      success: false,
      errorMessage: error.message || 'Internal server error',
    })

    return ApiResponse.error(error.message || 'Internal server error')
  }
}

/**
 * DELETE - Revoke screen permission from a user
 * ?teamId=team-123&userId=user-456&screenName=FILES_UPLOAD
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_REVOKE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return error
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const userId = searchParams.get('userId')
    const screenName = searchParams.get('screenName')

    if (!teamId || !userId || !screenName) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_REVOKE',
        success: false,
        userId: auth!.userId,
        errorMessage: 'teamId, userId, and screenName are required',
      })
      return ApiResponse.validationError('teamId, userId, and screenName are required')
    }

    // Check if caller is admin in the team
    const canManage = await canManageTeam(auth!.userId, teamId)
    if (!canManage) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_REVOKE',
        success: false,
        userId: auth!.userId,
        teamId,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    // Revoke permission
    await revokeScreenPermission(userId, teamId, screenName as ScreenName)

    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_REVOKE',
      success: true,
      userId: auth!.userId,
      teamId,
      resourceType: 'screenPermission',
      resourceId: `${userId}:${screenName}`,
      metadata: { userId, screenName },
    })

    return ApiResponse.success({ success: true })
  } catch (error: any) {
    console.error('Error revoking screen permission:', error)
    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_REVOKE',
      success: false,
      errorMessage: error.message || 'Internal server error',
    })
    return ApiResponse.error(error.message || 'Internal server error')
  }
}

/**
 * PATCH - Set multiple screen permissions for a user at once
 * Body: { teamId, userId, permissions: [{ screenName, permissionLevel }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_BULK_SET',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return error
    }

    const body = await request.json()
    const validated = setMultiplePermissionsSchema.parse(body)

    // Check if caller is admin in the team
    const canManage = await canManageTeam(auth!.userId, validated.teamId)
    if (!canManage) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_BULK_SET',
        success: false,
        userId: auth!.userId,
        teamId: validated.teamId,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    // Import the function
    const { setUserScreenPermissions } = await import('@/lib/permissions')

    // Set all permissions
    await setUserScreenPermissions(
      validated.userId,
      validated.teamId,
      validated.permissions as Array<{ screenName: ScreenName; permissionLevel: PermissionLevel }>
    )

    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_BULK_SET',
      success: true,
      userId: auth!.userId,
      teamId: validated.teamId,
      resourceType: 'screenPermission',
      resourceId: validated.userId,
      metadata: { permissions: validated.permissions },
    })

    return ApiResponse.success({ success: true })
  } catch (error: any) {
    console.error('Error setting screen permissions:', error)

    if (error instanceof z.ZodError) {
      await logUserAction({
        request,
        action: 'SCREEN_PERMISSION_BULK_SET',
        success: false,
        errorMessage: error.errors[0].message,
      })
      return ApiResponse.validationError(error.errors[0].message)
    }

    await logUserAction({
      request,
      action: 'SCREEN_PERMISSION_BULK_SET',
      success: false,
      errorMessage: error.message || 'Internal server error',
    })

    return ApiResponse.error(error.message || 'Internal server error')
  }
}
