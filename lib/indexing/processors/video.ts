import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import OpenAI from 'openai'
import { PassThrough, Readable } from 'stream'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'

ffmpeg.setFfmpegPath(ffmpegStatic as string)

const MAX_VIDEO_BYTES = (parseInt(process.env.INDEXING_MAX_VIDEO_MB || '500', 10)) * 1024 * 1024
let _openai: OpenAI | null = null
const getOpenAI = () => { if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); return _openai }

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

function extractAudio(videoStream: Readable): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const passThrough = new PassThrough()
    const chunks: Buffer[] = []
    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passThrough.on('end', () => resolve(Buffer.concat(chunks)))
    passThrough.on('error', () => resolve(null))
    ffmpeg(videoStream)
      .noVideo()
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('error', () => resolve(null))
      .pipe(passThrough)
  })
}

export async function processVideo(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_VIDEO_BYTES) return null

  try {
    const videoStream = await getS3ObjectBody(awsConfig, file.key)
    const audioBuffer = await extractAudio(videoStream)
    if (!audioBuffer || audioBuffer.length === 0) return null

    const audioFile = new File([new Uint8Array(audioBuffer)], `${file.name}.mp3`, { type: 'audio/mpeg' })
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })
    return `[${file.name}] ${transcription.text}`
  } catch {
    return null
  }
}
