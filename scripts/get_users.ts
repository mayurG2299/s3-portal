import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      teamMembers: {
        include: {
          team: true,
          role: true
        }
      }
    }
  })
  console.log(JSON.stringify(users, null, 2))
}

getUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
