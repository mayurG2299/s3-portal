import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fix() {
  const usersWithTeams = await prisma.user.findMany({
    include: {
      teamMembers: {
        where: { role: { name: 'OWNER' } },
        take: 1
      },
      credentials: {
        where: { teamId: null }
      }
    }
  })

  for (const user of usersWithTeams) {
    if (user.teamMembers.length > 0 && user.credentials.length > 0) {
      const teamId = user.teamMembers[0].teamId
      
      for (const cred of user.credentials) {
        await prisma.aWSCredential.update({
          where: { id: cred.id },
          data: { teamId }
        })
        console.log(`Updated credential ${cred.name} to team ${teamId}`)
        
        await prisma.file.updateMany({
          where: { credentialId: cred.id },
          data: { teamId }
        })
        console.log(`Updated files for credential ${cred.name} to team ${teamId}`)
      }
    }
  }
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
