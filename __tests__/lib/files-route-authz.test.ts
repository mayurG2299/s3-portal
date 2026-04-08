/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    teamMember: { findUnique: jest.fn() },
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
  decryptAWSConfig: jest.fn(),
  generatePresignedUploadUrl: jest.fn(),
  initMultipartUpload: jest.fn(),
  getPresignedUploadPartUrl: jest.fn(),
  completeMultipartUpload: jest.fn(),
  listS3ObjectsWithPrefixes: jest.fn(),
  deleteS3Object: jest.fn(),
  copyS3Object: jest.fn(),
  getS3ObjectMetadata: jest.fn(),
}));

jest.mock('@/lib/storage-quota', () => ({
  checkQuotaBeforeUpload: jest.fn(),
  incrementUsage: jest.fn(),
  decrementUsage: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  buildS3Key: jest.fn(),
}));

import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { POST as filesPost } from '@/app/api/files/route';

const mockSession = (userId: string, teamId?: string) => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: userId, teamId: teamId || null },
  });
};

describe('Files Route team authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a requested teamId when the user is not a member of that selected team', async () => {
    mockSession('user-1', 'team-valid');
    (prisma.teamMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ teamId: 'team-valid' });

    const req = {
      json: async () => ({
        action: 'not_real_action',
        teamId: 'team-invalid',
      }),
      cookies: {
        get: jest.fn().mockReturnValue(undefined),
      },
    } as any;

    const res = await filesPost(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.message).toBe('Forbidden');
  });
});
