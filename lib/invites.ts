import { prisma } from './db'

/**
 * Expire team invites that are past their expiresAt and still PENDING
 */
export async function expirePendingInvites() {
  const now = new Date()
  const res = await prisma.teamInvite.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })

  return res
}
