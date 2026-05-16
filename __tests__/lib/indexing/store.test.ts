/** @jest-environment node */
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}))

import { prisma } from '@/lib/db'
import { setProcessing, setDone, setFailed } from '@/lib/indexing/store'

describe('store', () => {
  beforeEach(() => jest.clearAllMocks())

  it('setProcessing upserts with PROCESSING status', async () => {
    await setProcessing('file-1')
    expect(prisma.fileEmbedding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fileId: 'file-1' },
        create: expect.objectContaining({ fileId: 'file-1', status: 'PROCESSING' }),
        update: expect.objectContaining({ status: 'PROCESSING' }),
      })
    )
  })

  it('setDone calls $executeRaw to write the vector', async () => {
    const embedding = Array(1536).fill(0.5)
    await setDone('file-1', 'a summary', embedding)
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })

  it('setFailed updates status to FAILED with errorMessage', async () => {
    await setFailed('file-1', 'API timeout')
    expect(prisma.fileEmbedding.update).toHaveBeenCalledWith({
      where: { fileId: 'file-1' },
      data: { status: 'FAILED', errorMessage: 'API timeout' },
    })
  })
})
