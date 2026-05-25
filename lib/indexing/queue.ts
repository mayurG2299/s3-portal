import { Queue } from 'bullmq'

export interface IndexingJobPayload {
  fileId: string
}

export let fileIndexingQueue: Queue<IndexingJobPayload> | null = null

if (process.env.REDIS_URL) {
  fileIndexingQueue = new Queue<IndexingJobPayload>('file-indexing', {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  })
}

export async function enqueueFileIndexing(fileId: string, priority = 1): Promise<void> {
  if (!fileIndexingQueue) return
  await fileIndexingQueue.add('file-indexing', { fileId }, { priority })
}
