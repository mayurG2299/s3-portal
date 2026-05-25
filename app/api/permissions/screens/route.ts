import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkAuth, ApiResponse } from '@/lib/api-utils'
import { getUserScreenPermission } from '@/lib/permissions'
import { ScreenName } from '@prisma/client'

const ALL_SCREENS = Object.values(ScreenName)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return ApiResponse.validationError('teamId is required')
    }

    const permissions = (
      await Promise.all(
        ALL_SCREENS.map(async (screenName) => {
          const level = await getUserScreenPermission(auth!.userId, teamId, screenName)
          return level ? { screenName, permissionLevel: level } : null
        })
      )
    ).filter(Boolean)

    return ApiResponse.success(permissions)
  } catch (error) {
    console.error('Error fetching screen permissions:', error)
    return ApiResponse.error('Internal server error')
  }
}
