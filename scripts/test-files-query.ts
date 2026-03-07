import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testQuery() {
  const userId = "cmmbkfk4z00019gogm4jsjcsl" // Suraj
  const teamId = "cmklc2nun000312wzzfnpv5w6" // Mayur's Team
  const bucketId = "ef292514-a7d6-4855-88e6-8c5f1d5a1514" // race-registration-production-media
  const roleId: string = "cmm77b02o000a3reqy7ac7krk"
  const requireAdmin = false

  const result = await prisma.awsBucket.findFirst({
    where: {
      id: bucketId,
      credential: {
        teamId: teamId || null,
        ...(teamId
          ? {
              team: {
                members: {
                  some: {
                    userId,
                    ...(requireAdmin && roleId !== 'role_owner' && roleId !== 'role_admin'
                      ? { role: { name: { in: ['OWNER', 'ADMIN'] } } }
                      : {}),
                  },
                },
              },
            }
          : { userId }),
      },
    },
    include: { credential: true },
  })
  
  console.log("Bucket returned:", result ? "YES" : "NO")
}

testQuery()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
