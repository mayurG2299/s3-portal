/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: { storageQuota: { findUnique: jest.fn() } },
}))

import { getQuotaForTeam } from '@/lib/storage-quota'
import { prisma } from '@/lib/db'

describe('getQuotaForTeam default limit', () => {
  it('returns 1 TB as default when no StorageQuota row exists', async () => {
    ;(prisma.storageQuota.findUnique as jest.Mock).mockResolvedValue(null)
    const quota = await getQuotaForTeam('team-1')
    const ONE_TB = BigInt(1099511627776)
    expect(quota.limitBytes).toBe(ONE_TB)
  })
})
