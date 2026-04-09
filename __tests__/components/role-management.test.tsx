import '@testing-library/jest-dom'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RoleManagement } from '@/components/admin/role-management'

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

describe('RoleManagement', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('shows view and edit actions for custom roles', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'role-1',
          name: 'EDITOR',
          description: 'Can update files',
          level: 55,
          isSystem: false,
        },
      ],
    })

    render(<RoleManagement teamId="team-1" />)

    await screen.findByText('EDITOR')

    expect(screen.getByRole('button', { name: /view role editor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit role editor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete role editor/i })).toBeInTheDocument()
  })

  it('opens a read-only modal when view is clicked', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'role-1',
            name: 'EDITOR',
            description: 'Can update files',
            level: 55,
            isSystem: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'role-1',
          name: 'EDITOR',
          description: 'Can update files',
          level: 55,
          isSystem: false,
          rolePermissions: [
            { screenName: 'FILES_LIST', permissionLevel: 'VIEW' },
            { screenName: 'FILES_UPLOAD', permissionLevel: 'EDIT' },
          ],
        }),
      })

    render(<RoleManagement teamId="team-1" />)

    fireEvent.click(await screen.findByRole('button', { name: /view role editor/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/roles/role-1?teamId=team-1')
    })

    expect(await screen.findByDisplayValue('EDITOR')).toBeDisabled()
    expect(screen.getByDisplayValue('Can update files')).toBeDisabled()
    expect(screen.getAllByText('Close').length).toBeGreaterThan(0)
  })
})
