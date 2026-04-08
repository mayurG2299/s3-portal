const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Set the correct teamId for the orphaned file
  const fileId = 'cmmcx2pkt0001wt986yr5hgzi' // CLIPPAD_MASTER_DOC.md
  const teamId = 'cmklc2nun000312wzzfnpv5w6' // Mayur's Team

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: { teamId }
  })
  console.log('Updated file:', updated)
}

main().finally(() => prisma.$disconnect())
