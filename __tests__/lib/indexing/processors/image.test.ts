jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'A screenshot of a dashboard with charts.' }],
      }),
    },
  })),
}))
jest.mock('@/lib/aws', () => ({
  generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}))

import { processImage } from '@/lib/indexing/processors/image'

describe('processImage', () => {
  let mockMessagesCreate: jest.Mock
  beforeAll(() => {
    const Anthropic = require('@anthropic-ai/sdk').default
    mockMessagesCreate = Anthropic.mock.results[0].value.messages.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns Claude description for an image file', async () => {
    const file = { name: 'dashboard.png', key: 'imgs/dashboard.png', contentType: 'image/png', size: BigInt(1024 * 1024) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBe('A screenshot of a dashboard with charts.')
  })

  it('returns null for files over 20 MB', async () => {
    const file = { name: 'huge.png', key: 'imgs/huge.png', contentType: 'image/png', size: BigInt(21 * 1024 * 1024) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBeNull()
  })

  it('returns null if Claude call throws', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('rate limit'))
    const file = { name: 'img.jpg', key: 'imgs/img.jpg', contentType: 'image/jpeg', size: BigInt(1000) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBeNull()
  })
})
