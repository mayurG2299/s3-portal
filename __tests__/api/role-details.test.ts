/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    role: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}))

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/audit', () => ({
  logUserAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/permissions', () => ({
  canManageTeam: jest.fn(),
}))

jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1', teams: [] }),
}))

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { canManageTeam } from '@/lib/permissions'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { GET, PATCH } from '@/app/api/roles/[id]/route'

const makeRequest = (url: string, body?: unknown) =>
  ({
    url,
    json: async () => body,
    cookies: { get: jest.fn().mockReturnValue(undefined) },
  } as any)

const makeContext = (id: string) =>
  ({
    params: Promise.resolve({ id }),
  } as any)

describe('GET /api/roles/[id]', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 'team-1', teams: [] })
  })

  it('returns the role with its permissions', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', teamId: 'team-1' },
    })
    ;(canManageTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.role.findUnique as jest.Mock).mockResolvedValue({
      id: 'role-1',
      name: 'EDITOR',
      rolePermissions: [{ screenName: 'FILES_LIST', permissionLevel: 'VIEW' }],
    })

    const response = await GET(makeRequest('http://localhost/api/roles/role-1?teamId=team-1'), makeContext('role-1'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.rolePermissions).toEqual([{ screenName: 'FILES_LIST', permissionLevel: 'VIEW' }])
    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      include: { rolePermissions: true },
    })
  })
})

describe('PATCH /api/roles/[id]', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 'team-1', teams: [] })
  })

  it('updates a role and replaces its permissions', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', teamId: 'team-1' },
    })
    ;(canManageTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.role.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'role-1',
        isSystem: false,
      })
      .mockResolvedValueOnce({
        id: 'role-1',
        name: 'EDITOR',
        description: 'Updated role',
        level: 44,
        isSystem: false,
        rolePermissions: [{ screenName: 'FILES_LIST', permissionLevel: 'VIEW' }],
      })
    ;(prisma.role.update as jest.Mock).mockResolvedValue({
      id: 'role-1',
      name: 'EDITOR',
      description: 'Updated role',
      level: 44,
      isSystem: false,
    })

    const response = await PATCH(
      makeRequest('http://localhost/api/roles/role-1?teamId=team-1', {
        name: 'EDITOR',
        description: 'Updated role',
        permissions: [{ screenName: 'FILES_LIST', permissionLevel: 'VIEW' }],
      }),
      makeContext('role-1')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.rolePermissions).toEqual([{ screenName: 'FILES_LIST', permissionLevel: 'VIEW' }])
    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: expect.objectContaining({
        name: 'EDITOR',
        description: 'Updated role',
        level: 20,
      }),
    })
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
    })
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'role-1', screenName: 'FILES_LIST', permissionLevel: 'VIEW' }],
    })
  })
})
