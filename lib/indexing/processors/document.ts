import mammoth from 'mammoth'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'
import { Readable } from 'stream'

const MAX_CHARS = 8000

interface FileRecord {
  name: string
  key: string
  contentType: string | null
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function processDocument(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  try {
    const stream = await getS3ObjectBody(awsConfig, file.key)
    const buffer = await streamToBuffer(stream)
    const ct = (file.contentType || '').toLowerCase()

    if (ct === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const parsed = await pdfParse(buffer)
      return parsed.text.slice(0, MAX_CHARS) || null
    }

    if (ct.includes('officedocument.wordprocessingml')) {
      const { value } = await mammoth.extractRawText({ buffer })
      return value.slice(0, MAX_CHARS) || null
    }

    // text/*
    return buffer.toString('utf-8').slice(0, MAX_CHARS) || null
  } catch {
    return null
  }
}
