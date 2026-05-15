/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    teamMember: { findUnique: jest.fn() },
    awsBucket: { findFirst: jest.fn() },
    file: { upsert: jest.fn() },
  },
}))

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/aws', () => ({
  decryptAWSConfig: jest.fn().mockReturnValue({}),
  generatePresignedUploadUrl: jest.fn(),
  initMultipartUpload: jest.fn(),
  getPresignedUploadPartUrl: jest.fn(),
  completeMultipartUpload: jest.fn(),
  listS3ObjectsWithPrefixes: jest.fn(),
  deleteS3Object: jest.fn(),
  copyS3Object: jest.fn(),
  getS3ObjectMetadata: jest.fn(),
}))

jest.mock('@/lib/storage-quota', () => ({
  checkQuotaBeforeUpload: jest.fn(),
  incrementUsage: jest.fn(),
  decrementUsage: jest.fn(),
}))

jest.mock('@/lib/utils', () => ({
  buildS3Key: jest.fn(() => 'docs/big-video.mov'),
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/lib/events/files', () => ({
  publishFileChanged: jest.fn(),
}))

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { generatePresignedUploadUrl, initMultipartUpload } from '@/lib/aws'
import { checkQuotaBeforeUpload, incrementUsage } from '@/lib/storage-quota'
import { POST as filesPost } from '@/app/api/files/route'

describe('Files Route multipart quota enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', teamId: 'team-1' },
    })

    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({ teamId: 'team-1' })
    ;(prisma.awsBucket.findFirst as jest.Mock).mockResolvedValue({
      id: 'bucket-1',
      bucket: 'bucket-name',
      credentialId: 'cred-1',
      credential: {
        teamId: 'team-1',
        encryptedAccessKey: 'enc-access',
        encryptedSecretKey: 'enc-secret',
        region: 'us-east-1',
      },
    })
    ;(prisma.file.upsert as jest.Mock).mockResolvedValue({ id: 'file-1' })
  })

  it('rejects multipart upload init when the requested file size exceeds quota', async () => {
    ;(checkQuotaBeforeUpload as jest.Mock).mockResolvedValue({
      allowed: false,
      used: BigInt(95),
      limit: BigInt(100),
    })

    const req = {
      json: async () => ({
        action: 'multipartInit',
        bucketId: 'bucket-1',
        fileName: 'big-video.mov',
        contentType: 'video/quicktime',
        path: '/docs',
        teamId: 'team-1',
        size: 10,
      }),
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
    } as any

    const res = await filesPost(req)
    const json = await res.json()

    expect(checkQuotaBeforeUpload).toHaveBeenCalledWith('team-1', BigInt(10))
    expect(initMultipartUpload).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    expect(json.message).toBe('Storage quota exceeded')
  })

  it('does not reserve usage or persist requested size during single upload init', async () => {
    ;(checkQuotaBeforeUpload as jest.Mock).mockResolvedValue({
      allowed: true,
      used: BigInt(0),
      limit: BigInt(1000),
    })
    ;(generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      url: 'https://example.com/upload',
    })

    const req = {
      json: async () => ({
        action: 'upload',
        bucketId: 'bucket-1',
        fileName: 'planned-size.bin',
        contentType: 'application/octet-stream',
        path: '/docs',
        teamId: 'team-1',
        size: 500,
      }),
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
    } as any

    const res = await filesPost(req)

    expect(res.status).toBe(200)
    expect(prisma.file.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          size: 0,
        }),
      }),
    )
    expect(incrementUsage).not.toHaveBeenCalled()
  })
})