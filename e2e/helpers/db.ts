// e2e/helpers/db.ts
import { PrismaClient } from '@prisma/client'
import { TEST_TEAM_NAME } from './seed-constants'

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

export async function deleteTestData() {
  await prisma.accessLog.deleteMany({
    where: { user: { email: { contains: '@test.local' } } },
  })
  await prisma.link.deleteMany({
    where: { user: { email: { contains: '@test.local' } } },
  })
  await prisma.teamInvite.deleteMany({
    where: { team: { name: TEST_TEAM_NAME } },
  })
  await prisma.teamMember.deleteMany({
    where: { team: { name: TEST_TEAM_NAME } },
  })
  await prisma.storageQuota.deleteMany({
    where: { team: { name: TEST_TEAM_NAME } },
  })
  await prisma.team.deleteMany({ where: { name: TEST_TEAM_NAME } })
  await prisma.user.deleteMany({ where: { email: { contains: '@test.local' } } })
}
