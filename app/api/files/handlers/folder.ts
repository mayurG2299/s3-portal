import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { createFolderMarkerObject } from '@/lib/aws'
import { buildS3Key } from '@/lib/utils'
import { type HandlerContext, createFolderSchema, getAccessibleBucket, decryptConfigOrError, normalizeTags } from './shared'

export async function handleCreateFolder({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = createFolderSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, true)
  if (!bucket) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const normalizedTags = normalizeTags(validated.tags)
  const normalizedDescription = validated.description?.trim() || null

  const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_CREATE_FOLDER', userId: session.user.id, teamId: bucket.credential.teamId, resourceType: 'bucket', resourceId: validated.bucketId, credential: bucket.credential, bucket })
  if (errorResponse) return errorResponse

  const folderKey = buildS3Key(validated.path, validated.folderName + '/')

  const existingFolder = await prisma.file.findUnique({ where: { bucketId_key: { bucketId: validated.bucketId, key: folderKey } } })
  if (existingFolder) {
    return NextResponse.json({ message: 'Folder already exists' }, { status: 409 })
  }

  await createFolderMarkerObject(config, folderKey)

  await prisma.file.create({
    data: {
      key: folderKey,
      name: validated.folderName,
      size: 0,
      contentType: 'application/x-directory',
      parentPath: validated.path,
      userId: session.user.id,
      teamId: bucket.credential.teamId,
      credentialId: bucket.credentialId,
      bucketId: validated.bucketId,
      tags: normalizedTags,
      description: normalizedDescription,
    },
  })

  await logUserAction({ request, action: 'FILE_CREATE_FOLDER', success: true, userId: session.user.id, teamId: bucket.credential.teamId, resourceType: 'file', resourceId: folderKey, metadata: { credentialId: bucket.credentialId, bucketId: validated.bucketId, path: validated.path, folderName: validated.folderName, tags: normalizedTags } })

  return NextResponse.json({ success: true, key: folderKey })
}
