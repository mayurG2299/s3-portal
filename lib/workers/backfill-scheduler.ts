import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'

const BATCH_SIZE = parseInt(process.env.INDEXING_BATCH_SIZE || '50', 10)

export function startBackfillScheduler() {
  if (!process.env.REDIS_URL) return null

  const schedulerQueue = new Queue('backfill-scheduler', {
    connection: { url: process.env.REDIS_URL },
  })

  schedulerQueue.add('tick', {}, {
    repeat: { every: 60_000 },
    jobId: 'backfill-tick',
  })

  const worker = new Worker(
    'backfill-scheduler',
    async () => {
      // Reset stale PROCESSING rows (worker crashed >10 min ago)
      await prisma.fileEmbedding.updateMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        data: { status: 'PENDING' },
      })

      // Enqueue files with no embedding at all
      const unindexed = await prisma.file.findMany({
        where: { embedding: null },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      })

      // Enqueue files whose metadata changed after last indexing
      const staleMetadata = await prisma.$queryRaw<{ id: string }[]>`
        SELECT f.id FROM "File" f
        JOIN "FileEmbedding" fe ON fe."fileId" = f.id
        WHERE fe.status = 'DONE'
          AND fe."processedAt" IS NOT NULL
          AND f."updatedAt" > fe."processedAt"
        LIMIT 20
      `

      for (const file of [...unindexed, ...staleMetadata]) {
        await enqueueFileIndexing(file.id, 10)
      }
    },
    { connection: { url: process.env.REDIS_URL } }
  )

  return { schedulerQueue, worker }
}
