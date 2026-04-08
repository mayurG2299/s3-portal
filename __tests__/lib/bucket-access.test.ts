/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    teamMember: { findUnique: jest.fn() },
    teamMemberBucketAccess: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(require('@/lib/db').prisma);
      // array form: execute each item (they are already resolved prisma calls when mocked)
      return Promise.all(fn);
    }),
  },
}));

import { prisma } from '@/lib/db';
import { getAccessibleBucketIds, canAccessBucket, grantBucketAccess, setBucketAccess } from '@/lib/bucket-access';

describe('getAccessibleBucketIds', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null for ADMIN (role level 50)', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 50 },
      bucketAccess: [],
    });

    const result = await getAccessibleBucketIds('user-1', 'team-1');
    expect(result).toBeNull();
  });

  it('returns null for OWNER (role level 100)', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 100 },
      bucketAccess: [],
    });

    const result = await getAccessibleBucketIds('user-1', 'team-1');
    expect(result).toBeNull();
  });

  it('returns allowed bucket IDs for VIEWER (role level 10)', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 10 },
      bucketAccess: [{ bucketId: 'b1' }, { bucketId: 'b2' }],
    });

    const result = await getAccessibleBucketIds('user-1', 'team-1');
    expect(result).toEqual(['b1', 'b2']);
  });

  it('returns empty array when member has no bucket access rows', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 10 },
      bucketAccess: [],
    });

    const result = await getAccessibleBucketIds('user-1', 'team-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when member not found', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getAccessibleBucketIds('user-1', 'team-1');
    expect(result).toEqual([]);
  });
});

describe('canAccessBucket', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns true for ADMIN (role level >= 50)', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 50 },
      id: 'tm1',
    });

    const result = await canAccessBucket('user-1', 'team-1', 'bucket-1');
    expect(result).toBe(true);
    // For admin, the teamMemberBucketAccess lookup is never needed
    expect(prisma.teamMemberBucketAccess.findUnique).not.toHaveBeenCalled();
  });

  it('returns true when bucket is in allowed list', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 10 },
      id: 'tm1',
    });
    (prisma.teamMemberBucketAccess.findUnique as jest.Mock).mockResolvedValue({
      id: 'ba1',
    });

    const result = await canAccessBucket('user-1', 'team-1', 'bucket-1');
    expect(result).toBe(true);
    expect(prisma.teamMemberBucketAccess.findUnique).toHaveBeenCalledWith({
      where: { teamMemberId_bucketId: { teamMemberId: 'tm1', bucketId: 'bucket-1' } },
      select: { id: true },
    });
  });

  it('returns false when bucket is not in allowed list', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      role: { level: 10 },
      id: 'tm1',
    });
    (prisma.teamMemberBucketAccess.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await canAccessBucket('user-1', 'team-1', 'bucket-99');
    expect(result).toBe(false);
  });

  it('returns false when member not found', async () => {
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await canAccessBucket('user-1', 'team-1', 'bucket-1');
    expect(result).toBe(false);
    expect(prisma.teamMemberBucketAccess.findUnique).not.toHaveBeenCalled();
  });
});

describe('grantBucketAccess', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls createMany with skipDuplicates for the given bucket IDs', async () => {
    (prisma.teamMemberBucketAccess.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    await grantBucketAccess('tm-1', ['bucket-1', 'bucket-2']);

    expect(prisma.teamMemberBucketAccess.createMany).toHaveBeenCalledWith({
      data: [
        { teamMemberId: 'tm-1', bucketId: 'bucket-1' },
        { teamMemberId: 'tm-1', bucketId: 'bucket-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('does nothing when bucketIds is empty', async () => {
    await grantBucketAccess('tm-1', []);

    expect(prisma.teamMemberBucketAccess.createMany).not.toHaveBeenCalled();
  });
});

describe('setBucketAccess', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.teamMemberBucketAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.teamMemberBucketAccess.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (ops: any[]) => {
      return Promise.all(ops);
    });
  });

  it('deletes all existing access then creates new access in a transaction', async () => {
    await setBucketAccess('tm-1', ['bucket-1', 'bucket-2']);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.teamMemberBucketAccess.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: 'tm-1' },
    });
    expect(prisma.teamMemberBucketAccess.createMany).toHaveBeenCalledWith({
      data: [
        { teamMemberId: 'tm-1', bucketId: 'bucket-1' },
        { teamMemberId: 'tm-1', bucketId: 'bucket-2' },
      ],
    });
  });

  it('deduplicates bucket IDs before creating', async () => {
    await setBucketAccess('tm-1', ['bucket-1', 'bucket-1', 'bucket-2', 'bucket-1']);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.teamMemberBucketAccess.createMany).toHaveBeenCalledWith({
      data: [
        { teamMemberId: 'tm-1', bucketId: 'bucket-1' },
        { teamMemberId: 'tm-1', bucketId: 'bucket-2' },
      ],
    });
  });
});
