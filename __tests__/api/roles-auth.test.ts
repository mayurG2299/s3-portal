/** @jest-environment node */

import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/permissions', () => ({ canManageTeam: jest.fn() }))
jest.mock('@/lib/team-selection', () => ({ getResolvedUserTeamScope: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    role: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/audit', () => ({ logUserAction: jest.fn() }))

import { GET } from '@/app/api/roles/route'
import { getServerSession } from 'next-auth'
import { canManageTeam } from '@/lib/permissions'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { prisma } from '@/lib/db'

describe('GET /api/roles/[id] auth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 for non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(false)

    const { GET: getById } = await import('@/app/api/roles/[id]/route')
    const req = new NextRequest('http://localhost/api/roles/r1')
    const res = await getById(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/roles auth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 for a user who cannot manage the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(false)

    const req = new NextRequest('http://localhost/api/roles')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 and roles array for an admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.role.findMany as jest.Mock).mockResolvedValue([{ id: 'r1', name: 'ADMIN', level: 50 }])

    const req = new NextRequest('http://localhost/api/roles')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
