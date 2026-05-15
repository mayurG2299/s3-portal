import '@testing-library/jest-dom'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/dashboard/sidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

jest.mock('@/components/dashboard/profile-actions', () => ({
  ProfileActions: () => <div>profile-actions</div>,
}))

jest.mock('@/lib/contexts/dashboard-context', () => ({
  useDashboard: () => ({
    selectedTeamId: 'team-1',
    selectedIdentityId: null,
    selectedBucketId: null,
    identities: [],
    isLoading: false,
    setIdentity: jest.fn(),
    setBucket: jest.fn(),
    setTeam: jest.fn(),
    pendingInviteCount: 0,
  }),
}))

jest.mock('@/components/rbac-provider', () => ({
  useRBAC: () => ({
    canViewScreen: () => true,
    isAdmin: true,
    isOwner: true,
  }),
}))

describe('Sidebar collapse behavior', () => {
  const baseProps = {
    email: 'user@example.com',
    teams: [{ id: 'team-1', name: 'Team One', slug: 'team-one' }],
    currentTeamId: 'team-1',
    storageUsedBytes: 0,
    storageLimitBytes: 1000,
    isOpen: true,
    onToggle: jest.fn(),
    pendingInviteCount: 0,
  }

  it('collapses sidebar when a nav item is clicked on desktop', () => {
    const onClose = jest.fn()

    render(
      <Sidebar
        {...baseProps}
        isMobile={false}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('link', { name: /files/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('toggles sidebar when logo is clicked on desktop', () => {
    const onClose = jest.fn()
    const onToggle = jest.fn()

    render(
      <Sidebar
        {...baseProps}
        isMobile={false}
        onClose={onClose}
        onToggle={onToggle}
      />
    )

    fireEvent.click(screen.getByText('S3'))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
