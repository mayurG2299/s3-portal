import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { type AWSConfig, decryptAWSConfig } from '@/lib/aws'
import { canAccessBucket } from '@/lib/bucket-access'
import { z } from 'zod'
import type { Session } from 'next-auth'

export type HandlerContext = {
  request: NextRequest
  session: Session & { user: { id: string; teamId?: string | null } }
  body: any
  activeTeamId: string | null
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export const uploadSchema = z.object({
  bucketId: z.string(),
  fileName: z.string(),
  contentType: z.string().optional(),
  size: z.number().int().min(0).optional(),
  path: z.string().default('/'),
  teamId: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
})

export const multipartInitSchema = z.object({
  bucketId: z.string(),
  fileName: z.string(),
  contentType: z.string().optional(),
  size: z.number().int().min(0),
  path: z.string().default('/'),
  teamId: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
})

export const multipartPresignSchema = z.object({
  bucketId: z.string(),
  key: z.string(),
  uploadId: z.string(),
  partNumber: z.number().int().min(1),
})

export const multipartCompleteSchema = z.object({
  bucketId: z.string(),
  key: z.string(),
  uploadId: z.string(),
  fileId: z.string(),
  parts: z
    .array(z.object({ ETag: z.string(), PartNumber: z.number().int().min(1) }))
    .min(1),
})

export const listSchema = z.object({
  bucketId: z.string(),
  prefix: z.string().optional(),
  tag: z.string().optional(),
  query: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
})

export const toggleFavoriteSchema = z.object({ id: z.string() })

export const updateTagsSchema = z.object({
  id: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20),
  description: z.string().max(1000).optional(),
})

export const createFolderSchema = z.object({
  bucketId: z.string(),
  path: z.string(),
  folderName: z.string(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  description: z.string().max(1000).optional(),
})

export const moveSchema = z.object({
  id: z.string(),
  newPath: z.string(),
})

export async function getAccessibleBucket(
  bucketId: string,
  userId: string,
  teamId: string | null | undefined,
  requireAdmin: boolean
) {
  const bucket = await prisma.awsBucket.findFirst({
    where: {
      id: bucketId,
      credential: {
        teamId: teamId || null,
        ...(teamId
          ? {
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
            }
          : { userId }),
      },
    },
    include: { credential: true },
  })

  if (!bucket) return null

  if (teamId && !requireAdmin) {
    const allowed = await canAccessBucket(userId, teamId, bucketId)
    if (!allowed) return null
  }

  return bucket
}

export async function resolveActiveTeamId(params: {
  requestedTeamId: string | null
  sessionTeamId: string | null
  userId: string
}): Promise<string | null> {
  const tryTeam = async (teamId: string | null) => {
    if (!teamId) return null
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: params.userId } },
      select: { teamId: true },
    })
    return membership?.teamId || null
  }

  return (await tryTeam(params.requestedTeamId)) ?? (await tryTeam(params.sessionTeamId))
}

export async function decryptConfigOrError(params: {
  request: NextRequest
  action: string
  userId: string
  teamId?: string | null
  resourceType: 'bucket' | 'file'
  resourceId: string
  credential: { encryptedAccessKey: string; encryptedSecretKey: string; region: string }
  bucket: {
    bucket: string
    cloudfrontDomain?: string | null
    cloudfrontKeyPairId?: string | null
    encryptedCloudfrontPrivateKey?: string | null
  }
}): Promise<{ config: AWSConfig; errorResponse: null } | { config: null; errorResponse: NextResponse }> {
  try {
    return { config: decryptAWSConfig(params.credential, params.bucket), errorResponse: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to decrypt data'
    console.error('Failed to decrypt AWS credential in files API:', {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      userId: params.userId,
      teamId: params.teamId || null,
      error: message,
    })
    await logUserAction({
      request: params.request,
      action: params.action,
      success: false,
      userId: params.userId,
      teamId: params.teamId || null,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      errorMessage: `Credential decryption failed: ${message}`,
    })
    return {
      config: null,
      errorResponse: NextResponse.json(
        { message: 'Stored cloud credentials could not be decrypted. Please re-save this credential and retry.' },
        { status: 500 }
      ),
    }
  }
}

export function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags || [])
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  )
}

export function normalizePath(rawPath: string): { ensuredPath: string; normalizedPrefix: string } {
  const normalizedPath =
    rawPath === '/' ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const ensuredPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
  const normalizedPrefix = ensuredPath === '/' ? '' : ensuredPath.replace(/^\/+/, '')
  return { ensuredPath, normalizedPrefix }
}
