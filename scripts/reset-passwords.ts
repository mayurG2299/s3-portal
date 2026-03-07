import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/crypto'

const prisma = new PrismaClient()

async function reset() {
  const hash = await hashPassword('Password@123')
  await prisma.user.updateMany({
    where: { email: { in: ['mayur@fitpage.in', 'suraj@fitpage.in'] } },
    data: { passwordHash: hash }
  })
  console.log("Passwords reset to 'Password@123' for mayur and suraj using SCrypt")
}

reset().finally(() => prisma.$disconnect())
