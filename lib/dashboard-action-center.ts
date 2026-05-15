export type DashboardActionSeverity = 'critical' | 'warning' | 'info'

export interface DashboardAction {
  id: string
  severity: DashboardActionSeverity
  title: string
  description: string
  href: string
  ctaLabel: string
}

export interface DashboardActionInput {
  credentialsCount: number
  linksCount: number
  riskyLinksCount: number
  usagePercent: number
  hasSelectedBucket: boolean
  canViewSettings: boolean
  canViewFiles: boolean
  canViewLinks: boolean
}

const severityRank: Record<DashboardActionSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

export function buildDashboardActions(input: DashboardActionInput): DashboardAction[] {
  const actions: DashboardAction[] = []

  if (input.credentialsCount === 0) {
    actions.push({
      id: 'no-credentials',
      severity: 'critical',
      title: 'Add cloud credentials',
      description: 'Connect your AWS or S3-compatible credentials before using files and links.',
      href: input.canViewSettings ? '/dashboard/settings' : '/dashboard/teams',
      ctaLabel: input.canViewSettings ? 'Configure AWS' : 'Request access',
    })
  }

  if (input.credentialsCount > 0 && !input.hasSelectedBucket) {
    actions.push({
      id: 'select-bucket',
      severity: 'warning',
      title: 'Select a storage bucket',
      description: 'Choose a bucket from the header to start browsing and uploading files.',
      href: input.canViewFiles ? '/dashboard/files' : '/dashboard/settings',
      ctaLabel: input.canViewFiles ? 'Open files' : 'Open settings',
    })
  }

  if (input.usagePercent >= 80) {
    actions.push({
      id: 'quota-pressure',
      severity: input.usagePercent >= 95 ? 'critical' : 'warning',
      title: 'Storage usage is high',
      description: `Current usage is ${input.usagePercent.toFixed(1)}% of configured quota.`,
      href: input.canViewSettings ? '/dashboard/settings' : '/dashboard/files',
      ctaLabel: input.canViewSettings ? 'Review quota' : 'Review files',
    })
  }

  const riskyRatio = input.linksCount > 0 ? input.riskyLinksCount / input.linksCount : 0
  if (input.canViewLinks && input.linksCount > 0 && riskyRatio >= 0.5) {
    actions.push({
      id: 'risky-links',
      severity: 'warning',
      title: 'Shared link posture needs review',
      description: 'Several links are missing password protection or expiry. Tighten share settings.',
      href: '/dashboard/links',
      ctaLabel: 'Review links',
    })
  }

  const prioritized = actions
    .sort((a, b) => {
      const bySeverity = severityRank[b.severity] - severityRank[a.severity]
      if (bySeverity !== 0) return bySeverity
      return a.id.localeCompare(b.id)
    })
    .slice(0, 4)

  if (prioritized.length === 0) {
    prioritized.push({
      id: 'healthy',
      severity: 'info',
      title: 'System is ready',
      description: 'Your workspace is healthy. Continue uploading files and managing shares.',
      href: input.canViewFiles ? '/dashboard/files' : '/dashboard/teams',
      ctaLabel: input.canViewFiles ? 'Browse files' : 'Open teams',
    })
  }

  return prioritized
}
