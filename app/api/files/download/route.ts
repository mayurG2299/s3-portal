import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'
import { logUserAction } from '@/lib/audit'
import { requireScreenPermission, ApiResponse } from '@/lib/api-utils'
import { canAccessBucket } from '@/lib/bucket-access'
import { allowRequest } from '@/lib/rate-limiter'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const identifier = session.user.id
    ? `user:${session.user.id}`
    : `ip:${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'}`

  const allowed = await allowRequest(`download:${identifier}`, 10, 60)
  if (!allowed) {
    await logUserAction({ request, action: 'FILE_DOWNLOAD', success: false, userId: session.user.id, resourceType: 'file', errorMessage: 'Rate limited' })
    return ApiResponse.error('Too many requests', 429)
  }

  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('id')
  
  if (!fileId) {
    return NextResponse.json({ message: 'Missing file ID' }, { status: 400 })
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { credential: true, bucket: true },
    })

    if (!file) {
      await logUserAction({ 
        request, 
        action: 'FILE_DOWNLOAD', 
        success: false, 
        userId: session.user.id, 
        resourceType: 'file', 
        resourceId: fileId, 
        errorMessage: 'File not found' 
      })
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    // Permission: owner or team member
    if (file.userId !== session.user.id) {
      if (!file.teamId) {
        await logUserAction({ request, action: 'FILE_DOWNLOAD', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden' })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const member = await prisma.teamMember.findFirst({ where: { teamId: file.teamId, userId: session.user.id } })
      if (!member) {
        await logUserAction({ request, action: 'FILE_DOWNLOAD', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden' })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    // Personal-scope files (teamId null) bypass bucket restriction intentionally
    if (file.teamId && file.bucketId) {
      const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check FILES_LIST VIEW permission
    if (file.teamId) {
      try {
        await requireScreenPermission(session, file.teamId, 'FILES_LIST', 'VIEW')
      } catch (err) {
        await logUserAction({ request, action: 'FILE_DOWNLOAD', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden by screen permission' })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const config = decryptAWSConfig(file.credential as any, file.bucket as any)

    const ttlSeconds = 60 * 15 // 15 minutes
    // Provide file.name so the browser forces a download instead of displaying inline
    const downloadUrl = file.bucket.cloudfrontDomain && file.bucket.cloudfrontKeyPairId
      ? generateCloudfrontSignedUrl(config, file.key, ttlSeconds) // Note: Cloudfront download attachments usually require custom Lambda@Edge headers unless directly mapped via query strings, but Presigned native URLs will work. We will append response-content-disposition using typical S3 mechanics for S3 links.
      : await generatePresignedDownloadUrl(config, file.key, ttlSeconds, file.name)

    await logUserAction({ 
      request, 
      action: 'FILE_DOWNLOAD', 
      success: true, 
      userId: session.user.id, 
      resourceType: 'file', 
      resourceId: fileId, 
      teamId: file.teamId 
    })

    // Redirect the user directly to the presigned URL
    return NextResponse.redirect(downloadUrl)
  } catch (error: any) {
    console.error('Error handling download request:', error)
    await logUserAction({ request, action: 'FILE_DOWNLOAD', success: false, errorMessage: error?.message || 'Internal server error' })
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
