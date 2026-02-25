import { prisma } from '@/lib/db'

async function main() {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)

  const result = await prisma.accessLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  })

  console.log(`Deleted ${result.count} audit log entries older than 180 days.`)
}

main()
  .catch((error) => {
    console.error('Audit log cleanup failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
