import OpenAI from 'openai'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'
import { Readable } from 'stream'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // Whisper hard limit
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function processAudio(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_AUDIO_BYTES) return null

  try {
    const stream = await getS3ObjectBody(awsConfig, file.key)
    const buffer = await streamToBuffer(stream)
    const audioFile = new File([buffer], file.name, { type: file.contentType || 'audio/mpeg' })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })
    return transcription.text || null
  } catch {
    return null
  }
}
