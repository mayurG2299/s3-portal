import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function reset() {
  const hash = await bcrypt.hash('password123', 10)
  await prisma.user.updateMany({
    where: { email: { in: ['mayur@fitpage.in', 'suraj@fitpage.in'] } },
    data: { password: hash }
  })
  console.log("Passwords reset to 'password123' for mayur and suraj")
}

reset().finally(() => prisma.$disconnect())
