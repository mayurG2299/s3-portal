jest.mock('@/lib/db', () => ({
  prisma: {
    team: {
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

describe('getResolvedUserTeamScope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('falls back to the first accessible team when cookie and session teams are stale', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'team-1', name: 'Team 1', slug: 'team-1' },
      { id: 'team-2', name: 'Team 2', slug: 'team-2' },
    ])

    await expect(
      getResolvedUserTeamScope({
        userId: 'user-1',
        cookieTeamId: 'stale-cookie',
        sessionTeamId: 'stale-session',
      })
    ).resolves.toEqual({
      teams: [
        { id: 'team-1', name: 'Team 1', slug: 'team-1' },
        { id: 'team-2', name: 'Team 2', slug: 'team-2' },
      ],
      teamId: 'team-1',
    })
  })

  it('prefers a valid explicit requested team over cookie or session', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'team-1', name: 'Team 1', slug: 'team-1' },
      { id: 'team-2', name: 'Team 2', slug: 'team-2' },
    ])

    await expect(
      getResolvedUserTeamScope({
        userId: 'user-1',
        requestedTeamId: 'team-2',
        cookieTeamId: 'team-1',
        sessionTeamId: 'team-1',
      })
    ).resolves.toEqual({
      teams: [
        { id: 'team-1', name: 'Team 1', slug: 'team-1' },
        { id: 'team-2', name: 'Team 2', slug: 'team-2' },
      ],
      teamId: 'team-2',
    })
  })
})
