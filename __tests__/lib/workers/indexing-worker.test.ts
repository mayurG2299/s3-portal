jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name, processor) => {
    return { on: jest.fn(), processor }
  }),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    file: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'file-1',
        name: 'test.pdf',
        key: 'test.pdf',
        contentType: 'application/pdf',
        size: BigInt(1000),
        tags: [],
        description: null,
        credential: { encryptedAccessKey: 'enc', encryptedSecretKey: 'enc2', region: 'us-east-1' },
        bucket: { bucket: 'my-bucket', cloudfrontDomain: null },
      }),
    },
  },
}))
jest.mock('@/lib/aws', () => ({ decryptAWSConfig: jest.fn().mockReturnValue({}) }))
jest.mock('@/lib/indexing/store', () => ({
  setProcessing: jest.fn().mockResolvedValue(undefined),
  setDone: jest.fn().mockResolvedValue(undefined),
  setFailed: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/indexing/embed', () => ({
  embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
}))
jest.mock('@/lib/indexing/processors/document', () => ({
  processDocument: jest.fn().mockResolvedValue('extracted text from doc'),
}))
jest.mock('@/lib/indexing/processors/image', () => ({ processImage: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/audio', () => ({ processAudio: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/video', () => ({ processVideo: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/metadata', () => ({
  processMetadata: jest.fn().mockReturnValue('test.pdf'),
}))

import { Worker } from 'bullmq'

describe('startIndexingWorker', () => {
  it('does not start worker when REDIS_URL is absent', () => {
    delete process.env.REDIS_URL
    const { startIndexingWorker } = require('@/lib/workers/indexing-worker')
    startIndexingWorker()
    expect(Worker).not.toHaveBeenCalled()
  })

  it('processes a PDF file: setProcessing → processDocument → embedText → setDone', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    jest.resetModules()
    // Re-apply mocks after resetModules
    jest.mock('bullmq', () => ({
      Worker: jest.fn().mockImplementation((_name, processor) => ({ on: jest.fn(), _processor: processor })),
    }))
    jest.mock('@/lib/db', () => ({
      prisma: { file: { findUnique: jest.fn().mockResolvedValue({ id: 'file-1', name: 'doc.pdf', key: 'doc.pdf', contentType: 'application/pdf', size: BigInt(500), tags: [], description: null, credential: {}, bucket: {} }) } },
    }))
    jest.mock('@/lib/aws', () => ({ decryptAWSConfig: jest.fn().mockReturnValue({}) }))
    jest.mock('@/lib/indexing/store', () => ({ setProcessing: jest.fn().mockResolvedValue(undefined), setDone: jest.fn().mockResolvedValue(undefined), setFailed: jest.fn() }))
    jest.mock('@/lib/indexing/embed', () => ({ embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)) }))
    jest.mock('@/lib/indexing/processors/document', () => ({ processDocument: jest.fn().mockResolvedValue('doc text') }))
    jest.mock('@/lib/indexing/processors/image', () => ({ processImage: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/audio', () => ({ processAudio: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/video', () => ({ processVideo: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/metadata', () => ({ processMetadata: jest.fn().mockReturnValue('doc.pdf') }))

    const { startIndexingWorker } = require('@/lib/workers/indexing-worker')
    const worker = startIndexingWorker()
    // Call the processor directly
    await worker._processor({ data: { fileId: 'file-1' } })

    const { setProcessing: sp, setDone: sd } = require('@/lib/indexing/store')
    const { embedText: et } = require('@/lib/indexing/embed')
    expect(sp).toHaveBeenCalledWith('file-1')
    expect(et).toHaveBeenCalledWith('doc text')
    expect(sd).toHaveBeenCalledWith('file-1', 'doc text', expect.any(Array))
  })
})
