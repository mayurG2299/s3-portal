jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'Hello from the audio file' }),
      },
    },
  })),
}))
jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))

import { getS3ObjectBody } from '@/lib/aws'
import { processAudio } from '@/lib/indexing/processors/audio'
import { Readable } from 'stream'

describe('processAudio', () => {
  let mockTranscriptionsCreate: jest.Mock
  beforeAll(() => {
    const OpenAI = require('openai').default
    mockTranscriptionsCreate = OpenAI.mock.results[0].value.audio.transcriptions.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns Whisper transcript', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('audio-bytes')]))
    const file = { name: 'podcast.mp3', key: 'audio/podcast.mp3', contentType: 'audio/mpeg', size: BigInt(1000) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBe('Hello from the audio file')
  })

  it('returns null for files over 25 MB', async () => {
    const file = { name: 'big.mp3', key: 'audio/big.mp3', contentType: 'audio/mpeg', size: BigInt(26 * 1024 * 1024) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBeNull()
  })

  it('returns null when Whisper throws', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('bytes')]))
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error('API error'))
    const file = { name: 'audio.mp3', key: 'audio/audio.mp3', contentType: 'audio/mpeg', size: BigInt(100) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBeNull()
  })
})
