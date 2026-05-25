export type DashboardHealthStatus = 'critical' | 'warning' | 'ready'

export interface DashboardHealthCard {
  id: 'infrastructure' | 'file-ops' | 'sharing' | 'access'
  label: string
  value: number
  description: string
  status: DashboardHealthStatus
  statusLabel: string
  ctaHref: string
  ctaLabel: string
}

export interface DashboardHealthInput {
  bucketsCount: number
  credentialsCount: number
  filesCount: number
  linksCount: number
  riskyLinksCount: number
  teamsCount: number
  usagePercent: number
  hasSelectedBucket: boolean
  canViewSettings: boolean
  canViewFiles: boolean
  canViewLinks: boolean
  canViewTeams: boolean
}

export function buildDashboardHealthCards(input: DashboardHealthInput): DashboardHealthCard[] {
  const riskyRatio = input.linksCount > 0 ? input.riskyLinksCount / input.linksCount : 0

  const infrastructureStatus: DashboardHealthStatus =
    input.credentialsCount === 0
      ? 'critical'
      : input.bucketsCount === 0
        ? 'warning'
        : 'ready'

  const fileOpsStatus: DashboardHealthStatus =
    input.credentialsCount > 0 && !input.hasSelectedBucket
      ? 'warning'
      : input.usagePercent >= 95
        ? 'critical'
        : input.usagePercent >= 80
          ? 'warning'
          : 'ready'

  const sharingStatus: DashboardHealthStatus =
    input.canViewLinks && input.linksCount > 0 && riskyRatio >= 0.5
      ? 'warning'
      : 'ready'

  const accessStatus: DashboardHealthStatus = input.teamsCount <= 1 ? 'warning' : 'ready'

  return [
    {
      id: 'infrastructure',
      label: 'Cloud Storage',
      value: input.bucketsCount,
      description: 'Storage buckets connected',
      status: infrastructureStatus,
      statusLabel: infrastructureStatus === 'critical' ? 'Setup needed' : infrastructureStatus === 'warning' ? 'Almost ready' : 'All good',
      ctaHref: input.canViewSettings ? '/dashboard/settings' : '/dashboard/teams',
      ctaLabel: input.canViewSettings ? 'Connect storage' : 'Request access',
    },
    {
      id: 'file-ops',
      label: 'Your Files',
      value: input.filesCount,
      description: 'Files stored',
      status: fileOpsStatus,
      statusLabel:
        fileOpsStatus === 'critical'
          ? 'Storage almost full'
          : fileOpsStatus === 'warning'
            ? (input.credentialsCount > 0 && !input.hasSelectedBucket ? 'Choose a bucket' : 'Getting full')
            : 'All good',
      ctaHref: input.canViewFiles ? '/dashboard/files' : '/dashboard/settings',
      ctaLabel: input.credentialsCount > 0 && !input.hasSelectedBucket ? 'Choose bucket' : (input.canViewFiles ? 'Browse files' : 'Open settings'),
    },
    {
      id: 'sharing',
      label: 'Shared Links',
      value: input.linksCount,
      description: 'Active share links',
      status: sharingStatus,
      statusLabel: sharingStatus === 'warning' ? 'Review recommended' : 'All good',
      ctaHref: input.canViewLinks ? '/dashboard/links' : '/dashboard/files',
      ctaLabel: input.canViewLinks ? 'View links' : 'Browse files',
    },
    {
      id: 'access',
      label: 'Team',
      value: input.teamsCount,
      description: 'Team members',
      status: accessStatus,
      statusLabel: accessStatus === 'warning' ? (input.teamsCount === 1 ? 'Invite team members' : 'Add another admin') : 'All good',
      ctaHref: input.canViewTeams ? '/dashboard/teams' : '/dashboard/profile',
      ctaLabel: input.canViewTeams ? 'Manage team' : 'Open profile',
    },
  ]
}
