import { prisma } from './db'
import { decryptAWSConfig, listS3Objects } from './aws'
import { incrementUsage, decrementUsage } from './storage-quota'

/**
 * Reconcile a single AwsBucket: add missing DB records and remove DB rows
 * for S3 objects that no longer exist.
 */
export async function reconcileBucket(bucketId: string) {
  const bucket = await prisma.awsBucket.findUnique({
    where: { id: bucketId },
    include: { credential: true },
  })

  if (!bucket) return { added: 0, removed: 0 }

  const config = decryptAWSConfig(bucket.credential as any, bucket as any)
  const objects = await listS3Objects(config, '')
  const s3Keys = new Set(objects.map((o) => o.key))

  // DB files for this bucket
  const dbFiles = await prisma.file.findMany({ where: { bucketId } })
  const dbKeys = new Set(dbFiles.map((f) => f.key))

  // Add missing
  const toAdd = objects.filter((o) => !dbKeys.has(o.key)).map((o) => ({
    key: o.key,
    name: o.key.split('/').filter(Boolean).pop() || o.key,
    size: BigInt(o.size),
    contentType: o.key.endsWith('/') ? 'application/x-directory' : undefined,
    parentPath: (() => {
      const parts = o.key.split('/').filter(Boolean)
      parts.pop()
      return parts.length > 0 ? '/' + parts.join('/') + '/' : '/'
    })(),
    userId: bucket.credential.userId,
    teamId: bucket.credential.teamId,
    credentialId: bucket.credentialId,
    bucketId: bucket.id,
  }))

  let added = 0
  if (toAdd.length > 0) {
    await prisma.file.createMany({ data: toAdd, skipDuplicates: true })
    added = toAdd.length

    // Increment quota usage for added files (sum sizes)
    try {
      const total = toAdd.reduce((acc, f) => acc + (BigInt(f.size || 0) as bigint), BigInt(0))
      if (total > BigInt(0) && bucket.credential.teamId) {
        await incrementUsage(bucket.credential.teamId, total)
      }
    } catch (err) {
      console.error('Failed to increment usage during reconciliation:', err)
    }
  }

  // Remove stale DB rows
  const toRemove = dbFiles.filter((f) => !s3Keys.has(f.key))
  let removed = 0
  if (toRemove.length > 0) {
    const ids = toRemove.map((r) => r.id)
    // Sum sizes to decrement
    try {
      const total = toRemove.reduce((acc, f) => acc + (BigInt(f.size || 0) as bigint), BigInt(0))
      if (total > BigInt(0) && bucket.credential.teamId) {
        await decrementUsage(bucket.credential.teamId, total)
      }
    } catch (err) {
      console.error('Failed to decrement usage during reconciliation:', err)
    }

    await prisma.file.deleteMany({ where: { id: { in: ids } } })
    removed = ids.length
  }

  return { added, removed }
}

/**
 * Reconcile all buckets for a team
 */
export async function reconcileTeam(teamId: string) {
  const buckets = await prisma.awsBucket.findMany({ where: { credential: { teamId } }, include: { credential: true } as any })
  let totalAdded = 0
  let totalRemoved = 0

  for (const b of buckets) {
    const res = await reconcileBucket(b.id)
    totalAdded += res.added
    totalRemoved += res.removed
  }

  return { added: totalAdded, removed: totalRemoved }
}
