jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }],
      }),
    },
  })),
}))

import { embedText } from '@/lib/indexing/embed'

describe('embedText', () => {
  // Capture the mock before clearAllMocks() wipes mock.results (constructor ran at module load)
  let mockCreate: jest.Mock
  beforeAll(() => {
    const OpenAI = require('openai').default
    mockCreate = OpenAI.mock.results[0].value.embeddings.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns a 1536-element number array', async () => {
    const result = await embedText('find the Q4 product demo')
    expect(result).toHaveLength(1536)
    expect(typeof result[0]).toBe('number')
  })

  it('trims input to 8000 characters before sending', async () => {
    const longInput = 'x'.repeat(10000)
    await embedText(longInput)
    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.input.length).toBeLessThanOrEqual(8000)
  })
})
