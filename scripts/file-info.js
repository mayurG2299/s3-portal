const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const file = await prisma.file.findFirst({
    where: { name: 'CLIPPAD_MASTER_DOC.md' },
    select: { id: true, name: true, teamId: true, userId: true }
  })
  console.log(file)
}

main().finally(() => prisma.$disconnect())
