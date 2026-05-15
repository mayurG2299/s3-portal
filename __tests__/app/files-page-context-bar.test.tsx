import '@testing-library/jest-dom'
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const mockSetIdentity = jest.fn()
const mockSetBucket = jest.fn()
const mockHandleTeamAccessFailure = jest.fn()
let mockSearchPath: string | null = null

let mockDashboardState = {
  selectedIdentityId: null as string | null,
  selectedBucketId: null as string | null,
  identities: [] as Array<{ id: string; name: string; buckets: Array<{ id: string; bucket: string }> }>,
  isLoading: false,
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({
    get: (name: string) => (name === 'path' ? mockSearchPath : null),
  }),
}))

jest.mock('next/dynamic', () => {
  return () => {
    const DynamicComponent = () => null
    DynamicComponent.displayName = 'DynamicMock'
    return DynamicComponent
  }
})

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}))

jest.mock('@/hooks/use-keyboard-nav', () => ({
  useKeyboardNav: () => ({
    focusedIndex: -1,
    itemRefs: { current: [] },
  }),
}))

jest.mock('@/components/rbac-provider', () => ({
  useRBAC: () => ({
    canViewScreen: () => true,
    loading: false,
    loadingScreenPermissions: false,
  }),
}))

jest.mock('@/lib/contexts/dashboard-context', () => ({
  useDashboard: () => ({
    ...mockDashboardState,
    setIdentity: mockSetIdentity,
    setBucket: mockSetBucket,
    handleTeamAccessFailure: mockHandleTeamAccessFailure,
  }),
}))

describe('FilesPage context bar behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: jest.fn(),
    })

    mockDashboardState = {
      selectedIdentityId: null,
      selectedBucketId: null,
      identities: [],
      isLoading: false,
    }
    mockSearchPath = null

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [], folders: [] }),
    }) as jest.Mock
  })

  it('expands top context bar when user clicks Choose Context in empty state', async () => {
    const FilesPage = require('@/app/dashboard/files/page').default

    render(<FilesPage />)

    const topToggle = screen.getByRole('button', { name: /no credentials/i })
    expect(topToggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: /choose context/i }))

    expect(topToggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows selected credential and bucket names in collapsed summary', async () => {
    mockDashboardState = {
      selectedIdentityId: 'cred-1',
      selectedBucketId: 'bucket-2',
      identities: [
        {
          id: 'cred-1',
          name: 'Primary Team Credential',
          buckets: [
            { id: 'bucket-1', bucket: 'logs' },
            { id: 'bucket-2', bucket: 'uploads' },
          ],
        },
      ],
      isLoading: false,
    }

    global.fetch = jest.fn().mockImplementation(
      () => new Promise(() => {})
    ) as jest.Mock

    const FilesPage = require('@/app/dashboard/files/page').default

    render(<FilesPage />)

    const summaryToggle = screen.getByRole('button', { name: /primary team credential/i })
    expect(summaryToggle).toHaveTextContent('Primary Team Credential')
    expect(summaryToggle).toHaveTextContent('uploads')
  })

  it('shows selected-items action bar after choosing a file and hides it on clear', async () => {
    mockDashboardState = {
      selectedIdentityId: 'cred-1',
      selectedBucketId: 'bucket-1',
      identities: [
        {
          id: 'cred-1',
          name: 'Primary Team Credential',
          buckets: [
            { id: 'bucket-1', bucket: 'uploads' },
          ],
        },
      ],
      isLoading: false,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        objects: [
          {
            id: 'file-1',
            name: 'report.pdf',
            size: '2048',
            contentType: 'application/pdf',
            createdAt: '2026-04-20T10:00:00.000Z',
            key: 'report.pdf',
          },
        ],
        totalFiles: 1,
        totalPages: 1,
        hasMore: false,
      }),
    }) as jest.Mock

    const FilesPage = require('@/app/dashboard/files/page').default
    render(<FilesPage />)

    const selectFileCheckbox = await screen.findByLabelText('Select report.pdf')
    fireEvent.click(selectFileCheckbox)

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }))

    await waitFor(() => {
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument()
    })
  })

  it('shows current-folder chip when browsing nested paths', async () => {
    mockSearchPath = 'reports/2026'
    mockDashboardState = {
      selectedIdentityId: 'cred-1',
      selectedBucketId: 'bucket-1',
      identities: [
        {
          id: 'cred-1',
          name: 'Primary Team Credential',
          buckets: [{ id: 'bucket-1', bucket: 'uploads' }],
        },
      ],
      isLoading: false,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: [], totalFiles: 0, totalPages: 1, hasMore: false }),
    }) as jest.Mock

    const FilesPage = require('@/app/dashboard/files/page').default
    render(<FilesPage />)

    await waitFor(() => {
      expect(screen.getByText(/current folder/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows compact actions menu trigger and opens it on small-screen header', async () => {
    mockDashboardState = {
      selectedIdentityId: 'cred-1',
      selectedBucketId: 'bucket-1',
      identities: [
        {
          id: 'cred-1',
          name: 'Primary Team Credential',
          buckets: [{ id: 'bucket-1', bucket: 'uploads' }],
        },
      ],
      isLoading: false,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: [], totalFiles: 0, totalPages: 1, hasMore: false }),
    }) as jest.Mock

    const FilesPage = require('@/app/dashboard/files/page').default
    render(<FilesPage />)

    const actionsTrigger = screen.getByRole('button', { name: /actions/i })
    fireEvent.click(actionsTrigger)

    const actionsMenu = screen.getByRole('menu', { name: /header actions/i })
    expect(within(actionsMenu).getByRole('button', { name: /^new folder$/i })).toBeInTheDocument()
    expect(within(actionsMenu).getByRole('button', { name: /^refresh$/i })).toBeInTheDocument()
  })

  it('closes compact actions menu when clicking outside', async () => {
    mockDashboardState = {
      selectedIdentityId: 'cred-1',
      selectedBucketId: 'bucket-1',
      identities: [
        {
          id: 'cred-1',
          name: 'Primary Team Credential',
          buckets: [{ id: 'bucket-1', bucket: 'uploads' }],
        },
      ],
      isLoading: false,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: [], totalFiles: 0, totalPages: 1, hasMore: false }),
    }) as jest.Mock

    const FilesPage = require('@/app/dashboard/files/page').default
    render(<FilesPage />)

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    expect(screen.getByRole('menu', { name: /header actions/i })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /header actions/i })).not.toBeInTheDocument()
    })
  })
})
