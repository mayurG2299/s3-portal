import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params
    if (!fileId) {
      return NextResponse.json({ message: 'fileId is required' }, { status: 400 })
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { credential: true, bucket: true },
    })
    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    const config = decryptAWSConfig(file.credential as any, file.bucket as any)
    const ttlSeconds = 60 * 15 // 15 minutes
    let url: string
    if (file.bucket.cloudfrontDomain && file.bucket.cloudfrontKeyPairId) {
      url = generateCloudfrontSignedUrl(config, file.key, ttlSeconds)
    } else {
      url = await generatePresignedDownloadUrl(config, file.key, ttlSeconds)
    }

    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('Error generating direct link:', error)
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 })
  }
}