import { buildDashboardHealthCards } from '@/lib/dashboard-health-cards'

describe('buildDashboardHealthCards', () => {
  it('marks infrastructure as critical when no credentials are configured', () => {
    const cards = buildDashboardHealthCards({
      bucketsCount: 0,
      credentialsCount: 0,
      filesCount: 0,
      linksCount: 0,
      riskyLinksCount: 0,
      teamsCount: 1,
      usagePercent: 0,
      hasSelectedBucket: false,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
      canViewTeams: true,
    })

    const infrastructure = cards.find((card) => card.id === 'infrastructure')
    expect(infrastructure?.status).toBe('critical')
    expect(infrastructure?.ctaHref).toBe('/dashboard/settings')
  })

  it('marks file operations as warning when bucket is not selected', () => {
    const cards = buildDashboardHealthCards({
      bucketsCount: 3,
      credentialsCount: 1,
      filesCount: 20,
      linksCount: 0,
      riskyLinksCount: 0,
      teamsCount: 2,
      usagePercent: 20,
      hasSelectedBucket: false,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
      canViewTeams: true,
    })

    const fileOps = cards.find((card) => card.id === 'file-ops')
    expect(fileOps?.status).toBe('warning')
    expect(fileOps?.ctaLabel).toBe('Select bucket')
  })

  it('marks sharing as warning when risky link ratio is high', () => {
    const cards = buildDashboardHealthCards({
      bucketsCount: 2,
      credentialsCount: 1,
      filesCount: 10,
      linksCount: 8,
      riskyLinksCount: 5,
      teamsCount: 3,
      usagePercent: 40,
      hasSelectedBucket: true,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
      canViewTeams: true,
    })

    const sharing = cards.find((card) => card.id === 'sharing')
    expect(sharing?.status).toBe('warning')
    expect(sharing?.ctaHref).toBe('/dashboard/links')
  })

  it('keeps all cards ready when setup is healthy', () => {
    const cards = buildDashboardHealthCards({
      bucketsCount: 2,
      credentialsCount: 1,
      filesCount: 100,
      linksCount: 10,
      riskyLinksCount: 1,
      teamsCount: 4,
      usagePercent: 45,
      hasSelectedBucket: true,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
      canViewTeams: true,
    })

    expect(cards).toHaveLength(4)
    expect(cards.every((card) => card.status === 'ready')).toBe(true)
  })
})
