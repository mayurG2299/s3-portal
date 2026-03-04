import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FolderOpen, HardDrive, Users, Link as LinkIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/dashboard/sign-out-button'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await requireUser()

  // Fetch user stats
  const [bucketsCount, filesCount, linksCount, teamsCount] =
    await Promise.all([
      prisma.awsBucket.count({
        where: { 
          credential: {
            teamId: session.user.teamId || null,
          }
        },
      }),
      prisma.file.count({
        where: { teamId: session.user.teamId || null },
      }),
      prisma.link.count({
        where: { file: { teamId: session.user.teamId || null } },
      }),
      prisma.teamMember.count({
        where: { userId: session.user.id },
      }),
    ])

  // Aggregate File Sizes (in Bytes) by Month for the Current Year
  const currentYear = new Date().getFullYear()
  const currentTeamId = session.user.teamId // If we want team-scoped chart. Currently files are userId scoped in the stats above, let's keep consistency with userId for personal dashboard.

  const allFiles = await prisma.file.findMany({
    where: { teamId: session.user.teamId || null },
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
  const maxGB = Math.max(...monthlyDataGB, 1) // prevent divide by zero
  const getDynamicHeight = (gb: number) => {
    // scale max chart height to ~160px
    const percentage = gb / maxGB
    return Math.max(minBarHeight, Math.floor(percentage * 160))
  }
  const minBarHeight = 10

  const recentFiles = await prisma.file.findMany({
    where: { teamId: session.user.teamId || null },
    take: 5,
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
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tight mb-2">
              Welcome back, <span className="gradient-text">{session.user.name || 'Admin'}</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Manage your global S3 infrastructure with ease.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/settings">
              <Button className="rounded-xl h-12 bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10 transition-all font-bold text-sm px-6">
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
          { label: 'Data Ingress', val: filesCount, icon: FolderOpen, color: 'emerald', desc: 'Stored Objects' },
          { label: 'Public Endpoints', val: linksCount, icon: LinkIcon, color: 'violet', desc: 'Secure Links' },
          { label: 'Personnel Access', val: teamsCount, icon: Users, color: 'amber', desc: 'Active Roles' }
        ].map((stat, i) => (
          <div key={i} className="glass-card group animate-slide-up relative overflow-hidden" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon size={80} strokeWidth={1} className="text-[#8c2bee]/50 dark:text-white" />
            </div>

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg",
                stat.color === 'indigo' && "bg-[#8c2bee]/20 text-[#8c2bee] dark:text-white shadow-[#8c2bee]/20",
                stat.color === 'emerald' && "bg-emerald-500/20 text-emerald-600 dark:text-white shadow-emerald-500/20",
                stat.color === 'violet' && "bg-violet-500/20 text-violet-600 dark:text-white shadow-violet-500/20",
                stat.color === 'amber' && "bg-amber-500/20 text-amber-600 dark:text-white shadow-amber-500/20",
              )}>
                <stat.icon size={22} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white transition-colors">{stat.desc}</span>
            </div>

            <div className="relative z-10">
              <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-1 leading-none drop-shadow-sm">{stat.val}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-700 dark:group-hover:text-slate-300">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8 animate-slide-up" style={{ animationDelay: '400ms' }}>
          {/* Storage Overview Chart Mock */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-10">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#8c2bee] shadow-[0_0_10px_rgba(140,43,238,0.8)]" />
                Storage Overview
              </h4>
              <div className="flex gap-2">
                <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 text-[8px] font-black dark:text-slate-400 uppercase tracking-widest">Monthly</div>
                <div className="px-3 py-1 rounded-full bg-[#8c2bee]/10 border border-[#8c2bee]/20 text-[8px] font-black text-[#8c2bee] uppercase tracking-widest">Yearly</div>
              </div>
            </div>

            <div className="h-64 w-full flex items-end justify-between gap-2 sm:gap-4 px-2 overflow-x-auto no-scrollbar pb-1">
              {monthlyDataGB.map((gb, i) => (
                <div key={i} className="flex-1 min-w-[28px] sm:min-w-0 flex flex-col items-center gap-3 group">
                  <div className="w-full relative">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-[#8c2bee]/20 to-[#8c2bee] group-hover:from-[#8c2bee]/40 group-hover:to-[#b673ff] transition-all duration-500 relative"
                      style={{ height: `${getDynamicHeight(gb)}px` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 dark:bg-white/10 backdrop-blur-md border border-slate-700 dark:border-white/20 rounded-lg px-2 py-1 text-[8px] font-bold text-white whitespace-nowrap">
                        {gb > 0 ? gb.toFixed(2) : 0}GB
                      </div>
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                    {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                Quick Operations
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { href: '/dashboard/settings', label: 'AWS Node Configuration', icon: HardDrive, color: 'indigo' },
                { href: '/dashboard/files', label: 'Resource Explorer', icon: FolderOpen, color: 'emerald' },
                { href: '/dashboard/teams', label: 'Personnel Access', icon: Users, color: 'amber' },
                { href: '/dashboard/links', label: 'Public Endpoints', icon: LinkIcon, color: 'violet' }
              ].map((item, i) => (
                <Link key={i} href={item.href}>
                  <div className="group flex items-center gap-4 p-5 rounded-3xl bg-slate-50 border border-slate-200 hover:border-[#8c2bee]/30 hover:bg-slate-100 dark:bg-white/[0.02] dark:border-white/5 dark:hover:border-[#8c2bee]/30 dark:hover:bg-white/[0.05] transition-all duration-500">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6",
                      item.color === 'indigo' && "bg-[#8c2bee]/10 text-[#8c2bee]",
                      item.color === 'emerald' && "bg-emerald-500/10 text-emerald-400",
                      item.color === 'amber' && "bg-amber-500/10 text-amber-400",
                      item.color === 'violet' && "bg-violet-500/10 text-violet-400",
                    )}>
                      <item.icon size={20} strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-black text-slate-400 group-hover:text-white transition-colors uppercase tracking-widest">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '500ms' }}>
          <div className="glass-card h-full">
            <div className="flex items-center justify-between mb-10">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                Transmission Feed
              </h4>
              <Link href="/dashboard/files" className="text-[10px] font-black text-[#8c2bee] hover:text-[#b673ff] transition-colors uppercase tracking-[0.2em]">Live Stream</Link>
            </div>

            {recentFiles.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50 dark:bg-white/[0.01] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2rem]">
                <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <FolderOpen className="h-10 w-10 text-slate-400 dark:text-slate-800" />
                </div>
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">
                  Queue Empty
                </p>
              </div>
            ) : (
                <div className="space-y-4">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group flex flex-col p-5 rounded-3xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 dark:bg-white/[0.02] dark:border-white/5 dark:hover:border-white/10 dark:hover:bg-white/[0.04] transition-all duration-500 overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] animate-ping" />
                      </div>

                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[140px] tracking-tight">
                          {file.name}
                        </p>
                        <span className="text-[8px] font-black p-1 px-2 rounded-lg bg-emerald-500/10 text-emerald-400 uppercase tracking-widest border border-emerald-500/10">Synchronized</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                        {file.bucket.bucket} <span className="mx-2 text-slate-700">|</span> <span className="text-slate-600">{file.bucket.credential.name}</span>
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
