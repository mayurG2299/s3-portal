import { prisma } from './db'

const DEFAULT_LIMIT_BYTES = BigInt(100) * BigInt(1024) * BigInt(1024) * BigInt(1024) // 100 GB

export async function getQuotaForTeam(teamId: string) {
  const quota = await prisma.storageQuota.findUnique({ where: { teamId } })
  if (quota) return quota

  // Return a virtual default (do not persist until needed)
  return {
    teamId,
    usedBytes: BigInt(0),
    limitBytes: DEFAULT_LIMIT_BYTES,
  }
}

export async function checkQuotaBeforeUpload(teamId: string | null, newBytes: bigint) {
  if (!teamId) return { allowed: true }
  const quota = await getQuotaForTeam(teamId)
  const used = BigInt(quota.usedBytes || 0)
  const limit = quota.limitBytes === null || quota.limitBytes === undefined ? null : BigInt(quota.limitBytes)

  if (limit === null) return { allowed: true }
  if (used + newBytes > limit) {
    return { allowed: false, used, limit }
  }

  return { allowed: true, used, limit }
}

export async function incrementUsage(teamId: string | null, delta: bigint) {
  if (!teamId) return
  // Create quota row if missing
  await prisma.storageQuota.upsert({
    where: { teamId },
    create: { teamId, usedBytes: delta },
    update: { usedBytes: { increment: delta } as any },
  })
}

export async function decrementUsage(teamId: string | null, delta: bigint) {
  if (!teamId) return
  await prisma.$executeRaw`
    UPDATE "StorageQuota"
    SET "usedBytes" = GREATEST("usedBytes" - ${delta}, 0)
    WHERE "teamId" = ${teamId}
  `
}

export async function setQuotaLimit(teamId: string, limitBytes: bigint | null) {
  await prisma.storageQuota.upsert({
    where: { teamId },
    create: { teamId, limitBytes: limitBytes ?? undefined },
    update: { limitBytes: limitBytes ?? undefined },
  })
}

export { DEFAULT_LIMIT_BYTES }
