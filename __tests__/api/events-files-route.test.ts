/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { teamMember: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/events/files', () => ({
  createFileEventStream: jest.fn(() => new ReadableStream()),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { createFileEventStream } from '@/lib/events/files'
import { GET } from '@/app/api/events/files/route'
import { NextRequest } from 'next/server'

function makeRequest(teamId?: string) {
  const url = teamId
    ? `http://localhost/api/events/files?teamId=${teamId}`
    : 'http://localhost/api/events/files'
  return new NextRequest(url)
}

describe('GET /api/events/files', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when teamId query param is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not a member of the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(403)
  })

  it('returns 200 SSE stream when user is a valid team member', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'tm-1' })
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(createFileEventStream).toHaveBeenCalledWith('team-1')
  })
})
