jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    rolePermission: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/crypto', () => ({
  hashPassword: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn(),
}))

jest.mock('@/lib/rate-limiter', () => ({
  allowRequest: jest.fn().mockResolvedValue(true),
}))

import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { POST } from '@/app/api/auth/register/route'

describe('register route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('bootstraps system roles when OWNER is missing and still creates the account', async () => {
    const mockPrisma = prisma as jest.Mocked<typeof prisma>
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null)
    ;(hashPassword as jest.Mock).mockResolvedValueOnce('hashed-password')
    ;(mockPrisma.role.findUnique as jest.Mock).mockResolvedValueOnce(null)
    ;(mockPrisma.role.upsert as jest.Mock)
      .mockResolvedValueOnce({ id: 'role_owner', name: 'OWNER' })
      .mockResolvedValueOnce({ id: 'role_admin', name: 'ADMIN' })
      .mockResolvedValueOnce({ id: 'role_viewer', name: 'VIEWER' })
    ;(mockPrisma.rolePermission.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValueOnce({
            id: 'user-id',
            name: 'Mayur Ghadi',
            email: 'mayur@fitpage.in',
            createdAt: new Date('2026-04-18T10:00:00.000Z'),
          }),
        },
        team: {
          create: jest.fn().mockResolvedValueOnce({
            id: 'team-id',
          }),
        },
        teamMember: {
          create: jest.fn().mockResolvedValueOnce({
            id: 'member-id',
          }),
        },
      }
      return callback(tx)
    })

    const request = {
      json: async () => ({
        name: 'Mayur Ghadi',
        email: 'mayur@fitpage.in',
        password: 'Password@123',
      }),
      headers: { get: jest.fn().mockReturnValue(null) },
    }

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(mockPrisma.role.upsert).toHaveBeenCalledTimes(3)
    expect(json.email).toBe('mayur@fitpage.in')
  })

  it('returns a user-safe message when role bootstrap fails', async () => {
    const mockPrisma = prisma as jest.Mocked<typeof prisma>
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null)
    ;(hashPassword as jest.Mock).mockResolvedValueOnce('hashed-password')
    ;(mockPrisma.role.findUnique as jest.Mock).mockResolvedValueOnce(null)
    ;(mockPrisma.role.upsert as jest.Mock).mockRejectedValueOnce(new Error('db bootstrap failed'))

    const request = {
      json: async () => ({
        name: 'Mayur Ghadi',
        email: 'mayur@fitpage.in',
        password: 'Password@123',
      }),
      headers: { get: jest.fn().mockReturnValue(null) },
    }

    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.message).toBe('Account creation is temporarily unavailable. Please contact your administrator.')
    expect(json.message).not.toMatch(/db:seed/i)
  })
})
