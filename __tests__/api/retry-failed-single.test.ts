/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      findMany: jest.fn().mockResolvedValue([{ fileId: 'file-1' }, { fileId: 'file-2' }]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  },
}))
jest.mock('@/lib/indexing/queue', () => ({ enqueueFileIndexing: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/api-utils', () => ({ requireScreenPermission: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1' }),
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/admin/indexing/retry-failed/route'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'
import { NextRequest } from 'next/server'

function makeRequest(body: object = {}) {
  return new NextRequest('http://localhost/api/admin/indexing/retry-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/indexing/retry-failed', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retries all failed when no fileId given', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    expect(prisma.fileEmbedding.updateMany).toHaveBeenCalled()
    expect(enqueueFileIndexing).toHaveBeenCalledTimes(2)
  })

  it('retries only the given fileId when provided', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({ fileId: 'file-1' }))
    expect(res.status).toBe(200)
    expect(prisma.fileEmbedding.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fileId: 'file-1' } })
    )
    expect(enqueueFileIndexing).toHaveBeenCalledWith('file-1', 5)
    expect(prisma.fileEmbedding.updateMany).not.toHaveBeenCalled()
  })
})
