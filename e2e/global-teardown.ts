// e2e/global-teardown.ts
import { deleteTestData } from './helpers/db'
import { prisma } from './helpers/db'

async function globalTeardown() {
  await deleteTestData()
  await prisma.$disconnect()
  console.log('✅ Test data cleaned up')
}

export default globalTeardown
