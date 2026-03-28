import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FolderOpen, HardDrive, Users, Link as LinkIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/dashboard/sign-out-button'
import { StorageOverviewChart } from '@/components/dashboard/storage-overview-chart'
import { FirstTimeWizard } from '@/components/onboarding/FirstTimeWizard'
import { cn } from '@/lib/utils'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const session = await requireUser()
  const cookieStore = await cookies()

  // Use team from cookie if available, fallback to session
  const activeTeamId = cookieStore.get('selectedTeamId')?.value || session.user.teamId || null
  const identityId = cookieStore.get('selectedIdentityId')?.value || undefined
  const bucketId = cookieStore.get('selectedBucketId')?.value || undefined

  // Fetch user stats scoped by context
  const [bucketsCount, credentialsCount, filesCount, linksCount, teamsCount] =
    await Promise.all([
      prisma.awsBucket.count({
        where: { 
          credential: {
            id: identityId,
            teamId: activeTeamId || null,
          }
        },
      }),
      prisma.aWSCredential.count({
        where: {
          id: identityId,
          teamId: activeTeamId || null,
        },
      }),
      prisma.file.count({
        where: {
          teamId: activeTeamId || null,
          credentialId: identityId,
          bucketId: bucketId
        },
      }),
      prisma.link.count({
        where: {
          file: {
            teamId: activeTeamId || null,
            credentialId: identityId,
            bucketId: bucketId
          }
        },
      }),
      prisma.teamMember.count({
        where: { teamId: activeTeamId || undefined },
      }),
    ])

  // If user has no teams, show a special UI state
  if (!activeTeamId || teamsCount === 0) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="w-24 h-24 mb-8 flex items-center justify-center rounded-3xl bg-muted border-2 border-dashed border-border">
          <Users className="w-12 h-12 text-muted-foreground" />
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

  // Aggregate File Sizes (in Bytes) by Month for the Current Year
  const currentYear = new Date().getFullYear()

  const allFiles = await prisma.file.findMany({
    where: {
      teamId: activeTeamId || null,
      credentialId: identityId,
      bucketId: bucketId
    },
    select: { size: true, createdAt: true }
  })

  // Initialize array of 12 months with 0 bytes
  const monthlyDataBytes = Array(12).fill(0)

  allFiles.forEach(file => {
    const d = new Date(file.createdAt)
    if (d.getFullYear() === currentYear) {
      monthlyDataBytes[d.getMonth()] += Number(file.size)
    }
  })

  // Convert bytes to GB for the UI, compute a local max for CSS height scaling
  const monthlyDataGB = monthlyDataBytes.map(bytes => bytes / (1024 * 1024 * 1024))

  // Aggregate File Sizes by Year for the last 5 years
  const yearlyDataGB = Array(5).fill(0).map((_, i) => ({ year: currentYear - 4 + i, gb: 0 }))
  allFiles.forEach(file => {
    const d = new Date(file.createdAt)
    const yearDiff = currentYear - d.getFullYear()
    if (yearDiff >= 0 && yearDiff < 5) {
      yearlyDataGB[4 - yearDiff].gb += Number(file.size) / (1024 * 1024 * 1024)
    }
  })

  const recentFiles = await prisma.file.findMany({
    where: {
      teamId: activeTeamId || null,
      credentialId: identityId,
      bucketId: bucketId
    },
    take: 2,
    orderBy: { createdAt: 'desc' },
    include: {
      bucket: {
        select: {
          bucket: true,
          credential: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-10 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="hidden md:block">
            <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
              Welcome back, <span className="gradient-text">{session.user.name || 'Admin'}</span>
            </h2>
            <p className="text-muted-foreground font-medium">
              Manage your S3 storage, upload files, and share with your team.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { href: '/dashboard/teams', label: 'Team Access', icon: Users, color: 'amber' },
              { href: '/dashboard/links', label: 'Shared Links', icon: LinkIcon, color: 'violet' }
            ].map((item, i) => (
              <Link key={i} href={item.href}>
                <Button variant="outline" className="rounded-xl h-12 bg-card text-foreground border-border hover:border-primary/30 hover:bg-accent/5 transition-all font-bold text-sm px-4 gap-2">
                  <item.icon size={16} className={cn(
                    item.color === 'amber' && "text-amber-500",
                    item.color === 'violet' && "text-violet-500",
                  )} />
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
            <Link href="/dashboard/settings">
              <Button className="rounded-xl h-12 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all font-bold text-sm px-6">
                Configure AWS
              </Button>
            </Link>
            <Link href="/dashboard/files">
              <Button className="rounded-xl h-12 btn-primary-gradient font-bold text-sm px-6 gap-2">
                Browse Files
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Cloud Infrastructure', val: bucketsCount, icon: HardDrive, color: 'indigo', desc: 'Active Buckets' },
          { label: 'Upload Activity', val: filesCount, icon: FolderOpen, color: 'emerald', desc: 'Total Files' },
          { label: 'Shared Links', val: linksCount, icon: LinkIcon, color: 'violet', desc: 'Secure Links' },
          { label: 'Personnel Access', val: teamsCount, icon: Users, color: 'amber', desc: 'Active Roles' }
        ].map((stat, i) => (
          <div key={i} className="glass-card group animate-slide-up relative overflow-hidden" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon size={80} strokeWidth={1} className="text-brand/50 dark:text-white" />
            </div>

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg",
                stat.color === 'indigo' && "bg-brand/20 text-brand dark:text-white shadow-brand/20",
                stat.color === 'emerald' && "bg-emerald-500/20 text-emerald-600 dark:text-white shadow-emerald-500/20",
                stat.color === 'violet' && "bg-violet-500/20 text-violet-600 dark:text-white shadow-violet-500/20",
                stat.color === 'amber' && "bg-amber-500/20 text-amber-600 dark:text-white shadow-amber-500/20",
              )}>
                <stat.icon size={22} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">{stat.desc}</span>
            </div>

            <div className="relative z-10">
              <h3 className="text-5xl font-black text-foreground tracking-tighter mb-1 leading-none drop-shadow-sm">{stat.val}</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground/80">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-full flex flex-col animate-slide-up" style={{ animationDelay: '400ms' }}>
          <StorageOverviewChart monthlyDataGB={monthlyDataGB} yearlyDataGB={yearlyDataGB} />
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '500ms' }}>
          <div className="glass-card h-full">
            <div className="flex items-center justify-between mb-10">
              <h4 className="text-sm font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                Transmission Feed
              </h4>
              <Link href="/dashboard/files" className="text-[10px] font-black text-brand hover:text-brand-light transition-colors uppercase tracking-[0.2em]">Live Stream</Link>
            </div>

            {recentFiles.length === 0 ? (
              <div className="text-center py-16 px-4 bg-card/50 border-2 border-dashed border-border rounded-[2rem]">
                <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <FolderOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Queue Empty
                </p>
              </div>
            ) : (
                <div className="space-y-4">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group flex flex-col p-5 rounded-3xl bg-card border border-border hover:border-accent hover:bg-accent/5 transition-all duration-500 overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                      </div>

                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-black text-foreground truncate max-w-[140px] tracking-tight">
                          {file.name}
                        </p>
                        <span className="text-[8px] font-black p-1 px-2 rounded-lg bg-emerald-500/10 text-emerald-400 uppercase tracking-widest border border-emerald-500/10">Synchronized</span>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate">
                        {file.bucket.bucket} <span className="mx-2 opacity-50">|</span> <span>{file.bucket.credential.name}</span>
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* First-time user onboarding wizard */}
      <FirstTimeWizard currentCredentialsCount={credentialsCount} />
    </div>
  )
}
