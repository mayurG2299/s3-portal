import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import archiver from 'archiver'
import { PassThrough, Readable } from 'stream'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ApiResponse, requireScreenPermission } from '@/lib/api-utils'
import { logUserAction } from '@/lib/audit'
import { canAccessBucket } from '@/lib/bucket-access'
import { decryptAWSConfig, getS3ObjectBody, listAllS3Objects } from '@/lib/aws'

export const runtime = 'nodejs'

function normalizeFolderPath(pathValue: string): { prefix: string; folderLabel: string } {
  const trimmed = pathValue.trim()
  const normalized = trimmed === '/' ? '/' : `/${trimmed.replace(/^\/+|\/+$/g, '')}/`
  const prefix = normalized === '/' ? '' : normalized.slice(1)
  const parts = normalized.split('/').filter(Boolean)
  const folderLabel = parts.length ? parts[parts.length - 1] : 'root'

  return { prefix, folderLabel }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return ApiResponse.unauthorized()
  }

  const { searchParams } = new URL(request.url)
  const bucketId = searchParams.get('bucketId')
  const path = searchParams.get('path') || '/'

  if (!bucketId) {
    return ApiResponse.validationError('bucketId is required')
  }

  const { prefix, folderLabel } = normalizeFolderPath(path)

  try {
    const bucket = await prisma.awsBucket.findFirst({
      where: {
        id: bucketId,
        credential: {
          OR: [
            {
              userId: session.user.id,
              teamId: null,
            },
            {
              team: {
                members: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            },
          ],
        },
      },
      include: {
        credential: true,
      },
    })

    if (!bucket) {
      await logUserAction({
        request,
        action: 'FOLDER_DOWNLOAD',
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
          action: 'FOLDER_DOWNLOAD',
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
          action: 'FOLDER_DOWNLOAD',
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
    const allObjects = await listAllS3Objects(config, prefix)
    const fileObjects = allObjects.filter((obj) => !obj.key.endsWith('/'))

    if (fileObjects.length === 0) {
      return ApiResponse.validationError('This folder has no downloadable files')
    }

    const archive = archiver('zip', { zlib: { level: 9 } })
    const passThrough = new PassThrough()
    archive.pipe(passThrough)

    archive.on('error', (error) => {
      passThrough.destroy(error)
    })

    for (const obj of fileObjects) {
      const entryName = prefix ? obj.key.slice(prefix.length) : obj.key
      if (!entryName) continue
      const body = await getS3ObjectBody(config, obj.key)
      archive.append(body, { name: entryName })
    }

    await logUserAction({
      request,
      action: 'FOLDER_DOWNLOAD',
      success: true,
      userId: session.user.id,
      teamId: bucket.credential.teamId,
      resourceType: 'bucket',
      resourceId: bucketId,
      metadata: {
        path,
        fileCount: fileObjects.length,
      },
    })

    void archive.finalize()

    const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>
    const filename = `${folderLabel || 'folder'}-${Date.now()}.zip`

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
      action: 'FOLDER_DOWNLOAD',
      success: false,
      userId: session.user.id,
      resourceType: 'bucket',
      resourceId: bucketId,
      errorMessage: message,
    })

    return ApiResponse.error('Failed to download folder', 500)
  }
}
