/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/api-utils', () => ({ requireScreenPermission: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1' }),
}))

import { getServerSession } from 'next-auth'
import { GET, POST } from '@/app/api/admin/ai-credentials/route'
import { NextRequest } from 'next/server'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/admin/ai-credentials', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/ai-credentials', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns configured status for each provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('openai')
    expect(body).toHaveProperty('anthropic')
    expect(typeof body.openai.configured).toBe('boolean')
  })
})

describe('POST /api/admin/ai-credentials', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await POST(makeRequest('POST', { provider: 'openai', key: 'sk-test' }))
    expect(res.status).toBe(401)
  })

  it('returns env-only message for any save attempt', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest('POST', { provider: 'openai', key: 'sk-test' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('envOnly', true)
  })
})

describe('POST /api/admin/ai-credentials/test', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const { POST: testPOST } = require('@/app/api/admin/ai-credentials/test/route')
    const res = await testPOST(makeRequest('POST'))
    expect(res.status).toBe(401)
  })

  it('returns provider status object', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const { POST: testPOST } = require('@/app/api/admin/ai-credentials/test/route')
    const res = await testPOST(makeRequest('POST'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('openai')
    expect(body).toHaveProperty('anthropic')
  })
})
