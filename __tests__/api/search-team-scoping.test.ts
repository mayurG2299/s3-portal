/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  prisma: {
    file: { findMany: jest.fn() },
    link: { findMany: jest.fn() },
    awsBucket: { findMany: jest.fn() },
    team: { findMany: jest.fn() },
    teamMember: { findMany: jest.fn() },
  },
}))

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/bucket-access', () => ({
  getAccessibleBucketIds: jest.fn(),
}))

jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn(),
}))

jest.mock('@/lib/search-utils', () => ({
  searchAndRank: jest.fn((_query: string, dataset: any[]) =>
    dataset.map((item, index) => ({
      item,
      score: 100 - index,
      matchedField: 'title',
    }))
  ),
}))

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { getAccessibleBucketIds } from '@/lib/bucket-access'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { GET as searchGet } from '@/app/api/search/route'

function makeRequest(url: string) {
  const parsed = new URL(url)
  return {
    nextUrl: { searchParams: parsed.searchParams },
    cookies: { get: jest.fn().mockReturnValue(undefined) },
  } as any
}

describe('Search API team scoping for Team-type results', () => {
  const allTeams = [
    { id: 'team-1', name: 'Alpha Team', slug: 'alpha-team' },
    { id: 'team-2', name: 'Beta Team', slug: 'beta-team' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1', teamId: 'team-1' } })
    ;(getAccessibleBucketIds as jest.Mock).mockResolvedValue(null)

    ;(prisma.file.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.link.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.awsBucket.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.team.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      const idFilter = where?.id
      if (idFilter) {
        return Promise.resolve(allTeams.filter((team) => team.id === idFilter))
      }
      return Promise.resolve(allTeams)
    })
  })

  it('returns only the selected team in Team-type results when a team scope is resolved', async () => {
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({
      teamId: 'team-1',
      teams: [
        { id: 'team-1', name: 'Alpha Team', slug: 'alpha-team' },
        { id: 'team-2', name: 'Beta Team', slug: 'beta-team' },
      ],
    })

    const res = await searchGet(makeRequest('http://localhost/api/search?q=team&teamId=team-1'))
    const json = await res.json()

    expect(res.status).toBe(200)

    const teamResults = (json.results || []).filter((r: any) => r.type === 'team')
    expect(teamResults).toHaveLength(1)
    expect(teamResults[0].teamId).toBe('team-1')
  })

  it('returns all accessible teams when there is no selected team scope', async () => {
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({
      teamId: null,
      teams: [
        { id: 'team-1', name: 'Alpha Team', slug: 'alpha-team' },
        { id: 'team-2', name: 'Beta Team', slug: 'beta-team' },
      ],
    })

    const res = await searchGet(makeRequest('http://localhost/api/search?q=team'))
    const json = await res.json()

    expect(res.status).toBe(200)

    const teamResults = (json.results || []).filter((r: any) => r.type === 'team')
    expect(teamResults).toHaveLength(2)
    expect(teamResults.map((r: any) => r.teamId).sort()).toEqual(['team-1', 'team-2'])
  })

  it('keeps member query scoped by selected team', async () => {
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({
      teamId: 'team-1',
      teams: [{ id: 'team-1', name: 'Alpha Team', slug: 'alpha-team' }],
    })

    await searchGet(makeRequest('http://localhost/api/search?q=team&teamId=team-1'))

    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: 'team-1' }),
      })
    )
  })
})
