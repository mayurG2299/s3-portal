import { Worker } from 'bullmq'
import { prisma } from '@/lib/db'
import { decryptAWSConfig } from '@/lib/aws'
import type { IndexingJobPayload } from '@/lib/indexing/queue'
import { setProcessing, setDone, setFailed } from '@/lib/indexing/store'
import { embedText } from '@/lib/indexing/embed'
import { processMetadata } from '@/lib/indexing/processors/metadata'
import { processDocument } from '@/lib/indexing/processors/document'
import { processImage } from '@/lib/indexing/processors/image'
import { processAudio } from '@/lib/indexing/processors/audio'
import { processVideo } from '@/lib/indexing/processors/video'
import { publishFileChanged } from '@/lib/events/files'

const CONCURRENCY = parseInt(process.env.INDEXING_CONCURRENCY || '3', 10)

export function startIndexingWorker() {
  if (!process.env.REDIS_URL) return null

  const worker = new Worker<IndexingJobPayload>(
    'file-indexing',
    async (job) => {
      const { fileId } = job.data

      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: { credential: true, bucket: true },
      })
      if (!file) throw new Error(`File ${fileId} not found`)

      await setProcessing(fileId)

      const awsConfig = decryptAWSConfig(file.credential as any, file.bucket as any)
      const ct = (file.contentType || '').toLowerCase()

      let summary: string | null = null
      try {
        if (ct.startsWith('image/')) {
          summary = await processImage(file as any, awsConfig)
        } else if (ct.startsWith('video/')) {
          summary = await processVideo(file as any, awsConfig)
        } else if (ct.startsWith('audio/')) {
          summary = await processAudio(file as any, awsConfig)
        } else if (
          ct === 'application/pdf' ||
          ct.includes('officedocument') ||
          ct.startsWith('text/')
        ) {
          summary = await processDocument(file as any, awsConfig)
        }
      } catch {
        // processor threw — fall back to metadata below
      }

      if (!summary) summary = processMetadata(file as any)

      const embedding = await embedText(summary)
      await setDone(fileId, summary, embedding)
      try {
        if (file.teamId && file.bucketId) {
          publishFileChanged(file.teamId, {
            bucketId: file.bucketId,
            action: 'indexing-status-changed',
            key: file.key,
            indexingStatus: 'DONE',
          })
        }
      } catch { /* non-fatal */ }
    },
    {
      connection: { url: process.env.REDIS_URL },
      concurrency: CONCURRENCY,
    }
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      await setFailed(job.data.fileId, err.message).catch(() => {})
      try {
        const f = await prisma.file.findUnique({
          where: { id: job.data.fileId },
          select: { teamId: true, bucketId: true, key: true },
        })
        if (f?.teamId && f.bucketId) {
          publishFileChanged(f.teamId, {
            bucketId: f.bucketId,
            action: 'indexing-status-changed',
            key: f.key,
            indexingStatus: 'FAILED',
          })
        }
      } catch { /* non-fatal */ }
    }
  })

  return worker
}
