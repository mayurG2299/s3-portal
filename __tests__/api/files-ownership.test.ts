/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    file: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    teamMember: { findFirst: jest.fn(), findUnique: jest.fn() },
    fileFavorite: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    accessLog: { create: jest.fn() },
  },
}))
jest.mock('@/lib/permissions', () => ({
  canAccessTeam: jest.fn(),
  canManageTeam: jest.fn(),
  getUserScreenPermission: jest.fn(),
  userCanViewScreen: jest.fn().mockResolvedValue(true),
  userCanEditScreen: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/team-selection', () => ({ getResolvedUserTeamScope: jest.fn() }))
jest.mock('@/lib/audit', () => ({ logUserAction: jest.fn() }))
jest.mock('@/lib/storage-quota', () => ({
  getQuotaForTeam: jest.fn(),
  checkQuotaBeforeUpload: jest.fn(),
  incrementUsage: jest.fn(),
  decrementUsage: jest.fn(),
}))

import { POST } from '@/app/api/files/favorites/route'
import { getServerSession } from 'next-auth'
import { canAccessTeam } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { NextRequest } from 'next/server'

describe('toggleFavorite ownership bypass', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 when file.userId matches session but user is no longer in the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', teamId: 't1', email: 'u1@test.com' },
    })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    // teamMember.findUnique returns membership so team resolution works
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({ teamId: 't1' })
    ;(prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1', userId: 'u1', teamId: 't1', key: 'test.txt', bucketId: 'b1',
    })
    // User owns the file but is NOT in the team anymore
    ;(canAccessTeam as jest.Mock).mockResolvedValue(false)

    const req = new NextRequest('http://localhost/api/files', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggleFavorite', id: 'f1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('allows toggleFavorite when user is a current team member', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', teamId: 't1', email: 'u1@test.com' },
    })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({ teamId: 't1' })
    ;(prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1', userId: 'u2', teamId: 't1', key: 'test.txt', bucketId: 'b1',
    })
    ;(canAccessTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.fileFavorite.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.fileFavorite.create as jest.Mock).mockResolvedValue({ id: 'fav1' })

    const req = new NextRequest('http://localhost/api/files', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggleFavorite', id: 'f1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
