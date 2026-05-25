import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { generatePresignedUploadUrl } from '@/lib/aws'
import { buildS3Key } from '@/lib/utils'
import { checkQuotaBeforeUpload, incrementUsage } from '@/lib/storage-quota'
import { publishFileChanged } from '@/lib/events/files'
import { enqueueFileIndexing } from '@/lib/indexing/queue'
import {
  type HandlerContext,
  uploadSchema,
  multipartInitSchema,
  multipartPresignSchema,
  multipartCompleteSchema,
  getAccessibleBucket,
  decryptConfigOrError,
  normalizeTags,
} from './shared'
import { initMultipartUpload, getPresignedUploadPartUrl, completeMultipartUpload, getS3ObjectMetadata } from '@/lib/aws'

export async function handleUpload({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = uploadSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, true)
  if (!bucket) {
    await logUserAction({
      request,
      action: 'FILE_UPLOAD_INIT',
      success: false,
      userId: session.user.id,
      resourceType: 'bucket',
      resourceId: validated.bucketId,
      errorMessage: 'Forbidden',
    })
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { config, errorResponse } = await decryptConfigOrError({
    request,
    action: 'FILE_UPLOAD_INIT',
    userId: session.user.id,
    teamId: bucket.credential.teamId,
    resourceType: 'bucket',
    resourceId: validated.bucketId,
    credential: bucket.credential,
    bucket,
  })
  if (errorResponse) return errorResponse

  const quotaCheck = await checkQuotaBeforeUpload(validated.teamId || bucket.credential.teamId, BigInt(0))
  if (!quotaCheck.allowed) {
    await logUserAction({ request, action: 'FILE_UPLOAD_INIT', success: false, userId: session.user.id, teamId: validated.teamId, resourceType: 'file', errorMessage: 'Quota exceeded' })
    return NextResponse.json({ message: 'Storage quota exceeded' }, { status: 403 })
  }

  const expectedSize = validated.size !== undefined ? BigInt(validated.size) : null
  if (expectedSize !== null) {
    const sizeCheck = await checkQuotaBeforeUpload(validated.teamId || bucket.credential.teamId, expectedSize)
    if (!sizeCheck.allowed) {
      await logUserAction({ request, action: 'FILE_UPLOAD_INIT', success: false, userId: session.user.id, teamId: validated.teamId, resourceType: 'file', resourceId: null, errorMessage: 'Quota exceeded' })
      return NextResponse.json({ message: 'Storage quota exceeded' }, { status: 403 })
    }
  }

  const key = buildS3Key(validated.path, validated.fileName)
  const { url } = await generatePresignedUploadUrl(config, key, validated.contentType)

  const normalizedTags = normalizeTags(validated.tags)
  const normalizedDescription = validated.description?.trim() || null

  const file = await prisma.file.upsert({
    where: { bucketId_key: { bucketId: validated.bucketId, key } },
    update: { name: validated.fileName, size: 0, contentType: validated.contentType, parentPath: validated.path, userId: session.user.id, teamId: validated.teamId, tags: normalizedTags, description: normalizedDescription },
    create: { key, name: validated.fileName, size: 0, contentType: validated.contentType, parentPath: validated.path, userId: session.user.id, teamId: validated.teamId, credentialId: bucket.credentialId, bucketId: validated.bucketId, tags: normalizedTags, description: normalizedDescription },
  })

  revalidateTag('dashboard-stats', 'max')
  publishFileChanged((validated.teamId ?? bucket.credential.teamId) as string, { bucketId: validated.bucketId, action: 'uploaded', key })

  await logUserAction({ request, action: 'FILE_UPLOAD_INIT', success: true, userId: session.user.id, teamId: validated.teamId, resourceType: 'file', resourceId: file.id, metadata: { key, credentialId: bucket.credentialId, bucketId: validated.bucketId, contentType: validated.contentType } })

  return NextResponse.json({ url, key, fileId: file.id })
}

export async function handleMultipartInit({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = multipartInitSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, true)
  if (!bucket) {
    await logUserAction({ request, action: 'FILE_MULTIPART_INIT', success: false, userId: session.user.id, resourceType: 'bucket', resourceId: validated.bucketId, errorMessage: 'Forbidden' })
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_MULTIPART_INIT', userId: session.user.id, teamId: bucket.credential.teamId, resourceType: 'bucket', resourceId: validated.bucketId, credential: bucket.credential, bucket })
  if (errorResponse) return errorResponse

  const quotaCheck = await checkQuotaBeforeUpload(validated.teamId || bucket.credential.teamId, BigInt(validated.size))
  if (!quotaCheck.allowed) {
    await logUserAction({ request, action: 'FILE_MULTIPART_INIT', success: false, userId: session.user.id, teamId: validated.teamId, resourceType: 'file', errorMessage: 'Quota exceeded' })
    return NextResponse.json({ message: 'Storage quota exceeded' }, { status: 403 })
  }

  const key = buildS3Key(validated.path, validated.fileName)
  const { uploadId } = await initMultipartUpload(config, key, validated.contentType)

  const normalizedTags = normalizeTags(validated.tags)
  const normalizedDescription = validated.description?.trim() || null

  const file = await prisma.file.upsert({
    where: { bucketId_key: { bucketId: validated.bucketId, key } },
    update: { name: validated.fileName, size: 0, contentType: validated.contentType, parentPath: validated.path, userId: session.user.id, teamId: validated.teamId, tags: normalizedTags, description: normalizedDescription },
    create: { key, name: validated.fileName, size: 0, contentType: validated.contentType, parentPath: validated.path, userId: session.user.id, teamId: validated.teamId, credentialId: bucket.credentialId, bucketId: validated.bucketId, tags: normalizedTags, description: normalizedDescription },
  })

  await logUserAction({ request, action: 'FILE_MULTIPART_INIT', success: true, userId: session.user.id, teamId: validated.teamId, resourceType: 'file', resourceId: file.id, metadata: { key, uploadId, credentialId: bucket.credentialId, bucketId: validated.bucketId } })

  return NextResponse.json({ uploadId, key, fileId: file.id })
}

export async function handleMultipartPresign({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = multipartPresignSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, false)
  if (!bucket) {
    await logUserAction({ request, action: 'FILE_MULTIPART_PRESIGN', success: false, userId: session.user.id, resourceType: 'bucket', resourceId: validated.bucketId, errorMessage: 'Forbidden' })
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_MULTIPART_PRESIGN', userId: session.user.id, teamId: bucket.credential.teamId, resourceType: 'bucket', resourceId: validated.bucketId, credential: bucket.credential, bucket })
  if (errorResponse) return errorResponse

  const url = await getPresignedUploadPartUrl(config, validated.key, validated.uploadId, validated.partNumber)

  await logUserAction({ request, action: 'FILE_MULTIPART_PRESIGN', success: true, userId: session.user.id, resourceType: 'file', resourceId: validated.key, metadata: { uploadId: validated.uploadId, partNumber: validated.partNumber } })

  return NextResponse.json({ url })
}

export async function handleMultipartComplete({ request, session, body }: HandlerContext) {
  const validated = multipartCompleteSchema.parse(body)

  const sortedParts = [...validated.parts].sort((a, b) => a.PartNumber - b.PartNumber)
  for (let i = 0; i < sortedParts.length; i++) {
    if (sortedParts[i].PartNumber !== i + 1) {
      return NextResponse.json({ message: `Parts must be contiguous: missing part ${i + 1}` }, { status: 400 })
    }
    if (!sortedParts[i].ETag || sortedParts[i].ETag.trim() === '') {
      return NextResponse.json({ message: `Part ${i + 1} has empty ETag` }, { status: 400 })
    }
  }

  const file = await prisma.file.findUnique({ where: { id: validated.fileId }, include: { credential: true, bucket: true } })
  if (!file) {
    await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: false, userId: session.user.id, resourceType: 'file', resourceId: validated.fileId, errorMessage: 'File not found' })
    return NextResponse.json({ message: 'File not found' }, { status: 404 })
  }

  if (file.bucketId !== validated.bucketId) {
    return NextResponse.json({ message: 'Bucket mismatch' }, { status: 400 })
  }

  if (file.userId !== session.user.id) {
    const teamMember = await prisma.teamMember.findFirst({ where: { teamId: file.teamId!, userId: session.user.id, role: { name: { in: ['OWNER', 'ADMIN'] } } } })
    if (!teamMember) {
      await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: 'Forbidden' })
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  }

  const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_MULTIPART_COMPLETE', userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, credential: file.credential, bucket: file.bucket })
  if (errorResponse) return errorResponse

  try {
    await completeMultipartUpload(config, validated.key, validated.uploadId, sortedParts)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error from S3'
    const errorDesc = message.includes('NoSuchUpload')
      ? 'Upload ID expired or invalid (try uploading again)'
      : message.includes('InvalidPartOrder')
        ? 'Parts out of order or duplicate part numbers'
        : message.includes('InvalidPart')
          ? 'One or more parts are missing or corrupted'
          : message
    await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: `S3 error: ${message}` })
    return NextResponse.json({ message: `Failed to finalize upload: ${errorDesc}` }, { status: 400 })
  }

  const meta = await getS3ObjectMetadata(config, validated.key)
  const newSize = BigInt(meta.size)
  const oldSize = BigInt(file.size || 0)
  const delta = newSize > oldSize ? newSize - oldSize : BigInt(0)

  if (delta > BigInt(0)) {
    const quotaCheck = await checkQuotaBeforeUpload(file.teamId || file.credential.teamId, delta)
    if (!quotaCheck.allowed) {
      await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: 'Quota exceeded' })
      return NextResponse.json({ message: 'Storage quota exceeded' }, { status: 403 })
    }
  }

  await prisma.file.update({ where: { id: validated.fileId }, data: { size: meta.size, contentType: meta.contentType ?? file.contentType } })

  if (delta > BigInt(0)) {
    try {
      await incrementUsage(file.teamId || file.credential.teamId, delta)
    } catch (err) {
      console.error('Failed to increment usage:', err)
    }
  }

  revalidateTag('dashboard-stats', 'max')
  publishFileChanged((file.teamId ?? file.credential.teamId) as string, { bucketId: file.bucketId, action: 'uploaded', key: validated.key })
  await enqueueFileIndexing(file.id, 1)

  await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { key: validated.key, uploadId: validated.uploadId } })

  return NextResponse.json({ success: true })
}
