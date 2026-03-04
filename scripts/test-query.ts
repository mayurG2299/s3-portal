import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testQuery() {
  const userId = "cmmbkfk4z00019gogm4jsjcsl" // Suraj
  const teamId = "cmklc2nun000312wzzfnpv5w6" // Mayur's Team
  
  const credentials = await prisma.aWSCredential.findMany({
    where: {
      teamId: teamId || null,
      ...(teamId
        ? {
            team: {
              members: {
                some: {
                  userId: userId,
                },
              },
            },
          }
        : { userId: userId }),
    },
    include: {
      buckets: true
    }
  })
  
  console.log("Found credentials:", JSON.stringify(credentials, null, 2))
}

testQuery()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
