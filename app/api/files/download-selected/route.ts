import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import archiver from 'archiver'
import { PassThrough, Readable } from 'stream'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ApiResponse, requireScreenPermission } from '@/lib/api-utils'
import { logUserAction } from '@/lib/audit'
import { canAccessBucket } from '@/lib/bucket-access'
import { decryptAWSConfig, getS3ObjectBody } from '@/lib/aws'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return ApiResponse.unauthorized()
  }

  let body: { bucketId?: string; keys?: string[] }
  try {
    body = await request.json()
  } catch {
    return ApiResponse.validationError('Invalid request body')
  }

  const { bucketId, keys } = body

  if (!bucketId) {
    return ApiResponse.validationError('bucketId is required')
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    return ApiResponse.validationError('keys must be a non-empty array')
  }

  if (keys.length > 500) {
    return ApiResponse.validationError('Cannot download more than 500 files at once')
  }

  // Strip folder keys — only download actual files
  const fileKeys = keys.filter((k) => !k.endsWith('/'))

  if (fileKeys.length === 0) {
    return ApiResponse.validationError('No downloadable files in selection (folders are skipped)')
  }

  try {
    const bucket = await prisma.awsBucket.findFirst({
      where: {
        id: bucketId,
        credential: {
          OR: [
            { userId: session.user.id, teamId: null },
            {
              team: {
                members: { some: { userId: session.user.id } },
              },
            },
          ],
        },
      },
      include: { credential: true },
    })

    if (!bucket) {
      await logUserAction({
        request,
        action: 'SELECTED_DOWNLOAD',
        success: false,
        userId: session.user.id,
        resourceType: 'bucket',
        resourceId: bucketId,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    if (bucket.credential.teamId) {
      try {
        await requireScreenPermission(session, bucket.credential.teamId, 'FILES_LIST', 'VIEW')
      } catch {
        await logUserAction({
          request,
          action: 'SELECTED_DOWNLOAD',
          success: false,
          userId: session.user.id,
          teamId: bucket.credential.teamId,
          resourceType: 'bucket',
          resourceId: bucketId,
          errorMessage: 'Forbidden by screen permission',
        })
        return ApiResponse.forbidden()
      }

      const allowed = await canAccessBucket(session.user.id, bucket.credential.teamId, bucketId)
      if (!allowed) {
        await logUserAction({
          request,
          action: 'SELECTED_DOWNLOAD',
          success: false,
          userId: session.user.id,
          teamId: bucket.credential.teamId,
          resourceType: 'bucket',
          resourceId: bucketId,
          errorMessage: 'Bucket access denied',
        })
        return ApiResponse.forbidden()
      }
    }

    const config = decryptAWSConfig(bucket.credential, bucket)
    const archive = archiver('zip', { zlib: { level: 6 } })
    const passThrough = new PassThrough()
    archive.pipe(passThrough)

    archive.on('error', (error) => {
      passThrough.destroy(error)
    })

    for (const key of fileKeys) {
      const entryName = key.split('/').pop() || key
      const body = await getS3ObjectBody(config, key)
      archive.append(body, { name: entryName })
    }

    await logUserAction({
      request,
      action: 'SELECTED_DOWNLOAD',
      success: true,
      userId: session.user.id,
      teamId: bucket.credential.teamId,
      resourceType: 'bucket',
      resourceId: bucketId,
      metadata: { fileCount: fileKeys.length },
    })

    void archive.finalize()

    const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>
    const filename = `selected-files-${Date.now()}.zip`

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'

    await logUserAction({
      request,
      action: 'SELECTED_DOWNLOAD',
      success: false,
      userId: session.user.id,
      resourceType: 'bucket',
      resourceId: bucketId,
      errorMessage: message,
    })

    return ApiResponse.error('Failed to download selected files', 500)
  }
}
