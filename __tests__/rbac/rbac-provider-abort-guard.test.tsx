import React from 'react'
import { render, act, waitFor } from '@testing-library/react'

import { RBACProvider, useRBAC } from '@/components/rbac-provider'
import * as ReactModule from 'react'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1', roleId: 'ADMIN', teamId: 'team-1' } }, status: 'authenticated' })
}))

const DashboardContext = React.createContext({ selectedTeamId: 'team-1' })
function DashboardProvider({ selectedTeamId, children }: { selectedTeamId: string, children: React.ReactNode }) {
  return (
    <DashboardContext.Provider value={{ selectedTeamId }}>{children}</DashboardContext.Provider>
  )
}
jest.mock('@/lib/contexts/dashboard-context', () => ({
  useDashboard: () => React.useContext(DashboardContext)
}))

global.fetch = jest.fn()

describe('RBACProvider abort guard', () => {
  afterEach(() => {
    if (typeof (global.fetch as any).mockReset === 'function') {
      (global.fetch as jest.Mock).mockReset()
    }
  })


  it('should only update permissions from the latest fetch (abort guard)', async () => {
    const resolves: { first?: (value: any) => void; second?: (value: any) => void } = {}
    const firstPromise = new Promise(res => { resolves.first = res })
    const secondPromise = new Promise(res => { resolves.second = res })

    // Simulate two rapid fetches: first is slow, second is fast
    (fetch as jest.Mock)
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise)

    let permissions: any = null
    function TestComponent() {
      const rbac = useRBAC()
      permissions = rbac.screenPermissions
      return null
    }

    function Wrapper() {
      const [teamId, setTeamId] = ReactModule.useState('team-1')
      // Expose setTeamId for test
      (Wrapper as any).setTeamId = setTeamId
      return (
        <DashboardProvider selectedTeamId={teamId}>
          <RBACProvider>
            <TestComponent />
          </RBACProvider>
        </DashboardProvider>
      )
    }

    render(<Wrapper />)

    // Trigger first fetch (team-1)
    await act(async () => {})
    // Simulate team switch (team-2)
    await act(async () => {
      (Wrapper as any).setTeamId('team-2')
    })

    // Trigger second fetch
    await act(async () => {})

    // Resolve second fetch first (should win)
    await act(async () => {
      resolves.second && resolves.second({ ok: true, json: async () => ([{ screenName: 'DASHBOARD', permissionLevel: 'VIEW' }]) })
    })
    await waitFor(() => expect(permissions?.get('DASHBOARD')).toBe('VIEW'))

    // Now resolve first fetch (should be ignored)
    await act(async () => {
      resolves.first && resolves.first({ ok: true, json: async () => ([{ screenName: 'ADMIN_PANEL', permissionLevel: 'EDIT' }]) })
    })
    // Permissions should still only have 'DASHBOARD', not 'ADMIN_PANEL'
    await waitFor(() => expect(permissions?.get('ADMIN_PANEL')).toBeUndefined())
  })

  it('should clear permissions on fetch error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    let permissions: any = 'not-null'
    function TestComponent() {
      const rbac = useRBAC()
      permissions = rbac.screenPermissions
      return null
    }
    render(
      <RBACProvider>
        <TestComponent />
      </RBACProvider>
    )
    await waitFor(() => expect(permissions).toBeNull())
  })
})
