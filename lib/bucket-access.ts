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

  // Non-member: deny all access (return empty array, not null).
  // null is reserved for "unrestricted admin/owner". [] means "restricted with no buckets".
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
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: { select: { level: true } }, id: true },
  })

  if (!member) return false
  // Admins/owners are unrestricted
  if (member.role.level >= 50) return true

  // Point-lookup on the unique index [teamMemberId, bucketId]
  const access = await prisma.teamMemberBucketAccess.findUnique({
    where: { teamMemberId_bucketId: { teamMemberId: member.id, bucketId } },
    select: { id: true },
  })
  return access !== null
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
  const uniqueIds = [...new Set(bucketIds)]
  await prisma.$transaction([
    prisma.teamMemberBucketAccess.deleteMany({ where: { teamMemberId } }),
    ...(uniqueIds.length > 0
      ? [// No skipDuplicates needed — deleteMany above ensures a clean slate
         prisma.teamMemberBucketAccess.createMany({
          data: uniqueIds.map((bucketId) => ({ teamMemberId, bucketId })),
        })]
      : []),
  ])
}
