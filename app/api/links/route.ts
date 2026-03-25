import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import {
  decryptAWSConfig,
  generatePresignedDownloadUrl,
  generateCloudfrontSignedUrl,
} from '@/lib/aws'
import { hashPassword } from '@/lib/crypto'
import { generateLinkHash } from '@/lib/utils'

import { z } from 'zod'

// AWS SDK v3: max presigned URL TTL is 7 days (604800 seconds)
const S3_MAX_PRESIGNED_TTL_SECONDS = 604800 // 7 days — AWS SDK limit

const createLinkSchema = z.object({
  fileId: z.string(),
  type: z.enum(['PUBLIC', 'PRESIGNED', 'CLOUDFRONT']).optional(),
  expiresIn: z
    .number()
    .int()
    .positive()
    .max(
      S3_MAX_PRESIGNED_TTL_SECONDS,
      'Presigned links cannot exceed 7 days (604800 seconds).'
    )
    .optional(), // in seconds
  password: z.string().optional(),
  maxDownloads: z.number().optional(),
  allowDownload: z.boolean().default(true),
  allowPreview: z.boolean().default(true),
  useCdn: z.boolean().default(true), // Auto-use CDN if available
  mode: z.enum(['preview', 'download', 'direct', 'raw']).default('preview'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'LINK_CREATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createLinkSchema.parse(body)

    // Get file with credential
    const file = await prisma.file.findUnique({
      where: { id: validated.fileId },
      include: { credential: true, bucket: true },
    })

    if (!file) {
      await logUserAction({
        request,
        action: 'LINK_CREATE',
        success: false,
        userId: session.user.id,
        resourceType: 'file',
        resourceId: validated.fileId,
        errorMessage: 'File not found',
      })
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    // Verify permissions
    if (file.userId !== session.user.id && file.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: file.teamId,
          userId: session.user.id,
        },
      })

      if (!teamMember) {
        await logUserAction({
          request,
          action: 'LINK_CREATE',
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

    // Generate link hash
    const hash = generateLinkHash(16)

    // Auto-detect link type based on credential config and user preference
    const config = decryptAWSConfig(file.credential, file.bucket)
    let linkType = validated.type
    
    if (!linkType) {
      // Auto-select type based on credential configuration
      if (validated.useCdn && config.cloudfrontDomain && config.cloudfrontKeyPairId && config.cloudfrontPrivateKey) {
        linkType = 'CLOUDFRONT'
      } else {
        linkType = 'PRESIGNED'
      }
    }

    // Hash password if provided
    const passwordHash = validated.password
      ? await hashPassword(validated.password)
      : null

    // Calculate expiry
    const expiresAt = validated.expiresIn
      ? new Date(Date.now() + validated.expiresIn * 1000)
      : null

    // If mode is raw, skip creating a database link and just return the unsigned native URL
    if (validated.mode === 'raw') {
      const nativeUrl = config.cloudfrontDomain
        ? `https://${config.cloudfrontDomain}/${file.key}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${file.key}`

      await logUserAction({
        request,
        action: 'LINK_CREATE',
        success: true,
        userId: session.user.id,
        teamId: file.teamId,
        resourceType: 'file',
        resourceId: file.id,
        metadata: {
          fileId: file.id,
          linkType: 'RAW_PUBLIC',
          expiresAt: null,
        },
      })

      return NextResponse.json({
        id: 'raw',
        url: nativeUrl,
        hash: 'raw',
        expiresAt: null,
      })
    }

    // If mode is direct, skip creating a database link and return the signed native URL
    if (validated.mode === 'direct') {
      const nativeUrl = linkType === 'CLOUDFRONT'
        ? generateCloudfrontSignedUrl(config, file.key, validated.expiresIn || 3600)
        : await generatePresignedDownloadUrl(config, file.key, validated.expiresIn || 3600, file.name)

      await logUserAction({
        request,
        action: 'LINK_CREATE',
        success: true,
        userId: session.user.id,
        teamId: file.teamId,
        resourceType: 'file',
        resourceId: file.id,
        metadata: {
          fileId: file.id,
          linkType: 'DIRECT',
          expiresAt: expiresAt?.toISOString() ?? null,
        },
      })

      return NextResponse.json({
        id: 'direct',
        url: nativeUrl,
        hash: 'direct',
        expiresAt,
      })
    }

    // Create link
    const link = await prisma.link.create({
      data: {
        hash,
        type: linkType,
        fileId: validated.fileId,
        expiresAt,
        passwordHash,
        maxDownloads: validated.maxDownloads,
        allowDownload: validated.allowDownload,
        allowPreview: validated.allowPreview,
        userId: session.user.id,
      },
    })

    const publicUrl = validated.mode === 'download'
      ? `${process.env.NEXT_PUBLIC_APP_URL}/share/${hash}?download=true`
      : `${process.env.NEXT_PUBLIC_APP_URL}/share/${hash}`

    await logUserAction({
      request,
      action: 'LINK_CREATE',
      success: true,
      userId: session.user.id,
      teamId: file.teamId,
      resourceType: 'link',
      resourceId: link.id,
      metadata: {
        fileId: file.id,
        linkType,
        mode: validated.mode,
        expiresAt: link.expiresAt?.toISOString() ?? null,
      },
    })

    return NextResponse.json({
      id: link.id,
      url: publicUrl,
      hash: link.hash,
      expiresAt: link.expiresAt,
    })
  } catch (error: any) {
    console.error('Error creating link:', error)

    await logUserAction({
      request,
      action: 'LINK_CREATE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      )
    }

    // Catch AWS SDK expiration errors as 400 (validation error)
    if (
      typeof error?.message === 'string' &&
      /expiration|Expiry|expire|Expiration/i.test(error.message)
    ) {
      return NextResponse.json(
        { message: 'Presigned links cannot exceed 7 days (604800 seconds).' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'LINK_DELETE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    const where: any = {
      file: {
        teamId: session.user.teamId || null,
      },
    }

    if (fileId) {
      where.fileId = fileId
    }

    const links = await prisma.link.findMany({
      where,
      include: {
        file: {
          select: {
            name: true,
            size: true,
            contentType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Convert BigInt to string for JSON serialization
    const serializedLinks = links.map((link) => ({
      ...link,
      file: {
        ...link.file,
        size: link.file.size.toString(),
      },
    }))

    return NextResponse.json(serializedLinks)
  } catch (error) {
    console.error('Error fetching links:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      await logUserAction({
        request,
        action: 'LINK_DELETE',
        success: false,
        userId: session.user.id,
        errorMessage: 'Link ID is required',
      })
      return NextResponse.json(
        { message: 'Link ID is required' },
        { status: 400 }
      )
    }

    const link = await prisma.link.findUnique({
      where: { id },
      select: { userId: true, file: { select: { id: true, teamId: true } } },
    })

    if (!link || link.userId !== session.user.id) {
      await logUserAction({
        request,
        action: 'LINK_DELETE',
        success: false,
        userId: session.user.id,
        resourceType: 'link',
        resourceId: id,
        teamId: link?.file?.teamId,
        errorMessage: 'Forbidden',
      })
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    await prisma.link.delete({ where: { id } })

    await logUserAction({
      request,
      action: 'LINK_DELETE',
      success: true,
      userId: session.user.id,
      resourceType: 'link',
      resourceId: id,
      teamId: link.file?.teamId,
      metadata: { fileId: link.file?.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting link:', error)
    await logUserAction({
      request,
      action: 'LINK_DELETE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
