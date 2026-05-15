'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { GlobalSearch } from '@/components/dashboard/global-search'
import { cn } from '@/lib/utils'
import { useDashboard, useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { TeamRemovedModal } from '@/components/dashboard/TeamRemovedModal'
import { RBACProvider } from '@/components/rbac-provider'


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
  initialTeams: Team[]
  currentTeamId?: string
  children: React.ReactNode
  pendingInviteCount?: number
}

export function DashboardChrome({ name, email, roleTitle, storageUsedBytes, storageLimitBytes, initialTeams, currentTeamId, children, pendingInviteCount = 0 }: DashboardChromeProps) {
  // initialTeams is available if needed for fallback or initialization
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const {
    selectedTeamId,
    teams
  } = useDashboard()
  const { teamRemoved, setTeamRemoved } = useTeamRemoved()
  const handleRefresh = () => {
    setTeamRemoved(false)
    router.refresh()
  }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches
      if (mobile) {
        setIsMobile(true)
        setSidebarOpen(false)
      } else {
        setIsMobile(false)
        setSidebarOpen(false)
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
    <div className="min-h-screen bg-background text-foreground">
      {teamRemoved ? (
        <div className="flex items-center justify-center min-h-screen">
          <TeamRemovedModal open={true} onRefresh={handleRefresh} />
        </div>
      ) : (
        <RBACProvider>
          <div className="flex overflow-hidden min-h-screen">
            <Sidebar
              email={email}
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
                <div className="flex-1 flex items-center min-w-0">
                  <GlobalSearch onFocusChange={(focused: boolean) => {
                    setIsSearchActive(focused)
                    if (focused && isMobile) {
                      setSidebarOpen(false)
                    }
                  }} />
                </div>
                <div className={cn(
                  "flex items-center gap-3",
                  "transition-all duration-500 ease-out origin-right",
                  isSearchActive ? "opacity-0 w-0 overflow-hidden scale-95" : "opacity-100 scale-100"
                )}>
                  <ThemeToggle />
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate max-w-[80px]">{name}</p>
                      <p className="text-[8px] font-bold text-brand uppercase tracking-widest">{roleTitle}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark p-[1px] shrink-0">
                      <div className="h-full w-full rounded-[10px] bg-card flex items-center justify-center text-[10px] font-black text-brand">
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
                {children}
              </main>
            </div>
          </div>
        </RBACProvider>
      )}
    </div>
  )
}
