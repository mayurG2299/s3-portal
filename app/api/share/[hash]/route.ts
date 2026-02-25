import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'
import { verifyPassword } from '@/lib/crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const { hash } = params
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    const link = await prisma.link.findUnique({
      where: { hash },
      include: {
        file: {
          include: {
            credential: true,
            bucket: true,
          },
        },
      },
    })

    if (!link) {
      await logUserAction({
        request,
        action: 'LINK_SHARE_DOWNLOAD',
        success: false,
        resourceType: 'link',
        metadata: { hash },
        errorMessage: 'Link not found',
      })
      return NextResponse.json({ message: 'Link not found' }, { status: 404 })
    }

    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      await logUserAction({
        request,
        action: 'LINK_SHARE_DOWNLOAD',
        success: false,
        linkId: link.id,
        resourceType: 'link',
        resourceId: link.id,
        teamId: link.file.teamId,
        errorMessage: 'Link expired',
      })
      return NextResponse.json({ message: 'Link expired' }, { status: 410 })
    }

    // Check download limit
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      await logUserAction({
        request,
        action: 'LINK_SHARE_DOWNLOAD',
        success: false,
        linkId: link.id,
        resourceType: 'link',
        resourceId: link.id,
        teamId: link.file.teamId,
        errorMessage: 'Download limit reached',
      })
      return NextResponse.json(
        { message: 'Download limit reached' },
        { status: 403 }
      )
    }

    // Check password
    if (link.passwordHash) {
      if (!password) {
        await logUserAction({
          request,
          action: 'LINK_SHARE_DOWNLOAD',
          success: false,
          linkId: link.id,
          resourceType: 'link',
          resourceId: link.id,
          teamId: link.file.teamId,
          errorMessage: 'Password required',
        })
        return NextResponse.json(
          { message: 'Password required', requiresPassword: true },
          { status: 401 }
        )
      }

      const isValid = await verifyPassword(password, link.passwordHash)
      if (!isValid) {
        await logUserAction({
          request,
          action: 'LINK_SHARE_DOWNLOAD',
          success: false,
          linkId: link.id,
          resourceType: 'link',
          resourceId: link.id,
          teamId: link.file.teamId,
          errorMessage: 'Invalid password',
        })
        return NextResponse.json(
          { message: 'Invalid password' },
          { status: 401 }
        )
      }
    }

    const config = decryptAWSConfig(link.file.credential, link.file.bucket)

    const downloadUrl = link.type === 'CLOUDFRONT'
      ? generateCloudfrontSignedUrl(config, link.file.key, 3600)
      : await generatePresignedDownloadUrl(
          config,
          link.file.key,
          3600,
          link.file.name
        )

    // Increment download count
    await prisma.link.update({
      where: { id: link.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    })

    // Log access
    await logUserAction({
      request,
      action: 'LINK_SHARE_DOWNLOAD',
      success: true,
      linkId: link.id,
      resourceType: 'link',
      resourceId: link.id,
      teamId: link.file.teamId,
      metadata: {
        fileId: link.file.id,
        fileKey: link.file.key,
      },
    })

    return NextResponse.json({
      file: {
        name: link.file.name,
        size: link.file.size.toString(),
        contentType: link.file.contentType,
      },
      downloadUrl,
      allowDownload: link.allowDownload,
      allowPreview: link.allowPreview,
    })
  } catch (error) {
    console.error('Error accessing share:', error)
    await logUserAction({
      request,
      action: 'LINK_SHARE_DOWNLOAD',
      success: false,
      errorMessage: 'Internal server error',
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
