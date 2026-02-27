import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import {
  decryptAWSConfig,
  generatePresignedUploadUrl,
  initMultipartUpload,
  getPresignedUploadPartUrl,
  completeMultipartUpload,
  listS3ObjectsWithPrefixes,
  deleteS3Object,
  copyS3Object,
  getS3ObjectMetadata,
} from '@/lib/aws'
import { buildS3Key } from '@/lib/utils'
import { z } from 'zod'
import {
  checkQuotaBeforeUpload,
  incrementUsage,
  decrementUsage,
} from "@/lib/storage-quota";

const prismaAny = prisma as any

const uploadSchema = z.object({
  bucketId: z.string(),
  fileName: z.string(),
  contentType: z.string().optional(),
  size: z.number().int().min(0).optional(),
  path: z.string().default("/"),
  teamId: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
});

const multipartInitSchema = z.object({
  bucketId: z.string(),
  fileName: z.string(),
  contentType: z.string().optional(),
  path: z.string().default('/'),
  teamId: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
})

const multipartPresignSchema = z.object({
  bucketId: z.string(),
  key: z.string(),
  uploadId: z.string(),
  partNumber: z.number().int().min(1),
})

const multipartCompleteSchema = z.object({
  bucketId: z.string(),
  key: z.string(),
  uploadId: z.string(),
  fileId: z.string(),
  parts: z.array(
    z.object({
      ETag: z.string(),
      PartNumber: z.number().int().min(1),
    })
  ).min(1),
})

const listSchema = z.object({
  bucketId: z.string(),
  prefix: z.string().optional(),
  tag: z.string().optional(),
  query: z.string().optional(),
})

const deleteSchema = z.object({
  id: z.string(),
})

const moveSchema = z.object({
  id: z.string(),
  newPath: z.string(),
})

const createFolderSchema = z.object({
  bucketId: z.string(),
  path: z.string(),
  folderName: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
})

const updateTagsSchema = z.object({
  id: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20),
  description: z.string().max(1000).optional(),
})

const toggleFavoriteSchema = z.object({
  id: z.string(),
})

async function getAccessibleBucket(
  bucketId: string,
  userId: string,
  requireAdmin: boolean
) {
  return prisma.awsBucket.findFirst({
    where: {
      id: bucketId,
      credential: {
        OR: [
          { userId },
          {
            team: {
              members: {
                some: {
                  userId,
                  ...(requireAdmin
                    ? { role: { name: { in: ['OWNER', 'ADMIN'] } } }
                    : {}),
                },
              },
            },
          },
        ],
      },
    },
    include: { credential: true },
  })
}

// Generate presigned upload URL
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'FILE_ACTION',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "upload") {
      const validated = uploadSchema.parse(body);

      // Get bucket
      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        true,
      );

      if (!bucket) {
        await logUserAction({
          request,
          action: "FILE_UPLOAD_INIT",
          success: false,
          userId: session.user.id,
          resourceType: "bucket",
          resourceId: validated.bucketId,
          errorMessage: "Forbidden",
        });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const config = decryptAWSConfig(bucket.credential, bucket);
      const key = buildS3Key(validated.path, validated.fileName);

      // Check quota before issuing presigned URL (we don't know final size yet).
      const quotaCheck = await checkQuotaBeforeUpload(
        validated.teamId || bucket.credential.teamId,
        BigInt(0),
      );
      if (!quotaCheck.allowed) {
        await logUserAction({
          request,
          action: "FILE_UPLOAD_INIT",
          success: false,
          userId: session.user.id,
          teamId: validated.teamId,
          resourceType: "file",
          errorMessage: "Quota exceeded",
        });
        return NextResponse.json(
          { message: "Storage quota exceeded" },
          { status: 403 },
        );
      }

      // If client provided an expected size, enforce quota now and optimistically
      // reserve usage immediately. This requires the client to send `size`.
      const expectedSize =
        validated.size !== undefined ? BigInt(validated.size) : null;
      if (expectedSize !== null) {
        const quotaCheck = await checkQuotaBeforeUpload(
          validated.teamId || bucket.credential.teamId,
          expectedSize,
        );
        if (!quotaCheck.allowed) {
          await logUserAction({
            request,
            action: "FILE_UPLOAD_INIT",
            success: false,
            userId: session.user.id,
            teamId: validated.teamId,
            resourceType: "file",
            resourceId: null,
            errorMessage: "Quota exceeded",
          });
          return NextResponse.json(
            { message: "Storage quota exceeded" },
            { status: 403 },
          );
        }
      }

      const { url } = await generatePresignedUploadUrl(
        config,
        key,
        validated.contentType,
      );

      // Create or update file record (avoid duplicate key errors)
      const normalizedTags = Array.from(
        new Set(
          (validated.tags || [])
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0),
        ),
      );
      const normalizedDescription = validated.description?.trim() || null;

      const file = await prisma.file.upsert({
        where: {
          bucketId_key: {
            bucketId: validated.bucketId,
            key,
          },
        },
        update: {
          name: validated.fileName,
          size: 0,
          contentType: validated.contentType,
          parentPath: validated.path,
          userId: session.user.id,
          teamId: validated.teamId,
          tags: normalizedTags,
          description: normalizedDescription,
        },
        create: {
          key,
          name: validated.fileName,
          size: validated.size ?? 0, // If provided, set initial size
          contentType: validated.contentType,
          parentPath: validated.path,
          userId: session.user.id,
          teamId: validated.teamId,
          credentialId: bucket.credentialId,
          bucketId: validated.bucketId,
          tags: normalizedTags,
          description: normalizedDescription,
        },
      });

      // If we reserved quota optimistically, increment usage now
      if (expectedSize !== null && expectedSize > BigInt(0)) {
        try {
          await incrementUsage(
            validated.teamId || bucket.credential.teamId,
            expectedSize,
          );
        } catch (err) {
          console.error("Failed to increment usage on upload init:", err);
        }
      }

      await logUserAction({
        request,
        action: "FILE_UPLOAD_INIT",
        success: true,
        userId: session.user.id,
        teamId: validated.teamId,
        resourceType: "file",
        resourceId: file.id,
        metadata: {
          key,
          credentialId: bucket.credentialId,
          bucketId: validated.bucketId,
          contentType: validated.contentType,
        },
      });

      return NextResponse.json({ url, key, fileId: file.id });
    }

    if (action === 'multipartInit') {
      const validated = multipartInitSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        true
      )

      if (!bucket) {
        await logUserAction({
          request,
          action: 'FILE_MULTIPART_INIT',
          success: false,
          userId: session.user.id,
          resourceType: 'bucket',
          resourceId: validated.bucketId,
          errorMessage: 'Forbidden',
        })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const config = decryptAWSConfig(bucket.credential, bucket)
      const key = buildS3Key(validated.path, validated.fileName)
      const { uploadId } = await initMultipartUpload(config, key, validated.contentType)

      const normalizedTags = Array.from(
        new Set(
          (validated.tags || [])
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        )
      )
      const normalizedDescription = validated.description?.trim() || null

      const file = await prisma.file.upsert({
        where: {
          bucketId_key: {
            bucketId: validated.bucketId,
            key,
          },
        },
        update: {
          name: validated.fileName,
          size: 0,
          contentType: validated.contentType,
          parentPath: validated.path,
          userId: session.user.id,
          teamId: validated.teamId,
          tags: normalizedTags,
          description: normalizedDescription,
        },
        create: {
          key,
          name: validated.fileName,
          size: 0,
          contentType: validated.contentType,
          parentPath: validated.path,
          userId: session.user.id,
          teamId: validated.teamId,
          credentialId: bucket.credentialId,
          bucketId: validated.bucketId,
          tags: normalizedTags,
          description: normalizedDescription,
        },
      })

      await logUserAction({
        request,
        action: 'FILE_MULTIPART_INIT',
        success: true,
        userId: session.user.id,
        teamId: validated.teamId,
        resourceType: 'file',
        resourceId: file.id,
        metadata: {
          key,
          uploadId,
          credentialId: bucket.credentialId,
          bucketId: validated.bucketId,
        },
      })

      return NextResponse.json({ uploadId, key, fileId: file.id })
    }

    if (action === 'multipartPresign') {
      const validated = multipartPresignSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        false
      )

      if (!bucket) {
        await logUserAction({
          request,
          action: 'FILE_MULTIPART_PRESIGN',
          success: false,
          userId: session.user.id,
          resourceType: 'bucket',
          resourceId: validated.bucketId,
          errorMessage: 'Forbidden',
        })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const config = decryptAWSConfig(bucket.credential, bucket)
      const url = await getPresignedUploadPartUrl(
        config,
        validated.key,
        validated.uploadId,
        validated.partNumber
      )

      await logUserAction({
        request,
        action: 'FILE_MULTIPART_PRESIGN',
        success: true,
        userId: session.user.id,
        resourceType: 'file',
        resourceId: validated.key,
        metadata: {
          uploadId: validated.uploadId,
          partNumber: validated.partNumber,
        },
      })

      return NextResponse.json({ url })
    }

    if (action === "multipartComplete") {
      const validated = multipartCompleteSchema.parse(body);

      const file = await prisma.file.findUnique({
        where: { id: validated.fileId },
        include: { credential: true, bucket: true },
      });

      if (!file) {
        await logUserAction({
          request,
          action: "FILE_MULTIPART_COMPLETE",
          success: false,
          userId: session.user.id,
          resourceType: "file",
          resourceId: validated.fileId,
          errorMessage: "File not found",
        });
        return NextResponse.json(
          { message: "File not found" },
          { status: 404 },
        );
      }

      if (file.bucketId !== validated.bucketId) {
        return NextResponse.json(
          { message: "Bucket mismatch" },
          { status: 400 },
        );
      }

      // Verify permissions
      if (file.userId !== session.user.id) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            teamId: file.teamId!,
            userId: session.user.id,
            role: { name: { in: ["OWNER", "ADMIN"] } },
          },
        });

        if (!teamMember) {
          await logUserAction({
            request,
            action: "FILE_MULTIPART_COMPLETE",
            success: false,
            userId: session.user.id,
            teamId: file.teamId,
            resourceType: "file",
            resourceId: file.id,
            errorMessage: "Forbidden",
          });
          return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
      }

      const config = decryptAWSConfig(file.credential, file.bucket);
      await completeMultipartUpload(
        config,
        validated.key,
        validated.uploadId,
        validated.parts,
      );

      // Update file size/contentType after completion and adjust quota
      const meta = await getS3ObjectMetadata(config, validated.key);
      const newSize = BigInt(meta.size);
      const oldSize = BigInt(file.size || 0);
      const delta = newSize > oldSize ? newSize - oldSize : BigInt(0);

      if (delta > BigInt(0)) {
        const quotaCheck = await checkQuotaBeforeUpload(
          file.teamId || file.credential.teamId,
          delta,
        );
        if (!quotaCheck.allowed) {
          await logUserAction({
            request,
            action: "FILE_MULTIPART_COMPLETE",
            success: false,
            userId: session.user.id,
            teamId: file.teamId,
            resourceType: "file",
            resourceId: file.id,
            errorMessage: "Quota exceeded",
          });
          return NextResponse.json(
            { message: "Storage quota exceeded" },
            { status: 403 },
          );
        }
      }

      await prisma.file.update({
        where: { id: validated.fileId },
        data: {
          size: meta.size,
          contentType: meta.contentType ?? file.contentType,
        },
      });

      if (delta > BigInt(0)) {
        try {
          await incrementUsage(file.teamId || file.credential.teamId, delta);
        } catch (err) {
          console.error("Failed to increment usage:", err);
        }
      }

      await logUserAction({
        request,
        action: "FILE_MULTIPART_COMPLETE",
        success: true,
        userId: session.user.id,
        teamId: file.teamId,
        resourceType: "file",
        resourceId: file.id,
        metadata: {
          key: validated.key,
          uploadId: validated.uploadId,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'list') {
      const validated = listSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        false
      )

      if (!bucket) {
        await logUserAction({
          request,
          action: 'FILE_CREATE_FOLDER',
          success: false,
          userId: session.user.id,
          resourceType: 'bucket',
          resourceId: validated.bucketId,
          errorMessage: 'Forbidden',
        })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const rawPath = validated.prefix || '/'
      const normalizedPath =
        rawPath === '/' ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      const ensuredPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
      const normalizedPrefix = ensuredPath === '/' ? '' : ensuredPath.replace(/^\/+/, '')

      const config = decryptAWSConfig(bucket.credential, bucket)
      const { objects: s3Objects, prefixes } = await listS3ObjectsWithPrefixes(
        config,
        normalizedPrefix,
        '/'
      )

      const folderObjectKeys = new Set(
        s3Objects.filter((obj) => obj.key.endsWith('/')).map((obj) => obj.key)
      )
      const mergedPrefixes = Array.from(
        new Set([...prefixes, ...Array.from(folderObjectKeys)])
      ).filter((key) => key !== normalizedPrefix)
      const fileObjects = s3Objects.filter((obj) => !obj.key.endsWith('/'))

      const allKeys = [...mergedPrefixes, ...fileObjects.map((obj) => obj.key)]
      const existing = allKeys.length
        ? await prisma.file.findMany({
            where: {
              bucketId: validated.bucketId,
              key: { in: allKeys },
            },
            select: {
              id: true,
              key: true,
              contentType: true,
            },
          })
        : []

      const existingByKey = new Map(existing.map((file) => [file.key, file]))

      const toCreate = allKeys
        .filter((key) => !existingByKey.has(key))
        .map((key) => {
          const isFolder = key.endsWith('/')
          const trimmedKey = isFolder ? key.slice(0, -1) : key
          const name = trimmedKey.split('/').filter(Boolean).pop() || trimmedKey

          return {
            key,
            name,
            size: isFolder
              ? 0
              : fileObjects.find((obj) => obj.key === key)?.size ?? 0,
            contentType: isFolder ? 'application/x-directory' : undefined,
            parentPath: ensuredPath,
            userId: session.user.id,
            teamId: bucket.credential.teamId,
            credentialId: bucket.credentialId,
            bucketId: validated.bucketId,
          }
        })

      if (toCreate.length > 0) {
        await prisma.file.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
      }

      const synced = allKeys.length
        ? await prisma.file.findMany({
            where: {
              bucketId: validated.bucketId,
              key: { in: allKeys },
            },
            select: {
              id: true,
              key: true,
              contentType: true,
              tags: true,
              description: true,
            },
          } as any)
        : []

      const syncedTyped = synced as Array<{
        id: string
        key: string
        contentType: string | null
        tags?: string[]
        description?: string | null
      }>

      const syncedByKey = new Map(syncedTyped.map((file) => [file.key, file]))
      const dbFolderKeys = new Set(
        syncedTyped
          .filter((file) => file.contentType === 'application/x-directory')
          .map((file) => file.key)
      )

      const folderKeySet = new Set(
        [...mergedPrefixes, ...dbFolderKeys].filter(
          (key) => key !== normalizedPrefix
        )
      )

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
        if (folderKeySet.has(obj.key)) {
          return null
        }

        const relative = normalizedPrefix
          ? obj.key.replace(normalizedPrefix, '')
          : obj.key

        if (relative.includes('/')) {
          return null
        }

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

      const fileIds = fileItems
        .filter((file) => file && typeof file.id === 'string')
        .map((file) => file!.id)

      const favoriteIds = fileIds.length
        ? await prismaAny.fileFavorite.findMany({
            where: {
              userId: session.user.id,
              fileId: { in: fileIds },
            },
            select: { fileId: true },
          })
        : []

      const favoriteIdSet = new Set(
        favoriteIds.map((fav: { fileId: string }) => fav.fileId)
      )

      const query = validated.query?.trim().toLowerCase()
      const filteredFolders = query
        ? folderItems.filter((folder) =>
            folder.name.toLowerCase().includes(query)
          )
        : folderItems

      const tagFilter = validated.tag?.trim().toLowerCase()
      const filteredFilesByTag = tagFilter
        ? fileItems.filter(
            (file) =>
              file &&
              (file.tags || []).some(
                (tag: string) => tag.toLowerCase() === tagFilter
              )
          )
        : fileItems

      const filteredFiles = query
        ? filteredFilesByTag.filter(
            (file) =>
              file &&
              file.name.toLowerCase().includes(query)
          )
        : filteredFilesByTag

      return NextResponse.json({
        objects: [
          ...filteredFolders,
          ...filteredFiles
            .filter(Boolean)
            .map((file) => ({
              ...file,
              isFavorite: favoriteIdSet.has(file!.id),
            })),
        ],
      })
    }

    if (action === 'favorites') {
      const validated = listSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        false
      )

      if (!bucket) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const rawPath = validated.prefix || '/'
      const normalizedPath =
        rawPath === '/' ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      const ensuredPath = normalizedPath.endsWith('/')
        ? normalizedPath
        : `${normalizedPath}/`
      const normalizedPrefix = ensuredPath === '/' ? '' : ensuredPath.replace(/^\/+/, '')
      const query = validated.query?.trim().toLowerCase()
      const tagFilter = validated.tag?.trim().toLowerCase()

      const config = decryptAWSConfig(bucket.credential, bucket)
      const { objects: s3Objects } = await listS3ObjectsWithPrefixes(
        config,
        normalizedPrefix,
        '/'
      )
      const s3KeySet = new Set(s3Objects.map((obj) => obj.key))

      const favorites = (await prismaAny.fileFavorite.findMany({
        where: {
          userId: session.user.id,
          file: {
            bucketId: validated.bucketId,
            parentPath: ensuredPath,
            ...(query
              ? { name: { contains: query, mode: 'insensitive' } }
              : {}),
            ...(tagFilter ? { tags: { has: tagFilter } } : {}),
          },
        },
        include: {
          file: true,
        },
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

    if (action === 'recents') {
      const validated = listSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        false
      )

      if (!bucket) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const rawPath = validated.prefix || '/'
      const normalizedPath =
        rawPath === '/' ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      const ensuredPath = normalizedPath.endsWith('/')
        ? normalizedPath
        : `${normalizedPath}/`
      const normalizedPrefix = ensuredPath === '/' ? '' : ensuredPath.replace(/^\/+/, '')
      const query = validated.query?.trim().toLowerCase()
      const tagFilter = validated.tag?.trim().toLowerCase()

      const config = decryptAWSConfig(bucket.credential, bucket)
      const { objects: s3Objects } = await listS3ObjectsWithPrefixes(
        config,
        normalizedPrefix,
        '/'
      )
      const s3KeySet = new Set(s3Objects.map((obj) => obj.key))

      const logs = await prisma.accessLog.findMany({
        where: {
          userId: session.user.id,
          resourceType: 'file',
          resourceId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { resourceId: true, createdAt: true },
      })

      const resourceIds = Array.from(
        new Set(logs.map((log) => log.resourceId!).filter(Boolean))
      )

      if (resourceIds.length === 0) {
        return NextResponse.json({ objects: [] })
      }

      const files = (await prisma.file.findMany({
        where: {
          bucketId: validated.bucketId,
          parentPath: ensuredPath,
          OR: [{ id: { in: resourceIds } }, { key: { in: resourceIds } }],
          ...(query
            ? { name: { contains: query, mode: 'insensitive' } }
            : {}),
          ...(tagFilter ? { tags: { has: tagFilter } } : {}),
        },
      } as any)) as Array<{ id: string; key: string; name: string; size: bigint; contentType?: string | null; tags?: string[]; description?: string | null; createdAt: Date }>

      const fileById = new Map(files.map((file) => [file.id, file]))
      const fileByKey = new Map(files.map((file) => [file.key, file]))

      const objects = logs
        .map((log) => fileById.get(log.resourceId!) || fileByKey.get(log.resourceId!))
        .filter((file) => file && s3KeySet.has(file.key))
        .map((file) => ({
          id: file!.id,
          name: file!.name,
          key: file!.key,
          size: file!.size.toString(),
          contentType: file!.contentType || undefined,
          tags: file!.tags || [],
          description: file!.description || null,
          createdAt: file!.createdAt.toISOString(),
        }))

      return NextResponse.json({ objects })
    }

    if (action === 'toggleFavorite') {
      const validated = toggleFavoriteSchema.parse(body)

      const file = await prisma.file.findUnique({
        where: { id: validated.id },
      })

      if (!file) {
        return NextResponse.json({ message: 'File not found' }, { status: 404 })
      }

      if (file.userId !== session.user.id) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            teamId: file.teamId!,
            userId: session.user.id,
            role: { name: { in: ['OWNER', 'ADMIN'] } },
          },
        })

        if (!teamMember) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
        }
      }

      const existing = await prismaAny.fileFavorite.findUnique({
        where: {
          userId_fileId: {
            userId: session.user.id,
            fileId: validated.id,
          },
        },
      })

      if (existing) {
        await prismaAny.fileFavorite.delete({
          where: { id: existing.id },
        })

        return NextResponse.json({ id: validated.id, isFavorite: false })
      }

      await prismaAny.fileFavorite.create({
        data: { userId: session.user.id, fileId: validated.id },
      })

      return NextResponse.json({ id: validated.id, isFavorite: true })
    }

    if (action === 'updateTags') {
      const validated = updateTagsSchema.parse(body)

      const file = await prisma.file.findUnique({
        where: { id: validated.id },
        include: { credential: true },
      })

      if (!file) {
        return NextResponse.json({ message: 'File not found' }, { status: 404 })
      }

      if (file.userId !== session.user.id) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            teamId: file.teamId!,
            userId: session.user.id,
            role: { name: { in: ['OWNER', 'ADMIN'] } },
          },
        })

        if (!teamMember) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
        }
      }

      const normalizedTags = Array.from(
        new Set(
          validated.tags
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        )
      )

      const normalizedDescription = validated.description?.trim() || null

      const updated = await prisma.file.update({
        where: { id: validated.id },
        data: { tags: normalizedTags, description: normalizedDescription },
        select: { id: true, tags: true, description: true },
      } as any)

      await logUserAction({
        request,
        action: 'FILE_TAG_UPDATE',
        success: true,
        userId: session.user.id,
        teamId: file.teamId,
        resourceType: 'file',
        resourceId: file.id,
        metadata: { tags: normalizedTags },
      })

      return NextResponse.json(updated)
    }

    if (action === 'createFolder') {
      const validated = createFolderSchema.parse(body)

      const bucket = await getAccessibleBucket(
        validated.bucketId,
        session.user.id,
        true
      )

      if (!bucket) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }

      const normalizedTags = Array.from(
        new Set(
          (validated.tags || [])
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
        )
      )
      const normalizedDescription = validated.description?.trim() || null

      const config = decryptAWSConfig(bucket.credential, bucket)
      const folderKey = buildS3Key(validated.path, validated.folderName + '/')

      const existingFolder = await prisma.file.findUnique({
        where: {
          bucketId_key: {
            bucketId: validated.bucketId,
            key: folderKey,
          },
        },
      })

      if (existingFolder) {
        return NextResponse.json(
          { message: 'Folder already exists' },
          { status: 409 }
        )
      }

      // Create empty object to represent folder
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      })

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: folderKey,
          Body: '',
        })
      )

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

      await logUserAction({
        request,
        action: 'FILE_CREATE_FOLDER',
        success: true,
        userId: session.user.id,
        teamId: bucket.credential.teamId,
        resourceType: 'file',
        resourceId: folderKey,
        metadata: {
          credentialId: bucket.credentialId,
          bucketId: validated.bucketId,
          path: validated.path,
          folderName: validated.folderName,
          tags: normalizedTags,
        },
      })

      return NextResponse.json({ success: true, key: folderKey })
    }

    await logUserAction({
      request,
      action: 'FILE_ACTION',
      success: false,
      userId: session.user.id,
      errorMessage: 'Invalid action',
      metadata: { action },
    })
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in files API:', error)

    await logUserAction({
      request,
      action: 'FILE_ACTION',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: "FILE_DELETE",
        success: false,
        errorMessage: "Unauthorized",
      });
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      await logUserAction({
        request,
        action: "FILE_DELETE",
        success: false,
        userId: session.user.id,
        errorMessage: "File ID is required",
      });
      return NextResponse.json(
        { message: "File ID is required" },
        { status: 400 },
      );
    }

    const file = await prisma.file.findUnique({
      where: { id },
      include: { credential: true, bucket: true },
    });

    if (!file) {
      await logUserAction({
        request,
        action: "FILE_DELETE",
        success: false,
        userId: session.user.id,
        resourceType: "file",
        resourceId: id,
        errorMessage: "File not found",
      });
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Verify permissions
    if (file.userId !== session.user.id) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: file.teamId!,
          userId: session.user.id,
          role: { name: { in: ["OWNER", "ADMIN"] } },
        },
      });

      if (!teamMember) {
        await logUserAction({
          request,
          action: "FILE_DELETE",
          success: false,
          userId: session.user.id,
          teamId: file.teamId,
          resourceType: "file",
          resourceId: file.id,
          errorMessage: "Forbidden",
        });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    const config = decryptAWSConfig(file.credential, file.bucket);
    await deleteS3Object(config, file.key);

    // Decrement quota usage (if any) then delete DB record
    try {
      const size = BigInt(file.size || 0);
      if (size > BigInt(0)) {
        await decrementUsage(file.teamId || file.credential.teamId, size);
      }
    } catch (err) {
      console.error("Failed to decrement usage:", err);
    }

    await prisma.file.delete({ where: { id } });

    await logUserAction({
      request,
      action: "FILE_DELETE",
      success: true,
      userId: session.user.id,
      teamId: file.teamId,
      resourceType: "file",
      resourceId: file.id,
      metadata: { key: file.key },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file:', error)
    await logUserAction({
      request,
      action: 'FILE_DELETE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update file (move/rename)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'FILE_MOVE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = moveSchema.parse(body)

    const file = await prisma.file.findUnique({
      where: { id: validated.id },
      include: { credential: true, bucket: true },
    })

    if (!file) {
      await logUserAction({
        request,
        action: 'FILE_MOVE',
        success: false,
        userId: session.user.id,
        resourceType: 'file',
        resourceId: validated.id,
        errorMessage: 'File not found',
      })
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    // Verify permissions
    if (file.userId !== session.user.id) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: file.teamId!,
          userId: session.user.id,
          role: { name: { in: ['OWNER', 'ADMIN'] } },
        },
      })

      if (!teamMember) {
        await logUserAction({
          request,
          action: 'FILE_MOVE',
          success: false,
          userId: session.user.id,
          teamId: file.teamId,
          resourceType: 'file',
          resourceId: file.id,
          errorMessage: 'Forbidden',
        })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const config = decryptAWSConfig(file.credential, file.bucket)
    const newKey = buildS3Key(validated.newPath, file.name)

    await copyS3Object(config, file.key, newKey, true)

    await prisma.file.update({
      where: { id: validated.id },
      data: {
        key: newKey,
        parentPath: validated.newPath,
      },
    })

    await logUserAction({
      request,
      action: 'FILE_MOVE',
      success: true,
      userId: session.user.id,
      teamId: file.teamId,
      resourceType: 'file',
      resourceId: file.id,
      metadata: {
        oldKey: file.key,
        newKey,
        newPath: validated.newPath,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error moving file:', error)

    await logUserAction({
      request,
      action: 'FILE_MOVE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
