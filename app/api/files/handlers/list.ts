import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { listS3ObjectsWithPrefixes } from '@/lib/aws'
import {
  type HandlerContext,
  listSchema,
  getAccessibleBucket,
  decryptConfigOrError,
  chunk,
  normalizePath,
} from './shared'

const prismaAny = prisma as any

export async function handleList({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = listSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, false)
  if (!bucket) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { ensuredPath, normalizedPrefix } = normalizePath(validated.prefix || '/')

  const { config, errorResponse } = await decryptConfigOrError({
    request,
    action: 'FILE_LIST',
    userId: session.user.id,
    teamId: bucket.credential.teamId,
    resourceType: 'bucket',
    resourceId: validated.bucketId,
    credential: bucket.credential,
    bucket,
  })
  if (errorResponse) return errorResponse

  const { objects: s3Objects, prefixes, isTruncated } = await listS3ObjectsWithPrefixes(config, normalizedPrefix, '/')

  const folderObjectKeys = new Set(s3Objects.filter((obj) => obj.key.endsWith('/')).map((obj) => obj.key))
  const mergedPrefixes = Array.from(new Set([...prefixes, ...Array.from(folderObjectKeys)])).filter((key) => key !== normalizedPrefix)
  const fileObjects = s3Objects.filter((obj) => !obj.key.endsWith('/'))

  const allKeys = [...mergedPrefixes, ...fileObjects.map((obj) => obj.key)]
  const CHUNK_SIZE = 500

  const existing = allKeys.length
    ? (await Promise.all(chunk(allKeys, CHUNK_SIZE).map((keys) => prisma.file.findMany({ where: { bucketId: validated.bucketId, key: { in: keys } }, select: { id: true, key: true, contentType: true } })))).flat()
    : []

  const existingByKey = new Map(existing.map((file) => [file.key, file]))

  const toCreate = allKeys
    .filter((key) => !existingByKey.has(key))
    .map((key) => {
      const isFolder = key.endsWith('/')
      const trimmedKey = isFolder ? key.slice(0, -1) : key
      const name = trimmedKey.split('/').filter(Boolean).pop() || trimmedKey
      const keyForParent = isFolder ? trimmedKey : key
      const keyParts = keyForParent.split('/').filter(Boolean)
      const derivedParentPath = keyParts.length <= 1 ? '/' : '/' + keyParts.slice(0, -1).join('/') + '/'
      return {
        key,
        name,
        size: isFolder ? 0 : fileObjects.find((obj) => obj.key === key)?.size ?? 0,
        contentType: isFolder ? 'application/x-directory' : undefined,
        parentPath: derivedParentPath,
        userId: session.user.id,
        teamId: bucket.credential.teamId,
        credentialId: bucket.credentialId,
        bucketId: validated.bucketId,
      }
    })

  if (toCreate.length > 0) {
    for (const batch of chunk(toCreate, CHUNK_SIZE)) {
      await prisma.file.createMany({ data: batch, skipDuplicates: true })
    }
  }

  const synced = allKeys.length
    ? (await Promise.all(chunk(allKeys, CHUNK_SIZE).map((keys) => prisma.file.findMany({ where: { bucketId: validated.bucketId, key: { in: keys } }, select: { id: true, key: true, contentType: true, tags: true, description: true } } as any)))).flat()
    : []

  const syncedTyped = synced as Array<{ id: string; key: string; contentType: string | null; tags?: string[]; description?: string | null }>
  const syncedByKey = new Map(syncedTyped.map((file) => [file.key, file]))
  const dbFolderKeys = new Set(syncedTyped.filter((file) => file.contentType === 'application/x-directory').map((file) => file.key))

  const folderKeySet = new Set([...mergedPrefixes, ...dbFolderKeys].filter((key) => key !== normalizedPrefix))

  const folderItems = Array.from(folderKeySet).map((key) => {
    const trimmedKey = key.endsWith('/') ? key.slice(0, -1) : key
    const name = trimmedKey.split('/').filter(Boolean).pop() || trimmedKey
    return {
      id: syncedByKey.get(key)?.id || key,
      name,
      key,
      size: '0',
      contentType: 'application/x-directory',
      tags: syncedByKey.get(key)?.tags || [],
      description: syncedByKey.get(key)?.description || null,
      createdAt: new Date().toISOString(),
    }
  })

  const fileItems = fileObjects.map((obj) => {
    if (folderKeySet.has(obj.key)) return null
    const relative = normalizedPrefix ? obj.key.replace(normalizedPrefix, '') : obj.key
    if (relative.includes('/')) return null
    const name = relative.split('/').filter(Boolean).pop() || obj.key
    return {
      id: syncedByKey.get(obj.key)?.id || obj.key,
      name,
      key: obj.key,
      size: obj.size.toString(),
      contentType: syncedByKey.get(obj.key)?.contentType,
      tags: syncedByKey.get(obj.key)?.tags || [],
      description: syncedByKey.get(obj.key)?.description || null,
      createdAt: obj.lastModified.toISOString(),
    }
  })

  const fileIds = fileItems.filter((file) => file && typeof file.id === 'string').map((file) => file!.id)
  const favoriteIds = fileIds.length ? await prismaAny.fileFavorite.findMany({ where: { userId: session.user.id, fileId: { in: fileIds } }, select: { fileId: true } }) : []
  const favoriteIdSet = new Set(favoriteIds.map((fav: { fileId: string }) => fav.fileId))

  const query = validated.query?.trim().toLowerCase()
  const tagFilter = validated.tag?.trim().toLowerCase()

  const filteredFolders = query ? folderItems.filter((folder) => folder.name.toLowerCase().includes(query) || folder.key.toLowerCase().includes(query)) : folderItems

  const filteredFilesByTag = tagFilter ? fileItems.filter((file) => file && (file.tags || []).some((tag: string) => tag.toLowerCase() === tagFilter)) : fileItems
  const filteredFiles = query ? filteredFilesByTag.filter((file) => file && (file.name.toLowerCase().includes(query) || file.key.toLowerCase().includes(query))) : filteredFilesByTag

  const allFilteredFiles = filteredFiles.filter(Boolean).map((file) => ({ ...file, isFavorite: favoriteIdSet.has(file!.id) }))

  const combinedItems = [...filteredFolders, ...allFilteredFiles]
  const page = validated.page ?? 1
  const pageSize = validated.pageSize ?? 200
  const totalItems = combinedItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (page - 1) * pageSize
  const pagedItems = combinedItems.slice(start, start + pageSize)

  return NextResponse.json({ objects: pagedItems, totalFiles: totalItems, totalPages, page, pageSize, hasMore: page < totalPages, isTruncated: isTruncated || false })
}

export async function handleFavorites({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = listSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, false)
  if (!bucket) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { ensuredPath, normalizedPrefix } = normalizePath(validated.prefix || '/')
  const query = validated.query?.trim().toLowerCase()
  const tagFilter = validated.tag?.trim().toLowerCase()

  const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_FAVORITES_LIST', userId: session.user.id, teamId: bucket.credential.teamId, resourceType: 'bucket', resourceId: validated.bucketId, credential: bucket.credential, bucket })
  if (errorResponse) return errorResponse

  const { objects: s3Objects } = await listS3ObjectsWithPrefixes(config, normalizedPrefix, '/')
  const s3KeySet = new Set(s3Objects.map((obj) => obj.key))

  const favorites = (await prismaAny.fileFavorite.findMany({
    where: {
      userId: session.user.id,
      file: {
        bucketId: validated.bucketId,
        parentPath: ensuredPath,
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
        ...(tagFilter ? { tags: { has: tagFilter } } : {}),
      },
    },
    include: { file: true },
    orderBy: { createdAt: 'desc' },
  })) as Array<{ file: { key: string; id: string; name: string; size: bigint; contentType?: string | null; tags?: string[]; description?: string | null; createdAt: Date } }>

  const objects = favorites
    .filter((fav) => s3KeySet.has(fav.file.key))
    .map((fav) => ({
      id: fav.file.id,
      name: fav.file.name,
      key: fav.file.key,
      size: fav.file.size.toString(),
      contentType: fav.file.contentType || undefined,
      tags: fav.file.tags || [],
      description: fav.file.description || null,
      createdAt: fav.file.createdAt.toISOString(),
      isFavorite: true,
    }))

  return NextResponse.json({ objects })
}

export async function handleRecents({ request, session, body, activeTeamId }: HandlerContext) {
  const validated = listSchema.parse(body)

  const bucket = await getAccessibleBucket(validated.bucketId, session.user.id, activeTeamId, false)
  if (!bucket) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { ensuredPath } = normalizePath(validated.prefix || '/')
  const query = validated.query?.trim().toLowerCase()
  const tagFilter = validated.tag?.trim().toLowerCase()

  const logs = await prisma.accessLog.findMany({
    where: { userId: session.user.id, resourceType: 'file', resourceId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { resourceId: true, createdAt: true },
  })

  const resourceIds = Array.from(new Set(logs.map((log) => log.resourceId!).filter(Boolean)))
  if (resourceIds.length === 0) {
    return NextResponse.json({ objects: [] })
  }

  const files = (await prisma.file.findMany({
    where: {
      bucketId: validated.bucketId,
      parentPath: ensuredPath,
      OR: [{ id: { in: resourceIds } }, { key: { in: resourceIds } }],
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      ...(tagFilter ? { tags: { has: tagFilter } } : {}),
    },
  } as any)) as Array<{ id: string; key: string; name: string; size: bigint; contentType?: string | null; tags?: string[]; description?: string | null; createdAt: Date }>

  const fileById = new Map(files.map((file) => [file.id, file]))
  const fileByKey = new Map(files.map((file) => [file.key, file]))

  const objects = logs
    .map((log) => fileById.get(log.resourceId!) || fileByKey.get(log.resourceId!))
    .filter((file): file is NonNullable<typeof file> => file != null)
    .map((file) => ({
      id: file.id,
      name: file.name,
      key: file.key,
      size: file.size.toString(),
      contentType: file.contentType || undefined,
      tags: file.tags || [],
      description: file.description || null,
      createdAt: file.createdAt.toISOString(),
    }))

  return NextResponse.json({ objects })
}
