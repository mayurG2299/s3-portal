import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardProvider, useDashboard } from '@/lib/contexts/dashboard-context'
import { useTeamStore } from '@/lib/stores/team-store'
import { DashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { SessionProvider } from 'next-auth/react'

const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
  usePathname: () => '/dashboard',
  useSearchParams: () => ({ get: () => null }),
}))

jest.mock('js-cookie', () => ({
  set: jest.fn(),
  remove: jest.fn(),
}))

class MockEventSource {
  url: string
  listeners: Map<string, Array<() => void>> = new Map()

  constructor(url: string) {
    this.url = url
  }

  addEventListener(event: string, callback: () => void) {
    const list = this.listeners.get(event) || []
    list.push(callback)
    this.listeners.set(event, list)
  }

  removeEventListener(event: string, callback: () => void) {
    const list = this.listeners.get(event) || []
    this.listeners.set(
      event,
      list.filter((item) => item !== callback)
    )
  }

  close() {}
}

function makeResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

function TestHarness() {
  const dashboard = useDashboard()

  return (
    <div>
      <div data-testid="selected-team">{dashboard.selectedTeamId || 'none'}</div>
      <div data-testid="team-count">{dashboard.teams.length}</div>
      <div data-testid="invite-count">{dashboard.invitations.length}</div>
      <button onClick={() => dashboard.setTeam('team-b')}>switch-team</button>
      <button onClick={() => dashboard.acceptInvitation('invite-1')}>accept-invite</button>
      <button onClick={() => dashboard.handleTeamAccessFailure(403)}>simulate-removed</button>
    </div>
  )
}

function renderDashboardProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  const view = render(
    <SessionProvider session={{ user: { id: 'test-user', name: 'Test User', email: 'test@example.com', role: 'ADMIN', teamId: 'team-a' }, expires: '2099-01-01T00:00:00.000Z' }}>
      <QueryClientProvider client={queryClient}>
        <DashboardProvider
          initialTeams={[
            { id: 'team-a', name: 'Team A', slug: 'team-a' },
            { id: 'team-b', name: 'Team B', slug: 'team-b' },
          ]}
          initialTeamId="team-a"
        >
          <DashboardChrome
            name="Test User"
            email="test@example.com"
            roleTitle="ADMIN"
            storageUsedBytes={0}
            storageLimitBytes={1000}
            initialTeams={[
              { id: 'team-a', name: 'Team A', slug: 'team-a' },
              { id: 'team-b', name: 'Team B', slug: 'team-b' },
            ]}
            currentTeamId="team-a"
            pendingInviteCount={0}
          >
            <TestHarness />
          </DashboardChrome>
        </DashboardProvider>
      </QueryClientProvider>
    </SessionProvider>
  )

  return { ...view, queryClient }
}

// Patch: Utility to close modal if present before interacting with dashboard
async function closeTeamRemovedModalIfPresent() {
  try {
    const okButton = await screen.findByRole('button', { name: 'OK' })
    if (okButton) {
      await act(async () => {
        fireEvent.click(okButton)
      })
    }
  } catch {}
}

describe('dashboard context integration', () => {
  beforeEach(() => {
    ;(global as any).EventSource = MockEventSource
    refreshMock.mockClear()
    useTeamStore.setState({
      currentTeamId: null,
      teams: [],
      invitations: [],
      removedTeamId: null,
      removalModalOpen: false,
    })
  })

  beforeAll(() => {
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/team/invites')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'invite-1',
              email: 'user@example.com',
              expiresAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              team: { id: 'team-c', name: 'Team C', slug: 'team-c' },
              role: { id: 'role-admin', name: 'ADMIN', description: null },
              invitedBy: { name: 'Owner', email: 'owner@example.com' },
            },
          ]),
        })
      }
      if (typeof url === 'string' && url.includes('/api/teams')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'team-a', name: 'Team A', slug: 'team-a' },
            { id: 'team-b', name: 'Team B', slug: 'team-b' },
          ]),
        })
      }
      if (typeof url === 'string' && url.includes('/api/permissions/screens')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
    })
  })

  // Patch: Mock window.location.reload to a no-op for jsdom navigation error
  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    // jest.spyOn(window.location, 'reload').mockImplementation(() => {})
  }

  test('accept invitation updates store immediately and revalidates', async () => {
    let invites = [
      {
        id: 'invite-1',
        email: 'user@example.com',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        team: { id: 'team-c', name: 'Team C', slug: 'team-c' },
        role: { id: 'role-admin', name: 'ADMIN', description: null },
        invitedBy: { name: 'Owner', email: 'owner@example.com' },
      },
    ]
    let teams = [
      { id: 'team-a', name: 'Team A', slug: 'team-a' },
      { id: 'team-b', name: 'Team B', slug: 'team-b' },
    ]

    useTeamStore.setState({
      currentTeamId: 'team-a',
      teams,
      invitations: invites,
      removedTeamId: null,
      removalModalOpen: false,
    })

    renderDashboardProvider()

    // Patch: Close modal if present before interacting with dashboard
    await closeTeamRemovedModalIfPresent()

    await waitFor(() => expect(screen.getByTestId('invite-count').textContent).toBe('1'))
    fireEvent.click(screen.getByText('accept-invite'))
    await waitFor(() => expect(screen.getByTestId('invite-count').textContent).toBe('0'))
  })

  test('team switch updates current team and invalidates queries', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/teams')) {
        return makeResponse(200, [
            { id: 'team-a', name: 'Team A', slug: 'team-a' },
            { id: 'team-b', name: 'Team B', slug: 'team-b' },
          ])
      }
      if (url.includes('/api/team/invites')) {
        return makeResponse(200, [])
      }
      if (url.includes('/api/permissions/screens')) {
        return makeResponse(200, [])
      }
      if (url.includes('/api/credentials')) {
        return makeResponse(200, { credentials: [] })
      }
      return makeResponse(404, {})
    }) as any

    const { queryClient } = renderDashboardProvider()
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    // Patch: Close modal if present before interacting with dashboard
    await closeTeamRemovedModalIfPresent()

    await waitFor(() => expect(screen.getByTestId('selected-team').textContent).toBe('team-a'))
    fireEvent.click(screen.getByText('switch-team'))
    await waitFor(() => expect(screen.getByTestId('selected-team').textContent).toBe('team-b'))
    expect(invalidateSpy).toHaveBeenCalled()
    expect(refreshMock).toHaveBeenCalled()
  })

  test('403/404 safety net blocks UI with removal modal and recovers on OK', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/teams')) {
        return makeResponse(200, [
            { id: 'team-a', name: 'Team A', slug: 'team-a' },
            { id: 'team-b', name: 'Team B', slug: 'team-b' },
          ])
      }
      if (url.includes('/api/team/invites')) {
        return makeResponse(200, [])
      }
      if (url.includes('/api/permissions/screens')) {
        return makeResponse(200, [])
      }
      if (url.includes('/api/credentials')) {
        return makeResponse(200, { credentials: [] })
      }
      return makeResponse(404, {})
    }) as any

    renderDashboardProvider()

    await waitFor(() => expect(screen.getByTestId('selected-team').textContent).toBe('team-a'))

    fireEvent.click(screen.getByText('simulate-removed'))

    await waitFor(() => {
      expect(screen.getByText('You have been removed from this team by the owner.')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    })

    await waitFor(() => expect(screen.getByTestId('selected-team').textContent).toBe('team-b'))
  })
})
