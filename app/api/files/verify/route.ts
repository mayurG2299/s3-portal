import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, getS3ObjectMetadata } from '@/lib/aws'
import { logUserAction } from '@/lib/audit'
import { canAccessBucket } from '@/lib/bucket-access'
import { checkQuotaBeforeUpload, incrementUsage, decrementUsage } from '@/lib/storage-quota'
import { enqueueFileIndexing } from '@/lib/indexing/queue'

/**
 * POST /api/files/verify
 * Body: { fileId?: string, bucketId?: string, key?: string }
 * Verifies S3 object metadata, updates DB record, and adjusts team quota.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { fileId, bucketId, key } = body as { fileId?: string; bucketId?: string; key?: string }

  if (!fileId && !(bucketId && key)) {
    return NextResponse.json({ message: 'fileId or (bucketId and key) required' }, { status: 400 })
  }

  const file = fileId
    ? await prisma.file.findUnique({ where: { id: fileId }, include: { credential: true, bucket: true } })
    : await prisma.file.findFirst({ where: { bucketId, key }, include: { credential: true, bucket: true } })

  if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 })

  // Permission: owner or team admin
  if (file.userId !== session.user.id) {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: file.teamId ?? undefined,
        userId: session.user.id,
        role: { name: { in: ['OWNER', 'ADMIN'] } },
      },
    })
    if (!teamMember) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  // Bucket-scope check: file owner with restricted role cannot verify files outside their buckets
  if (file.teamId && file.bucketId) {
    const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const config = decryptAWSConfig(file.credential as any, file.bucket as any)
  try {
    const meta = await getS3ObjectMetadata(config, file.key)
    const newSize = BigInt(meta.size)
    const oldSize = BigInt(file.size || 0)

    if (newSize > oldSize) {
      const delta = newSize - oldSize
      const quotaCheck = await checkQuotaBeforeUpload(file.teamId || file.credential.teamId, delta)
      if (!quotaCheck.allowed) {
        await logUserAction({ request, action: 'FILE_VERIFY', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: 'Quota exceeded' })
        return NextResponse.json({ message: 'Storage quota exceeded' }, { status: 403 })
      }

      // update DB and increment usage
      await prisma.file.update({ where: { id: file.id }, data: { size: meta.size, contentType: meta.contentType ?? file.contentType } })
      await incrementUsage(file.teamId || file.credential.teamId, delta)
      await enqueueFileIndexing(file.id, 1)

      await logUserAction({ request, action: 'FILE_VERIFY', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { oldSize: oldSize.toString(), newSize: newSize.toString() } })
      return NextResponse.json({ ok: true, updated: true })
    }

    if (newSize < oldSize) {
      const delta = oldSize - newSize
      await prisma.file.update({ where: { id: file.id }, data: { size: meta.size, contentType: meta.contentType ?? file.contentType } })
      await decrementUsage(file.teamId || file.credential.teamId, delta)
      await enqueueFileIndexing(file.id, 1)
      await logUserAction({ request, action: 'FILE_VERIFY', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { oldSize: oldSize.toString(), newSize: newSize.toString() } })
      return NextResponse.json({ ok: true, updated: true })
    }

    // sizes equal - ensure contentType
    if ((file.contentType ?? '') !== (meta.contentType ?? '')) {
      await prisma.file.update({ where: { id: file.id }, data: { contentType: meta.contentType ?? file.contentType } })
    }

    return NextResponse.json({ ok: true, updated: false })
  } catch (err: any) {
    console.error('Error verifying file:', err)
    return NextResponse.json({ message: 'Error verifying file' }, { status: 500 })
  }
}
