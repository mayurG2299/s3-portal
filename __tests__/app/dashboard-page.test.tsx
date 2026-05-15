import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockRequireUser = jest.fn()
const mockGetAccessibleBucketIds = jest.fn()
const mockUserCanViewScreen = jest.fn()
const mockCanManageTeam = jest.fn()

const teamFindMany = jest.fn()
const awsBucketCount = jest.fn()
const credentialCount = jest.fn()
const fileCount = jest.fn()
const linkCount = jest.fn()
const teamMemberCount = jest.fn()
const storageQuotaFindUnique = jest.fn()
const fileAggregate = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}))

jest.mock('@/lib/bucket-access', () => ({
  getAccessibleBucketIds: (...args: unknown[]) => mockGetAccessibleBucketIds(...args),
}))

jest.mock('@/lib/permissions', () => ({
  userCanViewScreen: (...args: unknown[]) => mockUserCanViewScreen(...args),
  canManageTeam: (...args: unknown[]) => mockCanManageTeam(...args),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === 'selectedTeamId') return { value: 'team-1' }
      if (name === 'selectedIdentityId') return { value: 'cred-1' }
      if (name === 'selectedBucketId') return { value: 'bucket-1' }
      return undefined
    },
  }),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    team: { findMany: (...args: unknown[]) => teamFindMany(...args) },
    awsBucket: { count: (...args: unknown[]) => awsBucketCount(...args) },
    aWSCredential: { count: (...args: unknown[]) => credentialCount(...args) },
    file: {
      count: (...args: unknown[]) => fileCount(...args),
      aggregate: (...args: unknown[]) => fileAggregate(...args),
    },
    link: { count: (...args: unknown[]) => linkCount(...args) },
    teamMember: { count: (...args: unknown[]) => teamMemberCount(...args) },
    storageQuota: { findUnique: (...args: unknown[]) => storageQuotaFindUnique(...args) },
  },
}))

jest.mock('@/components/onboarding/FirstTimeWizard', () => ({
  FirstTimeWizard: () => <div>first-time-wizard</div>,
}))

const DashboardPage = require('@/app/dashboard/page').default

describe('DashboardPage', () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Mayur',
        teamId: 'team-1',
      },
    })

    mockGetAccessibleBucketIds.mockResolvedValue(['bucket-1'])
    mockUserCanViewScreen.mockResolvedValue(true)
    mockCanManageTeam.mockResolvedValue(true)

    teamFindMany.mockResolvedValue([{ id: 'team-1', name: 'Team One', slug: 'team-one' }])
    awsBucketCount.mockResolvedValue(2)
    credentialCount.mockResolvedValue(1)
    fileCount.mockResolvedValue(12)
    linkCount.mockResolvedValueOnce(4).mockResolvedValueOnce(1)
    teamMemberCount.mockResolvedValue(3)
    storageQuotaFindUnique.mockResolvedValue({ limitBytes: BigInt(1000) })
    fileAggregate.mockResolvedValue({ _sum: { size: BigInt(300) } })
  })

  it('hides action center when dashboard is healthy and does not render removed legacy sections', async () => {
    const page = await DashboardPage()

    render(page)

    expect(screen.queryByText(/action center/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/storage overview/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/transmission feed/i)).not.toBeInTheDocument()
  })

  it('renders action center when setup or risk actions exist', async () => {
    credentialCount.mockResolvedValue(0)

    const page = await DashboardPage()

    render(page)

    expect(screen.getByText(/action center/i)).toBeInTheDocument()
    expect(screen.getByText(/add cloud credentials/i)).toBeInTheDocument()
  })
})
