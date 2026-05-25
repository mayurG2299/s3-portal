jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })),
  Worker: jest.fn().mockImplementation((_name, processor) => ({ on: jest.fn(), _processor: processor })),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    file: {
      findMany: jest.fn().mockResolvedValue([{ id: 'file-a' }, { id: 'file-b' }]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('@/lib/indexing/queue', () => ({
  enqueueFileIndexing: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'

describe('startBackfillScheduler', () => {
  it('does not start when REDIS_URL is absent', () => {
    delete process.env.REDIS_URL
    const { startBackfillScheduler } = require('@/lib/workers/backfill-scheduler')
    const result = startBackfillScheduler()
    expect(result).toBeNull()
  })

  it('resets stale PROCESSING rows and enqueues unindexed files', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    jest.resetModules()
    jest.mock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
      Worker: jest.fn().mockImplementation((_name, processor) => ({ _processor: processor })),
    }))
    jest.mock('@/lib/db', () => ({
      prisma: {
        fileEmbedding: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        file: { findMany: jest.fn().mockResolvedValue([{ id: 'fa' }, { id: 'fb' }]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
      },
    }))
    jest.mock('@/lib/indexing/queue', () => ({ enqueueFileIndexing: jest.fn().mockResolvedValue(undefined) }))

    const { startBackfillScheduler } = require('@/lib/workers/backfill-scheduler')
    const { worker } = startBackfillScheduler()
    await worker._processor({})

    const { prisma: p } = require('@/lib/db')
    const { enqueueFileIndexing: enq } = require('@/lib/indexing/queue')
    expect(p.fileEmbedding.updateMany).toHaveBeenCalled()
    expect(enq).toHaveBeenCalledWith('fa', 10)
    expect(enq).toHaveBeenCalledWith('fb', 10)
  })
})
