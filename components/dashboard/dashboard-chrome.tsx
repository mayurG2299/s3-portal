'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { GlobalSearch } from '@/components/dashboard/global-search'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { RBACProvider } from '@/components/rbac-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Database, Shield, Users } from 'lucide-react'

interface Team {
  id: string
  name: string
  slug: string
}

interface DashboardChromeProps {
  name: string
  email: string
  roleTitle: string
  storageUsedBytes: number
  storageLimitBytes: number
  isAdmin: boolean
  isOwner: boolean
  teams: Team[]
  currentTeamId?: string
  children: React.ReactNode
  pendingInviteCount?: number
}

export function DashboardChrome({ name, email, roleTitle, storageUsedBytes, storageLimitBytes, isAdmin, isOwner, teams, currentTeamId, children, pendingInviteCount = 0 }: DashboardChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const {
    selectedIdentityId,
    selectedBucketId,
    identities,
    isLoading,
    setIdentity,
    setBucket,
    selectedTeamId,
    setTeam
  } = useDashboard()

  const activeIdentity = identities.find(id => id.id === selectedIdentityId)
  const availableBuckets = activeIdentity?.buckets || []

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches
      if (mobile) {
        setIsMobile(true)
        setSidebarOpen(false)
      } else {
        setIsMobile(false)
        setSidebarOpen(true)
      }
    }
    update(mq)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Robustly close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [pathname, isMobile])

  const handleToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      <Sidebar
        email={email}
        isAdmin={isAdmin}
        isOwner={isOwner}
        teams={teams}
        currentTeamId={selectedTeamId || currentTeamId}
        storageUsedBytes={storageUsedBytes}
        storageLimitBytes={storageLimitBytes}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onToggle={handleToggle}
        onClose={handleClose}
        pendingInviteCount={pendingInviteCount}
      />

      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden relative transition-[margin] duration-500 ease-in-out",
          isMobile ? "ml-0" : (sidebarOpen ? "ml-64" : "ml-20")
        )}
      >
        {/* Top Navigation Bar */}
        <header className="h-16 flex-shrink-0 glass-navbar flex items-center justify-between px-4 lg:px-8 gap-4">
          <div className="flex-1 flex items-center min-w-0 gap-3">
            <button
              onClick={handleToggle}
              className="md:hidden p-2 shrink-0 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all focus:outline-none"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            {/* Context Selectors (AWS Credentials & Storage Bucket) - Desktop Only in Header */}
            {!isMobile && (
              <div className="flex items-center gap-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <Select value={selectedIdentityId || 'all'} onValueChange={(val) => setIdentity(val === 'all' ? null : val)}>
                    <SelectTrigger className={cn(
                      "w-[180px] h-9 bg-white/5 border-white/10 text-xs font-semibold rounded-xl focus:ring-purple-500/20",
                      isLoading && "animate-pulse opacity-50 pointer-events-none"
                    )}>
                      <div className="flex items-center gap-2 truncate">
                        <Shield size={14} className="text-purple-400 shrink-0" />
                        <SelectValue placeholder={isLoading ? "..." : "AWS Credentials"} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900/95 border-white/10 backdrop-blur-xl">
                      <SelectItem value="all" className="text-xs">All Identities</SelectItem>
                      {identities.map((id) => (
                        <SelectItem key={id.id} value={id.id} className="text-xs">
                          {id.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={selectedBucketId || 'all'}
                    onValueChange={(val) => setBucket(val === 'all' ? null : val)}
                    disabled={!selectedIdentityId}
                  >
                    <SelectTrigger className={cn(
                      "w-[200px] h-9 bg-white/5 border-white/10 text-xs font-semibold rounded-xl focus:ring-purple-500/20",
                      isLoading && "animate-pulse opacity-50 pointer-events-none"
                    )}>
                      <div className="flex items-center gap-2 truncate">
                        <Database size={14} className="text-blue-400 shrink-0" />
                        <SelectValue placeholder={isLoading ? "..." : "Storage Bucket"} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900/95 border-white/10 backdrop-blur-xl">
                      <SelectItem value="all" className="text-xs">All Buckets</SelectItem>
                      {availableBuckets.map((bucket) => (
                        <SelectItem key={bucket.id} value={bucket.id} className="text-xs">
                          {bucket.bucket}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <GlobalSearch onFocusChange={(focused: boolean) => {
              if (focused && isMobile) {
                setSidebarOpen(false)
              }
            }} />
          </div>

          <div className="flex items-center gap-3">
            {/* Team Selector - Global Header */}
            {!isMobile && (
              <Select value={selectedTeamId || currentTeamId} onValueChange={setTeam}>
                <SelectTrigger className={cn(
                  "w-[160px] h-9 bg-purple-500/10 border-purple-500/20 text-xs font-bold text-purple-400 rounded-xl focus:ring-purple-500/20",
                  isLoading && "animate-pulse opacity-50 pointer-events-none"
                )}>
                  <div className="flex items-center gap-2 truncate">
                    <Users size={14} className="shrink-0" />
                    <SelectValue placeholder={isLoading ? "..." : "Select Team"} />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 border-white/10 backdrop-blur-xl">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-semibold">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <ThemeToggle />

            <div className="h-8 w-px bg-slate-200 dark:bg-white/5 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate max-w-[80px]">{name}</p>
                <p className="text-[8px] font-bold text-[#8c2bee] uppercase tracking-widest">{roleTitle}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#8c2bee] to-[#6a1bbf] p-[1px] shrink-0">
                <div className="h-full w-full rounded-[10px] bg-white dark:bg-slate-900 flex items-center justify-center text-[10px] font-black text-[#8c2bee] dark:text-white">
                  {name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            'flex-1 overflow-y-auto no-scrollbar transition-all duration-300 ease-in-out',
            'p-6 lg:p-8'
          )}
        >
          <RBACProvider>
            {children}
          </RBACProvider>
        </main>
      </div>
    </div>
  )
}
