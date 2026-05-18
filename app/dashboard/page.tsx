import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccessibleBucketIds } from '@/lib/bucket-access'
import { userCanViewScreen, canManageTeam } from '@/lib/permissions'
import { SCREENS } from '@/lib/screen-permissions'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { FolderOpen, HardDrives, UsersThree, LinkSimple, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionCenter } from '@/components/dashboard/action-center'
import { FirstTimeWizard } from '@/components/onboarding/FirstTimeWizard'
import { cn } from '@/lib/utils'
import { cookies } from 'next/headers'
import { resolveActiveTeamId } from '@/lib/active-team'
import { buildDashboardActions } from '@/lib/dashboard-action-center'
import { buildDashboardHealthCards } from '@/lib/dashboard-health-cards'

const getDashboardStats = unstable_cache(
  async (
    teamId: string,
    identityId: string | undefined,
    allowedBucketIds: string[] | null,
    specificBucketId: string | undefined
  ) => {
    const bucketFilter =
      allowedBucketIds !== null
        ? { in: allowedBucketIds }
        : specificBucketId
          ? specificBucketId
          : undefined

    const [bucketsCount, credentialsCount, filesCount, linksCount, teamsCount, quota, usage, riskyLinksCount] =
      await Promise.all([
        prisma.awsBucket.count({
          where: {
            ...(allowedBucketIds !== null ? { id: { in: allowedBucketIds } } : {}),
            credential: { id: identityId, teamId },
          },
        }),
        prisma.aWSCredential.count({ where: { id: identityId, teamId } }),
        prisma.file.count({ where: { teamId, credentialId: identityId, bucketId: bucketFilter } }),
        prisma.link.count({
          where: { file: { teamId, credentialId: identityId, bucketId: bucketFilter } },
        }),
        prisma.teamMember.count({ where: { teamId } }),
        prisma.storageQuota.findUnique({ where: { teamId }, select: { limitBytes: true } }),
        prisma.file.aggregate({
          where: { teamId, credentialId: identityId, bucketId: bucketFilter },
          _sum: { size: true },
        }),
        prisma.link.count({
          where: {
            file: { teamId, credentialId: identityId, bucketId: bucketFilter },
            OR: [{ expiresAt: null }, { passwordHash: null }],
          },
        }),
      ])

    return {
      bucketsCount,
      credentialsCount,
      filesCount,
      linksCount,
      teamsCount,
      quotaLimitBytes: quota?.limitBytes != null ? Number(quota.limitBytes) : null,
      usedBytes: Number(usage._sum.size || 0),
      riskyLinksCount,
    }
  },
  ['dashboard-stats'],
  { revalidate: 30, tags: ['dashboard-stats'] }
)

export default async function DashboardPage() {
  const session = await requireUser()
  const cookieStore = await cookies()
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const activeTeamId = resolveActiveTeamId(
    teams,
    cookieStore.get('selectedTeamId')?.value,
    session.user.teamId,
  )
  const identityId = cookieStore.get('selectedIdentityId')?.value || undefined
  const bucketId = cookieStore.get('selectedBucketId')?.value || undefined

  // Resolve bucket-level access for restricted members
  const allowedBucketIds = activeTeamId
    ? await getAccessibleBucketIds(session.user.id, activeTeamId)
    : null // null = unrestricted (no team context, personal scope)

  const stats = activeTeamId
    ? await getDashboardStats(activeTeamId, identityId, allowedBucketIds, bucketId)
    : null

  // If user has no teams, show a special UI state
  if (!activeTeamId || !stats || stats.teamsCount === 0) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="w-24 h-24 mb-8 flex items-center justify-center rounded-3xl bg-muted border-2 border-dashed border-border">
          <UsersThree className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2 text-center">No Teams Found</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          You are not a member of any team, or your last team was removed. To get started, join a team or create a new one.
        </p>
        <div className="flex gap-4">
          <Link href="/dashboard/teams/new">
            <Button className="btn-primary-gradient font-bold px-6 py-3 rounded-xl">Create Team</Button>
          </Link>
          <Link href="/dashboard/teams">
            <Button variant="outline" className="font-bold px-6 py-3 rounded-xl">Join Team</Button>
          </Link>
        </div>
      </div>
    )
  }

  const [canViewFiles, canViewLinks, canViewTeams, canViewSettings] = await Promise.all([
    userCanViewScreen(session.user.id, activeTeamId, SCREENS.FILES_LIST),
    userCanViewScreen(session.user.id, activeTeamId, SCREENS.LINKS_LIST),
    canManageTeam(session.user.id, activeTeamId),
    userCanViewScreen(session.user.id, activeTeamId, SCREENS.CREDENTIALS_LIST),
  ])

  const { bucketsCount, credentialsCount, filesCount, linksCount, teamsCount, quotaLimitBytes, usedBytes, riskyLinksCount } = stats

  const defaultLimitBytes = 1099511627776
  const storageLimitBytes = quotaLimitBytes ?? defaultLimitBytes
  const usagePercent = storageLimitBytes > 0 ? (usedBytes / storageLimitBytes) * 100 : 0

  const actions = buildDashboardActions({
    credentialsCount,
    linksCount,
    riskyLinksCount,
    usagePercent,
    hasSelectedBucket: Boolean(bucketId),
    canViewSettings,
    canViewFiles,
    canViewLinks,
  })

  const healthCards = buildDashboardHealthCards({
    bucketsCount,
    credentialsCount,
    filesCount,
    linksCount,
    riskyLinksCount,
    teamsCount,
    usagePercent,
    hasSelectedBucket: Boolean(bucketId),
    canViewSettings,
    canViewFiles,
    canViewLinks,
    canViewTeams,
  })

  const heroPrimaryAction = canViewFiles
    ? { href: '/dashboard/files', label: 'Browse Files' }
    : canViewSettings
      ? { href: '/dashboard/settings', label: 'Connect Storage' }
      : canViewTeams
        ? { href: '/dashboard/teams', label: 'Manage Team' }
        : canViewLinks
          ? { href: '/dashboard/links', label: 'View Links' }
          : null

  const hasActionCenterAlerts = actions.some((action) => action.id !== 'healthy')

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <LayoutDashboard size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              My <span className="text-gradient">Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground">Your storage workspace overview.</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {healthCards.map((stat, i) => {
          const Icon =
            stat.id === 'infrastructure'
              ? HardDrives
              : stat.id === 'file-ops'
                ? FolderOpen
                : stat.id === 'sharing'
                  ? LinkSimple
                  : UsersThree

          const color =
            stat.id === 'infrastructure'
              ? 'indigo'
              : stat.id === 'file-ops'
                ? 'emerald'
                : stat.id === 'sharing'
                  ? 'violet'
                  : 'amber'

          return (
          <div key={i} className={cn(
            "glass-card group animate-slide-up border-l-4 flex flex-col",
            stat.status === 'critical' && 'border-l-destructive',
            stat.status === 'warning' && 'border-l-amber-400',
            stat.status === 'ready' && 'border-l-emerald-400',
          )} style={{ animationDelay: `${i * 100}ms` }}>
            <div className="mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
                color === 'indigo' && "bg-brand/15 text-brand dark:text-white",
                color === 'emerald' && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                color === 'violet' && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                color === 'amber' && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}>
                <Icon size={20} weight="bold" />
              </div>
            </div>

            <h3 className="text-4xl font-black text-foreground tracking-tighter leading-none mb-1">{stat.value}</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-xs text-muted-foreground/70 mb-3">{stat.description}</p>

            {stat.status !== 'ready' && (
              <p className={cn(
                'text-xs font-medium mb-3',
                stat.status === 'critical' && 'text-destructive',
                stat.status === 'warning' && 'text-amber-500',
              )}>
                {stat.statusLabel}
              </p>
            )}

            <div className="mt-auto pt-4 border-t border-border/50">
              <Link href={stat.ctaHref} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {stat.ctaLabel}
                <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          </div>
          )
        })}
      </div>

      {hasActionCenterAlerts && (
        <div className="animate-slide-up" style={{ animationDelay: '400ms' }}>
          <ActionCenter actions={actions} />
        </div>
      )}

      {/* First-time user onboarding wizard */}
      {canViewSettings && <FirstTimeWizard currentCredentialsCount={credentialsCount} />}
    </div>
  )
}
