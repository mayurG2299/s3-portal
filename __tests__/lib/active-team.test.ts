import { resolveActiveTeamId } from '@/lib/active-team'

describe('resolveActiveTeamId', () => {
  it('falls back to the first available team when cookie and session team are missing', () => {
    expect(
      resolveActiveTeamId(
        [
          { id: 'team-1', name: 'Team 1', slug: 'team-1' },
          { id: 'team-2', name: 'Team 2', slug: 'team-2' },
        ],
        null,
        null,
      )
    ).toBe('team-1')
  })

  it('uses the cookie team when it matches an available team', () => {
    expect(
      resolveActiveTeamId(
        [{ id: 'team-1', name: 'Team 1', slug: 'team-1' }],
        'team-1',
        null,
      )
    ).toBe('team-1')
  })

  it('falls back to the first available team when the session team is stale', () => {
    expect(
      resolveActiveTeamId(
        [{ id: 'team-1', name: 'Team 1', slug: 'team-1' }],
        null,
        'team-stale',
      )
    ).toBe('team-1')
  })
})
