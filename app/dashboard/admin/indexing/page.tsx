'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRBAC } from '@/components/rbac-provider'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
  Loader2,
  Database,
  BarChart3,
} from 'lucide-react'

interface IndexingStats {
  total: number
  indexed: number
  pending: number
  failed: number
  unindexed: number
  percentComplete: number
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  subtitle?: string
}

function StatCard({ label, value, icon: Icon, color, bgColor, borderColor, subtitle }: StatCardProps) {
  return (
    <div className={cn('glass-card flex flex-col gap-3 border', borderColor)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center border', bgColor, borderColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
      <div>
        <p className={cn('text-3xl font-black tracking-tight', color)}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function IndexingDashboardPage() {
  const router = useRouter()
  const { isAdmin } = useRBAC()
  const { selectedTeamId } = useDashboard()
  const [stats, setStats] = useState<IndexingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [togglingPause, setTogglingPause] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // RBAC guard — redirect non-admin
  useEffect(() => {
    if (isAdmin === false) {
      router.replace('/dashboard')
    }
  }, [isAdmin, router])

  const fetchStats = useCallback(async () => {
    try {
      const url = new URL('/api/admin/indexing/status', window.location.origin)
      if (selectedTeamId) url.searchParams.set('teamId', selectedTeamId)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStats(data)
    } catch {
      // silently fail on polling errors
    } finally {
      setLoading(false)
    }
  }, [selectedTeamId])

  useEffect(() => {
    fetchStats()
    pollRef.current = setInterval(fetchStats, 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStats])

  const togglePause = useCallback(async () => {
    setTogglingPause(true)
    try {
      const endpoint = paused ? '/api/admin/indexing/resume' : '/api/admin/indexing/pause'
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      setPaused(!paused)
      toast({ title: paused ? 'Pipeline resumed' : 'Pipeline paused' })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to toggle pipeline state' })
    } finally {
      setTogglingPause(false)
    }
  }, [paused])

  const retryAll = useCallback(async () => {
    if (!confirm('Retry all failed files? This will re-queue them for indexing.')) return
    setRetrying(true)
    try {
      const res = await fetch('/api/admin/indexing/retry-failed', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      toast({ title: 'Retry queued', description: `${data.requeued} file(s) re-queued for indexing.` })
      await fetchStats()
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to retry failed files' })
    } finally {
      setRetrying(false)
    }
  }, [fetchStats])

  if (!isAdmin) return null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
            <Activity size={24} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Indexing Pipeline</h2>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Monitor and control the AI indexing queue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pipeline status badge */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold',
            paused
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-green-500/10 border-green-500/20 text-green-400'
          )}>
            <span className={cn('h-2 w-2 rounded-full', paused ? 'bg-amber-400' : 'bg-green-400 animate-pulse')} />
            {paused ? 'Paused' : 'Live'}
          </div>

          <button
            onClick={togglePause}
            disabled={togglingPause}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all',
              paused
                ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
            )}
          >
            {togglingPause
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />
            }
            {paused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-card/80 transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading stats…
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Indexed"
              value={stats.indexed}
              icon={CheckCircle}
              color="text-green-400"
              bgColor="bg-green-500/10"
              borderColor="border-green-500/20"
              subtitle={`${stats.percentComplete}% complete`}
            />
            <StatCard
              label="In Queue"
              value={stats.pending}
              icon={Clock}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
              borderColor="border-blue-500/20"
              subtitle="Pending + processing"
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              icon={XCircle}
              color="text-red-400"
              bgColor="bg-red-500/10"
              borderColor="border-red-500/20"
              subtitle={stats.failed > 0 ? 'Click retry to re-queue' : 'No errors'}
            />
            <StatCard
              label="Not Indexed"
              value={stats.unindexed}
              icon={Database}
              color="text-slate-400"
              bgColor="bg-slate-500/10"
              borderColor="border-slate-500/20"
              subtitle="No embedding yet"
            />
          </div>

          {/* Progress bar */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand" />
                <span className="text-sm font-bold text-foreground">Overall progress</span>
              </div>
              <span className="text-sm font-black text-brand">{stats.percentComplete}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand via-brand-light to-brand rounded-full transition-all duration-700 shadow-[0_0_15px_hsl(var(--brand)/0.4)]"
                style={{ width: `${stats.percentComplete}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              <span>{stats.indexed} indexed</span>
              <span>{stats.total} total</span>
            </div>
          </div>

          {/* Retry failed */}
          {stats.failed > 0 && (
            <div className="glass-card border border-red-500/20 bg-red-500/[0.03]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{stats.failed} file{stats.failed !== 1 ? 's' : ''} failed to index</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      These files encountered errors during processing. You can retry all at once or retry individual files from the Explorer.
                    </p>
                  </div>
                </div>
                <button
                  onClick={retryAll}
                  disabled={retrying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                >
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Retry all
                </button>
              </div>
            </div>
          )}

          {/* Stub: per-file table */}
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">File index status table</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-widest">Coming soon</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-6">
              <AlertCircle className="h-4 w-4 shrink-0 opacity-50" />
              Per-file status table requires <code className="font-mono bg-muted px-1 rounded text-xs">GET /api/admin/indexing/files</code> endpoint (planned for next iteration).
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
          <AlertCircle className="h-5 w-5" />
          Failed to load indexing stats. Check your connection and try again.
        </div>
      )}
    </div>
  )
}
