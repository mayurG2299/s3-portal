import Anthropic from '@anthropic-ai/sdk'
import { generatePresignedDownloadUrl } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'

const MAX_IMAGE_BYTES = (parseInt(process.env.INDEXING_MAX_IMAGE_MB || '20', 10)) * 1024 * 1024
let _anthropic: Anthropic | null = null
const getAnthropic = () => { if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); return _anthropic }

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

export async function processImage(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_IMAGE_BYTES) return null

  try {
    const url = await generatePresignedDownloadUrl(awsConfig, file.key, 900) // 15 min
    const message = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url } },
            {
              type: 'text',
              text: 'Describe the content of this image in 2-3 sentences for a file search index. Be specific about objects, people, text, colors, and context.',
            },
          ],
        },
      ],
    })
    const block = message.content[0]
    return block.type === 'text' ? block.text : null
  } catch {
    return null
  }
}
