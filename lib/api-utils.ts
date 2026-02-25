import { NextResponse } from 'next/server'
import { Session } from 'next-auth'
import type { ScreenName } from '@prisma/client'
import { requireAuth, getUserRoleInTeam, userCanViewScreen, userCanEditScreen } from '@/lib/permissions'

/**
 * Helper to check authentication and return auth context or 401
 */
export function checkAuth(session: Session | null) {
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      auth: null,
    }
  }

  return {
    error: null,
    auth: {
      userId: session.user.id,
      roleId: session.user.roleId,
      teamId: session.user.teamId,
    },
  }
}

/**
 * Helper to check role requirement - deprecated, use getUserRoleInTeam instead
 */
export async function checkRoleLevel(session: Session | null, requiredLevel: number, teamId: string) {
  const auth = checkAuth(session)
  if (auth.error) {
    return {
      error: auth.error,
      auth: null,
    }
  }

  const role = await getUserRoleInTeam(auth.auth!.userId, teamId)
  if (!role || role.level < requiredLevel) {
    return {
      error: NextResponse.json(
        { message: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      ),
      auth: null,
    }
  }

  return {
    error: null,
    auth: auth.auth,
  }
}

/**
 * Helper to check screen permission
 */
export async function checkScreenPermission(
  session: Session | null,
  teamId: string,
  screenName: ScreenName,
  permissionLevel: 'VIEW' | 'EDIT' = 'VIEW'
) {
  const auth = checkAuth(session)
  if (auth.error) {
    return {
      error: auth.error,
      auth: null,
    }
  }

  // Check screen permission
  const hasPermission =
    permissionLevel === 'EDIT'
      ? await userCanEditScreen(auth.auth!.userId, teamId, screenName)
      : await userCanViewScreen(auth.auth!.userId, teamId, screenName)

  if (!hasPermission) {
    return {
      error: NextResponse.json(
        { message: 'Forbidden: No access to this screen' },
        { status: 403 }
      ),
      auth: null,
    }
  }

  return {
    error: null,
    auth: auth.auth,
  }
}

/**
 * Response helpers
 */
export const ApiResponse = {
  success: (data: any, status = 200) => NextResponse.json(data, { status }),
  error: (message: string, status = 500) =>
    NextResponse.json({ message }, { status }),
  unauthorized: () =>
    NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
  forbidden: () =>
    NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
  notFound: () =>
    NextResponse.json({ message: 'Not found' }, { status: 404 }),
  validationError: (message: string) =>
    NextResponse.json({ message }, { status: 400 }),
}
