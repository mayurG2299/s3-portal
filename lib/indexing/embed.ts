import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}
