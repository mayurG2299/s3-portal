/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    teamMember: { findUnique: jest.fn() },
    awsBucket: { findFirst: jest.fn() },
    file: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/aws', () => ({
  decryptAWSConfig: jest.fn().mockReturnValue({
    accessKeyId: 'test-access',
    secretAccessKey: 'test-secret',
    region: 'us-east-1',
    bucket: 'bucket-name',
  }),
  generatePresignedUploadUrl: jest.fn(),
  initMultipartUpload: jest.fn(),
  getPresignedUploadPartUrl: jest.fn(),
  completeMultipartUpload: jest.fn(),
  listS3ObjectsWithPrefixes: jest.fn(),
  deleteS3Object: jest.fn(),
  copyS3Object: jest.fn(),
  getS3ObjectMetadata: jest.fn(),
  createFolderMarkerObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/storage-quota', () => ({
  checkQuotaBeforeUpload: jest.fn(),
  incrementUsage: jest.fn(),
  decrementUsage: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  buildS3Key: jest.fn((_path: string, folderName: string) => `docs/${folderName}`),
}));

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

jest.mock('@/lib/events/files', () => ({
  publishFileChanged: jest.fn(),
}));

import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { POST as filesPost } from '@/app/api/files/route';

const awsMocks = jest.requireMock('@/lib/aws') as {
  createFolderMarkerObject: jest.Mock;
};

describe('Files Route createFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', teamId: 'team-1' },
    });

    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({ teamId: 'team-1' });
    (prisma.awsBucket.findFirst as jest.Mock).mockResolvedValue({
      id: 'bucket-1',
      bucket: 'bucket-name',
      credentialId: 'cred-1',
      credential: {
        id: 'cred-1',
        teamId: 'team-1',
        encryptedAccessKey: 'enc-access',
        encryptedSecretKey: 'enc-secret',
        region: 'us-east-1',
      },
    });
    (prisma.file.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.file.create as jest.Mock).mockResolvedValue({ id: 'file-folder-1' });
  });

  it('uploads folder marker through AWS wrapper without direct PutObject in route', async () => {
    const req = {
      json: async () => ({
        action: 'createFolder',
        bucketId: 'bucket-1',
        path: '/docs',
        folderName: 'new-folder',
      }),
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
    } as any;

    const res = await filesPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(awsMocks.createFolderMarkerObject).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'bucket-name' }),
      'docs/new-folder/'
    );
  });
});
