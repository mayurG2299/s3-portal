import { buildDashboardActions } from '@/lib/dashboard-action-center'

describe('buildDashboardActions', () => {
  it('returns critical configure action when no credentials exist', () => {
    const actions = buildDashboardActions({
      credentialsCount: 0,
      linksCount: 0,
      riskyLinksCount: 0,
      usagePercent: 0,
      hasSelectedBucket: false,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
    })

    expect(actions[0].id).toBe('no-credentials')
    expect(actions[0].severity).toBe('critical')
    expect(actions[0].href).toBe('/dashboard/settings')
  })

  it('returns warning at 80 percent quota and critical at 95 percent', () => {
    const warning = buildDashboardActions({
      credentialsCount: 2,
      linksCount: 0,
      riskyLinksCount: 0,
      usagePercent: 80,
      hasSelectedBucket: true,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
    })
    const critical = buildDashboardActions({
      credentialsCount: 2,
      linksCount: 0,
      riskyLinksCount: 0,
      usagePercent: 95,
      hasSelectedBucket: true,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
    })

    expect(warning.find((a) => a.id === 'quota-pressure')?.severity).toBe('warning')
    expect(critical.find((a) => a.id === 'quota-pressure')?.severity).toBe('critical')
  })

  it('returns healthy fallback when no risk condition exists', () => {
    const actions = buildDashboardActions({
      credentialsCount: 1,
      linksCount: 0,
      riskyLinksCount: 0,
      usagePercent: 30,
      hasSelectedBucket: true,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
    })

    expect(actions).toHaveLength(1)
    expect(actions[0].id).toBe('healthy')
    expect(actions[0].severity).toBe('info')
  })

  it('sorts by severity and limits output to 4 actions', () => {
    const actions = buildDashboardActions({
      credentialsCount: 1,
      linksCount: 10,
      riskyLinksCount: 8,
      usagePercent: 96,
      hasSelectedBucket: false,
      canViewSettings: true,
      canViewFiles: true,
      canViewLinks: true,
    })

    expect(actions.length).toBeLessThanOrEqual(4)
    expect(actions[0].severity).toBe('critical')
  })
})
