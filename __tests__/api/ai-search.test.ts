/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({ prisma: { $queryRaw: jest.fn() } }))
jest.mock('@/lib/indexing/embed', () => ({ embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)) }))
jest.mock('@/lib/bucket-access', () => ({ getAccessibleBucketIds: jest.fn().mockResolvedValue(['bucket-1']) }))
jest.mock('@/lib/rate-limiter', () => ({ allowRequest: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1', identityId: null }),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { GET } from '@/app/api/ai/search/route'
import { NextRequest } from 'next/server'

function makeRequest(q: string, teamId?: string) {
  const url = `http://localhost/api/ai/search?q=${encodeURIComponent(q)}${teamId ? `&teamId=${teamId}` : ''}`
  return new NextRequest(url)
}

describe('GET /api/ai/search', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('demo videos'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when q is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(new NextRequest('http://localhost/api/ai/search'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const { allowRequest } = require('@/lib/rate-limiter')
    allowRequest.mockResolvedValueOnce(false)
    const res = await GET(makeRequest('query', 'team-1'))
    expect(res.status).toBe(429)
  })

  it('returns 200 with results array from pgvector query', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { id: 'f1', name: 'demo.mp4', key: 'vids/demo.mp4', contentType: 'video/mp4', parentPath: '/', score: 0.95 },
    ])
    const res = await GET(makeRequest('product demo', 'team-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].semanticScore).toBeCloseTo(0.95)
  })
})
