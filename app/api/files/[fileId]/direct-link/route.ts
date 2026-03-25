
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, getPermanentObjectUrl } from '@/lib/aws'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { logUserAction } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: { fileId: string } }) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return ApiResponse.unauthorized()

  // 2. Validate input
  const { fileId } = params
  if (!fileId) return ApiResponse.validationError('fileId is required')

  // 3. Load file and check ownership
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { credential: true, bucket: true },
  })
  if (!file) return ApiResponse.notFound()

  if (file.userId !== session.user.id) {
    if (!file.teamId) return ApiResponse.forbidden()

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: file.teamId,
          userId: session.user.id,
        },
      },
    })

    if (!membership) return ApiResponse.forbidden()
  }

  // 4. Permission check (screen-based RBAC)
  if (file.teamId) {
    try {
      await requireScreenPermission(session, file.teamId, 'FILES_LIST', 'VIEW')
    } catch {
      await logUserAction({
        request,
        action: 'FILE_DIRECT_LINK',
        success: false,
        userId: session.user.id,
        teamId: file.teamId,
        resourceType: 'file',
        resourceId: file.id,
        errorMessage: 'Forbidden by screen permission',
      })
      return ApiResponse.forbidden()
    }
  }

  // 5. Generate permanent URL
  const url = getPermanentObjectUrl(
    file.bucket.bucket,
    file.credential.region,
    file.key,
    file.bucket.cloudfrontDomain
  )

  // 6. Audit log
  await logUserAction({
    request,
    action: 'FILE_DIRECT_LINK',
    success: true,
    userId: session.user.id,
    teamId: file.teamId,
    resourceType: 'file',
    resourceId: file.id,
    metadata: { key: file.key },
  })

  // 7. Return
  return ApiResponse.success({ url })
}