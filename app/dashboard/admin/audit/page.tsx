import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'
import { Clock, User, Activity, Shield, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function AuditLogPage() {
  const session = await requireUser('admin/audit')
  const cookieStore = await cookies()
  const selectedTeamId = cookieStore.get('selectedTeamId')?.value?.trim()
  const teamId = selectedTeamId || session.user.teamId

  if (!teamId) {
    redirect('/dashboard')
  }

  const role = await getUserRoleInTeam(session.user.id, teamId)
  if (!isOwner(role || undefined)) {
    redirect('/dashboard')
  }

  type AuditLogRow = Prisma.AccessLogGetPayload<{
    include: { user: { select: { email: true } } }
  }> & {
    resourceType?: string | null
    resourceId?: string | null
  }

  const logs = (await prisma.accessLog.findMany({
    where: { teamId } as Prisma.AccessLogWhereInput,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { email: true } },
    },
  })) as AuditLogRow[]

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
        <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
          Security <span className="gradient-text">Audit Logs</span>
        </h2>
        <p className="text-muted-foreground font-medium">
          Comprehensive timeline of user activities and system events.
        </p>
      </div>

      <div className="glass-card !p-0 overflow-hidden animate-slide-up shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Initiator</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Action</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Resource</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Outcome</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground max-w-[200px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log, idx) => (
                <tr
                  key={log.id}
                  className="group hover:bg-muted/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${idx * 15}ms` }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground font-mono tracking-tighter">
                        {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                        {log.user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-xs font-bold text-foreground tracking-tight">
                        {log.user?.email || 'System'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-[10px] font-black uppercase tracking-widest text-primary">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <Activity size={12} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground/80 truncate max-w-[150px]">
                        {log.resourceType ? `${log.resourceType}:${log.resourceId ?? 'N/A'}` : 'Global'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="inline-flex items-center">
                      {log.success ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]">
                          <CheckCircle2 size={12} strokeWidth={3} />
                          <span className="text-[9px] font-black tracking-[0.1em]">PASS</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.1)]">
                          <XCircle size={12} strokeWidth={3} />
                          <span className="text-[9px] font-black tracking-[0.1em]">FAIL</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px] italic font-medium">
                      {log.errorMessage || 'Operational success.'}
                    </p>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="px-6 py-12 text-center" colSpan={6}>
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <Shield size={32} strokeWidth={1} className="text-muted-foreground mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Zero audit signatures found.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
