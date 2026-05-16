/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limiter', () => ({ allowRequest: jest.fn().mockResolvedValue(true) }))
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            files: [{ id: 'f1', reason: 'Matches product demo query' }],
            summary: 'Found 1 relevant video',
          }),
        }],
      }),
    },
  })),
}))
// Mock the search route's GET handler inline
jest.mock('@/app/api/ai/search/route', () => ({
  GET: jest.fn().mockResolvedValue({
    json: async () => ({ results: [{ id: 'f1', name: 'demo.mp4', contentType: 'video/mp4', parentPath: '/', semanticScore: 0.9 }] }),
    status: 200,
  }),
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/ai/agent/route'
import { NextRequest } from 'next/server'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/ai/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ai/agent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ query: 'demo' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when query is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const { allowRequest } = require('@/lib/rate-limiter')
    allowRequest.mockResolvedValueOnce(false)
    const res = await POST(makeRequest({ query: 'find videos' }))
    expect(res.status).toBe(429)
  })

  it('returns ranked files with reasons and a summary', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({ query: 'find the product demo videos', teamId: 'team-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.files[0].reason).toBe('Matches product demo query')
    expect(body.summary).toBe('Found 1 relevant video')
  })
})
