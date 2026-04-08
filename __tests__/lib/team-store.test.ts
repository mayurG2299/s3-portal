import { useTeamStore } from '@/lib/stores/team-store'

describe('team store', () => {
  beforeEach(() => {
    useTeamStore.setState({
      currentTeamId: null,
      teams: [],
      invitations: [],
      removedTeamId: null,
      removalModalOpen: false,
    })
  })

  test('accept-style updates can add team and remove invitation immediately', () => {
    useTeamStore.getState().initialize({
      teams: [{ id: 'team-a', name: 'Team A', slug: 'team-a' }],
      currentTeamId: 'team-a',
    })
    useTeamStore.getState().setInvitations([
      {
        id: 'invite-1',
        email: 'user@example.com',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        team: { id: 'team-b', name: 'Team B', slug: 'team-b' },
        role: { id: 'role-admin', name: 'ADMIN', description: null },
        invitedBy: { name: 'Owner', email: 'owner@example.com' },
      },
    ])

    useTeamStore.getState().addTeam({ id: 'team-b', name: 'Team B', slug: 'team-b' })
    useTeamStore.getState().removeInvitation('invite-1')

    const state = useTeamStore.getState()
    expect(state.teams.map((item) => item.id)).toEqual(['team-a', 'team-b'])
    expect(state.invitations).toEqual([])
  })

  test('switching to an invalid team keeps currentTeamId valid', () => {
    useTeamStore.getState().initialize({
      teams: [
        { id: 'team-a', name: 'Team A', slug: 'team-a' },
        { id: 'team-b', name: 'Team B', slug: 'team-b' },
      ],
      currentTeamId: 'team-a',
    })

    useTeamStore.getState().setCurrentTeamId('team-x')

    expect(useTeamStore.getState().currentTeamId).toBe('team-a')
  })

  test('removing selected team opens blocking modal and moves to fallback team', () => {
    useTeamStore.getState().initialize({
      teams: [
        { id: 'team-a', name: 'Team A', slug: 'team-a' },
        { id: 'team-b', name: 'Team B', slug: 'team-b' },
      ],
      currentTeamId: 'team-a',
    })

    useTeamStore.getState().removeTeam('team-a')

    const state = useTeamStore.getState()
    expect(state.currentTeamId).toBe('team-b')
    expect(state.removedTeamId).toBe('team-a')
    expect(state.removalModalOpen).toBe(true)
  })
})
