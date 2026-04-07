// lib/bucket-access.ts
import { prisma } from '@/lib/db'

/**
 * Returns the list of bucket IDs a user is allowed to access in a team.
 * Returns null if the user is unrestricted (ADMIN/OWNER — role level >= 50).
 * Returns string[] (possibly empty) for restricted members.
 */
export async function getAccessibleBucketIds(
  userId: string,
  teamId: string
): Promise<string[] | null> {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: {
      role: { select: { level: true } },
      bucketAccess: { select: { bucketId: true } },
    },
  })

  if (!member) return []

  // ADMIN (level >= 50) and OWNER (level >= 100) are unrestricted
  if (member.role.level >= 50) return null

  return member.bucketAccess.map((ba) => ba.bucketId)
}

/**
 * Returns true if user can access the specific bucket.
 * Admins/owners always return true (if they're team members).
 */
export async function canAccessBucket(
  userId: string,
  teamId: string,
  bucketId: string
): Promise<boolean> {
  const allowed = await getAccessibleBucketIds(userId, teamId)
  if (allowed === null) return true   // unrestricted admin/owner
  return allowed.includes(bucketId)
}

/**
 * Grants bucket access rows for a team member. Skips duplicates.
 */
export async function grantBucketAccess(
  teamMemberId: string,
  bucketIds: string[]
): Promise<void> {
  if (bucketIds.length === 0) return
  await prisma.teamMemberBucketAccess.createMany({
    data: bucketIds.map((bucketId) => ({ teamMemberId, bucketId })),
    skipDuplicates: true,
  })
}

/**
 * Replaces all bucket access rows for a team member.
 */
export async function setBucketAccess(
  teamMemberId: string,
  bucketIds: string[]
): Promise<void> {
  await prisma.$transaction([
    prisma.teamMemberBucketAccess.deleteMany({ where: { teamMemberId } }),
    ...(bucketIds.length > 0
      ? [prisma.teamMemberBucketAccess.createMany({
          data: bucketIds.map((bucketId) => ({ teamMemberId, bucketId })),
          skipDuplicates: true,
        })]
      : []),
  ])
}
