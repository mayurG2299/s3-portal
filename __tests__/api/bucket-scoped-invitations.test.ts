/** @jest-environment node */

// ─── Prisma mock ────────────────────────────────────────────────────────────
jest.mock('@/lib/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    teamInvite: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aWSCredential: { findMany: jest.fn() },
    awsBucket: { count: jest.fn() },
    role: { findUnique: jest.fn() },
    teamMemberBucketAccess: { createMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() },
  },
}));

// ─── next-auth ───────────────────────────────────────────────────────────────
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

// ─── Audit / events ──────────────────────────────────────────────────────────
jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/events/membership', () => ({
  publishMembershipChanged: jest.fn(),
}));

// ─── Permissions ─────────────────────────────────────────────────────────────
jest.mock('@/lib/permissions', () => ({
  canManageTeam: jest.fn(),
  requireAuth: jest.fn(),
  getUserRoleInTeam: jest.fn(),
  userCanViewScreen: jest.fn(),
  userCanEditScreen: jest.fn(),
  canModifyCredential: jest.fn(),
  canAccessCredential: jest.fn(),
}));

// ─── bucket-access (for credentials GET filter tests) ────────────────────────
jest.mock('@/lib/bucket-access', () => ({
  getAccessibleBucketIds: jest.fn(),
  grantBucketAccess: jest.fn().mockResolvedValue(undefined),
  setBucketAccess: jest.fn().mockResolvedValue(undefined),
}));

// ─── Crypto (used by credentials route) ──────────────────────────────────────
jest.mock('@/lib/crypto', () => ({
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
}));

// ─── AWS validation (used by credentials POST/PUT) ────────────────────────────
jest.mock('@/lib/aws', () => ({
  validateAWSCredentials: jest.fn(),
  validateBucketAccess: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { canManageTeam } from '@/lib/permissions';
import { getAccessibleBucketIds, grantBucketAccess, setBucketAccess } from '@/lib/bucket-access';
import { POST as invitePost } from '@/app/api/team/invites/route';
import { PATCH as invitePatch } from '@/app/api/team/invites/[id]/route';
import { GET as credentialsGet } from '@/app/api/credentials/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mockSession = (userId: string, teamId?: string) => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: userId, teamId: teamId || null },
  });
};

const makeJsonRequest = (body: unknown, url = 'http://localhost/api/team/invites') => ({
  url,
  json: async () => body,
  cookies: { get: jest.fn().mockReturnValue(undefined) },
} as any);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/team/invites with bucketIds
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/team/invites — bucket-scoped invitations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('stores inviteBucketIds on the created invite when valid bucketIds are provided', async () => {
    mockSession('user-admin', 'team-1');
    (canManageTeam as jest.Mock).mockResolvedValue(true);
    // role hierarchy: inviter is ADMIN (level 50), target role is VIEWER (level 10)
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValueOnce({ role: { level: 50 } });
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({ level: 10 });
    // bucket validation: 2 buckets found for this team
    (prisma.awsBucket.count as jest.Mock).mockResolvedValue(2);
    // no existing user or pending invite
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.create as jest.Mock).mockResolvedValue({ id: 'invite-1' });

    const req = makeJsonRequest({
      teamId: 'team-1',
      email: 'newuser@example.com',
      roleId: 'role-viewer',
      bucketIds: ['bucket-1', 'bucket-2'],
    });

    const res = await invitePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.inviteId).toBe('invite-1');
    expect(prisma.teamInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteBucketIds: ['bucket-1', 'bucket-2'],
        }),
      })
    );
  });

  it('returns 400 when bucketIds contain IDs not belonging to the team', async () => {
    mockSession('user-admin', 'team-1');
    (canManageTeam as jest.Mock).mockResolvedValue(true);
    // role hierarchy: inviter is ADMIN, target is VIEWER
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValueOnce({ role: { level: 50 } });
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({ level: 10 });
    // Only 1 of 2 buckets is valid for this team
    (prisma.awsBucket.count as jest.Mock).mockResolvedValue(1);

    const req = makeJsonRequest({
      teamId: 'team-1',
      email: 'newuser@example.com',
      roleId: 'role-viewer',
      bucketIds: ['bucket-valid', 'bucket-foreign'],
    });

    const res = await invitePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid/i);
    expect(prisma.teamInvite.create).not.toHaveBeenCalled();
    expect(prisma.awsBucket.count).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(['bucket-valid', 'bucket-foreign']) }, credential: { teamId: 'team-1' } },
    });
  });

  it('stores empty inviteBucketIds when no bucketIds are provided', async () => {
    mockSession('user-admin', 'team-1');
    (canManageTeam as jest.Mock).mockResolvedValue(true);
    // role hierarchy: inviter is ADMIN, target is VIEWER
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValueOnce({ role: { level: 50 } });
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({ level: 10 });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.create as jest.Mock).mockResolvedValue({ id: 'invite-2' });

    const req = makeJsonRequest({
      teamId: 'team-1',
      email: 'another@example.com',
      roleId: 'role-viewer',
      // no bucketIds field
    });

    const res = await invitePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.inviteId).toBe('invite-2');
    expect(prisma.teamInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteBucketIds: [],
        }),
      })
    );
  });

  it('deduplicates bucketIds before storing', async () => {
    mockSession('user-admin', 'team-1');
    (canManageTeam as jest.Mock).mockResolvedValue(true);
    // role hierarchy: inviter is ADMIN, target is VIEWER
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValueOnce({ role: { level: 50 } });
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({ level: 10 });
    // After dedup: 1 unique bucket, count = 1 means valid
    (prisma.awsBucket.count as jest.Mock).mockResolvedValue(1);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvite.create as jest.Mock).mockResolvedValue({ id: 'invite-3' });

    const req = makeJsonRequest({
      teamId: 'team-1',
      email: 'dup@example.com',
      roleId: 'role-viewer',
      bucketIds: ['bucket-1', 'bucket-1', 'bucket-1'],
    });

    const res = await invitePost(req);
    expect(res.status).toBe(200);
    expect(prisma.teamInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteBucketIds: ['bucket-1'],
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/team/invites/[id] — accept
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/team/invites/[id] — accept with bucket access', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const makeInvitePatchReq = (action: 'accept' | 'decline') => ({
    url: 'http://localhost/api/team/invites/invite-1',
    json: async () => ({ action }),
    cookies: { get: jest.fn().mockReturnValue(undefined) },
  } as any);

  const makeContext = (id: string) => ({
    params: Promise.resolve({ id }),
  } as any);

  it('grants bucket access via createMany for new member with non-empty inviteBucketIds', async () => {
    mockSession('user-1', 'team-1');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'user@example.com' });
    (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue({
      id: 'invite-1',
      email: 'user@example.com',
      teamId: 'team-1',
      roleId: 'role-viewer',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400_000),
      inviteBucketIds: ['bucket-1', 'bucket-2'],
      team: { id: 'team-1', name: 'Test Team' },
      role: { id: 'role-viewer', name: 'VIEWER' },
    });

    // Not already a member
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    // $transaction executes the callback with prisma as the tx object
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) => fn(prisma));
    (prisma.teamMember.create as jest.Mock).mockResolvedValue({ id: 'tm-new' });
    (prisma.teamMemberBucketAccess.createMany as jest.Mock).mockResolvedValue({});
    (prisma.teamInvite.update as jest.Mock).mockResolvedValue({});

    const res = await invitePatch(makeInvitePatchReq('accept'), makeContext('invite-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.teamMemberBucketAccess.createMany).toHaveBeenCalledWith({
      data: [
        { teamMemberId: 'tm-new', bucketId: 'bucket-1' },
        { teamMemberId: 'tm-new', bucketId: 'bucket-2' },
      ],
      skipDuplicates: true,
    });
    expect(prisma.teamMemberBucketAccess.deleteMany).not.toHaveBeenCalled();
  });

  it('replaces bucket access via deleteMany+createMany for re-invited existing member', async () => {
    mockSession('user-1', 'team-1');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'user@example.com' });
    (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue({
      id: 'invite-2',
      email: 'user@example.com',
      teamId: 'team-1',
      roleId: 'role-viewer',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400_000),
      inviteBucketIds: ['bucket-3'],
      team: { id: 'team-1', name: 'Test Team' },
      role: { id: 'role-viewer', name: 'VIEWER' },
    });

    // User is already a member
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ id: 'tm-existing' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) => fn(prisma));
    (prisma.teamMemberBucketAccess.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.teamMemberBucketAccess.createMany as jest.Mock).mockResolvedValue({});
    (prisma.teamInvite.update as jest.Mock).mockResolvedValue({});

    const res = await invitePatch(makeInvitePatchReq('accept'), makeContext('invite-2'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.teamMemberBucketAccess.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: 'tm-existing' },
    });
    expect(prisma.teamMemberBucketAccess.createMany).toHaveBeenCalledWith({
      data: [{ teamMemberId: 'tm-existing', bucketId: 'bucket-3' }],
    });
  });

  it('does NOT call createMany or deleteMany when inviteBucketIds is empty (new member)', async () => {
    mockSession('user-1', 'team-1');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'user@example.com' });
    (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue({
      id: 'invite-3',
      email: 'user@example.com',
      teamId: 'team-1',
      roleId: 'role-viewer',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400_000),
      inviteBucketIds: [],
      team: { id: 'team-1', name: 'Test Team' },
      role: { id: 'role-viewer', name: 'VIEWER' },
    });

    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) => fn(prisma));
    (prisma.teamMember.create as jest.Mock).mockResolvedValue({ id: 'tm-new2' });
    (prisma.teamInvite.update as jest.Mock).mockResolvedValue({});

    const res = await invitePatch(makeInvitePatchReq('accept'), makeContext('invite-3'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.teamMemberBucketAccess.createMany).not.toHaveBeenCalled();
    expect(prisma.teamMemberBucketAccess.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 403 when invite email does not match user email', async () => {
    mockSession('user-wrong', 'team-1');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: 'wrong@example.com',
    });

    (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue({
      id: 'invite-4',
      email: 'right@example.com',
      teamId: 'team-1',
      roleId: 'role-viewer',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400_000),
      inviteBucketIds: [],
      team: { id: 'team-1', name: 'Test Team' },
      role: { id: 'role-viewer', name: 'VIEWER' },
    });

    const res = await invitePatch(makeInvitePatchReq('accept'), makeContext('invite-4'));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/credentials — bucket filtering
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/credentials — bucket-scoped filtering', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const makeCredentialsReq = (teamId: string) => ({
    url: `http://localhost/api/credentials?teamId=${teamId}`,
    cookies: { get: jest.fn().mockReturnValue(undefined) },
  } as any);

  it('returns all buckets unfiltered for ADMIN member (getAccessibleBucketIds returns null)', async () => {
    mockSession('user-admin', 'team-1');

    // resolveCredentialScopeTeamId uses teamMember.findFirst
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'tm-admin',
      teamId: 'team-1',
    });

    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cred-1',
        name: 'Prod Creds',
        region: 'us-east-1',
        teamId: 'team-1',
        createdAt: new Date(),
        buckets: [
          { id: 'b1', bucket: 'my-bucket-1', cloudfrontDomain: null, cloudfrontKeyPairId: null },
          { id: 'b2', bucket: 'my-bucket-2', cloudfrontDomain: null, cloudfrontKeyPairId: null },
        ],
        team: { name: 'Test Team' },
        user: { email: 'admin@example.com' },
      },
    ]);

    // Admin — unrestricted
    (getAccessibleBucketIds as jest.Mock).mockResolvedValue(null);

    const res = await credentialsGet(makeCredentialsReq('team-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.credentials).toHaveLength(1);
    expect(json.credentials[0].buckets).toHaveLength(2);
  });

  it('returns only allowed buckets for VIEWER member', async () => {
    mockSession('user-viewer', 'team-1');

    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'tm-viewer',
      teamId: 'team-1',
    });

    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cred-1',
        name: 'Prod Creds',
        region: 'us-east-1',
        teamId: 'team-1',
        createdAt: new Date(),
        buckets: [
          { id: 'b1', bucket: 'allowed-bucket', cloudfrontDomain: null, cloudfrontKeyPairId: null },
          { id: 'b2', bucket: 'restricted-bucket', cloudfrontDomain: null, cloudfrontKeyPairId: null },
        ],
        team: { name: 'Test Team' },
        user: { email: 'viewer@example.com' },
      },
    ]);

    // Viewer only has access to b1
    (getAccessibleBucketIds as jest.Mock).mockResolvedValue(['b1']);

    const res = await credentialsGet(makeCredentialsReq('team-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.credentials).toHaveLength(1);
    expect(json.credentials[0].buckets).toHaveLength(1);
    expect(json.credentials[0].buckets[0].id).toBe('b1');
  });

  it('returns empty credentials array when VIEWER has no allowed buckets', async () => {
    mockSession('user-viewer', 'team-1');

    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'tm-viewer',
      teamId: 'team-1',
    });

    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cred-1',
        name: 'Prod Creds',
        region: 'us-east-1',
        teamId: 'team-1',
        createdAt: new Date(),
        buckets: [
          { id: 'b1', bucket: 'restricted-bucket', cloudfrontDomain: null, cloudfrontKeyPairId: null },
        ],
        team: { name: 'Test Team' },
        user: { email: 'viewer@example.com' },
      },
    ]);

    // Viewer has no buckets at all
    (getAccessibleBucketIds as jest.Mock).mockResolvedValue([]);

    const res = await credentialsGet(makeCredentialsReq('team-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.credentials).toHaveLength(0);
  });

  it('drops credentials where no buckets remain after filtering', async () => {
    mockSession('user-viewer', 'team-1');

    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: 'tm-viewer',
      teamId: 'team-1',
    });

    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cred-1',
        name: 'Allowed Cred',
        region: 'us-east-1',
        teamId: 'team-1',
        createdAt: new Date(),
        buckets: [
          { id: 'b1', bucket: 'visible-bucket', cloudfrontDomain: null, cloudfrontKeyPairId: null },
        ],
        team: { name: 'Test Team' },
        user: { email: 'viewer@example.com' },
      },
      {
        id: 'cred-2',
        name: 'Hidden Cred',
        region: 'us-east-1',
        teamId: 'team-1',
        createdAt: new Date(),
        buckets: [
          { id: 'b2', bucket: 'hidden-bucket', cloudfrontDomain: null, cloudfrontKeyPairId: null },
        ],
        team: { name: 'Test Team' },
        user: { email: 'viewer@example.com' },
      },
    ]);

    // Viewer can only see b1
    (getAccessibleBucketIds as jest.Mock).mockResolvedValue(['b1']);

    const res = await credentialsGet(makeCredentialsReq('team-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.credentials).toHaveLength(1);
    expect(json.credentials[0].id).toBe('cred-1');
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await credentialsGet(makeCredentialsReq('team-1'));
    expect(res.status).toBe(401);
  });
});
