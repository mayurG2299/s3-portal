jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn().mockReturnValue({
    noVideo: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockImplementation((dest) => {
      process.nextTick(() => {
        dest.write(Buffer.from('audio-bytes'))
        dest.end()
      })
      return dest
    }),
  })
  mockFfmpeg.setFfmpegPath = jest.fn()
  return { default: mockFfmpeg, __esModule: true }
})
jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg')
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'video transcript' }),
      },
    },
  })),
}))

import { getS3ObjectBody } from '@/lib/aws'
import { processVideo } from '@/lib/indexing/processors/video'
import { Readable } from 'stream'

describe('processVideo', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns transcript prefixed with filename', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('video-bytes')]))
    const file = { name: 'demo.mp4', key: 'vids/demo.mp4', contentType: 'video/mp4', size: BigInt(1024) }
    const result = await processVideo(file as any, {} as any)
    expect(result).toContain('demo.mp4')
    expect(result).toContain('video transcript')
  })

  it('returns null for files over 500 MB', async () => {
    const file = { name: 'huge.mp4', key: 'vids/huge.mp4', contentType: 'video/mp4', size: BigInt(501 * 1024 * 1024) }
    const result = await processVideo(file as any, {} as any)
    expect(result).toBeNull()
  })
})
