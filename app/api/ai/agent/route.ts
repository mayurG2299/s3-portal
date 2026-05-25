import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { allowRequest } from '@/lib/rate-limiter'
import { GET as semanticSearch } from '@/app/api/ai/search/route'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const query: string | undefined = body?.query
  if (!query) return NextResponse.json({ message: 'query is required' }, { status: 400 })

  const allowed = await allowRequest(`ai-agent:${session.user.id}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  // Get top-20 semantic candidates via the search endpoint
  const searchUrl = new URL('/api/ai/search', request.url)
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('limit', '20')
  if (body.teamId) searchUrl.searchParams.set('teamId', body.teamId)
  if (body.bucketId) searchUrl.searchParams.set('bucketId', body.bucketId)

  const searchReq = new NextRequest(searchUrl, { headers: request.headers })
  const searchRes = await semanticSearch(searchReq)
  const { results } = await searchRes.json() as { results: Array<{ id: string; name: string; contentType: string | null; parentPath: string; semanticScore: number }> }

  if (results.length === 0) {
    return NextResponse.json({ files: [], summary: 'No relevant files found.' })
  }

  const limit = Math.min(body.limit ?? 10, 20)
  const candidateList = results
    .slice(0, 20)
    .map((f, i) => `${i + 1}. ${f.name} (${f.contentType || 'unknown'}) — score ${f.semanticScore.toFixed(3)}`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a file search assistant. Given the user query and candidate files below, select the top ${limit} most relevant files and explain why each matches. Return ONLY valid JSON in this format: {"files":[{"id":"...","reason":"..."}],"summary":"..."}\n\nUser query: "${query}"\n\nCandidates:\n${candidateList}`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    return NextResponse.json({ files: results.slice(0, limit), summary: '' })
  }

  let parsed: { files: { id: string; reason: string }[]; summary: string }
  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = block.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ files: results.slice(0, limit), summary: '' })
  }

  // Merge reasons onto the original file objects
  const resultMap = new Map(results.map((r) => [r.id, r]))
  const rankedFiles = parsed.files
    .filter((f) => resultMap.has(f.id))
    .map((f) => ({ ...resultMap.get(f.id)!, reason: f.reason }))

  return NextResponse.json({ files: rankedFiles, summary: parsed.summary })
}
