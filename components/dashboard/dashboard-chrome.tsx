'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { HeaderProfileMenu } from './header-profile-menu'
import { GlobalSearch } from '@/components/dashboard/global-search'
import { AiSearchPalette } from '@/components/dashboard/ai-search-palette'
import { cn } from '@/lib/utils'
import { useDashboard, useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { TeamRemovedModal } from '@/components/dashboard/TeamRemovedModal'
import { RBACProvider } from '@/components/rbac-provider'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal'
import { ShortcutsModalContext } from '@/lib/contexts/shortcuts-modal-context'
import type { GlobalSearchHandle } from '@/components/dashboard/global-search'


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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const searchRef = useRef<GlobalSearchHandle>(null)

  useGlobalShortcuts({
    onOpenSearch: () => searchRef.current?.focus(),
    onOpenShortcuts: () => setIsShortcutsOpen(true),
  })
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
          <ShortcutsModalContext.Provider value={{ isShortcutsOpen }}>
          <KeyboardShortcutsModal open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
          <AiSearchPalette />
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
                  <GlobalSearch ref={searchRef} onFocusChange={(focused: boolean) => {
                    setIsSearchActive(focused)
                    if (focused && isMobile) {
                      setSidebarOpen(false)
                    }
                  }} />
                </div>
                <div className={cn(
                  "flex items-center",
                  "transition-all duration-500 ease-out origin-right",
                  isSearchActive ? "opacity-0 w-0 overflow-hidden scale-95" : "opacity-100 scale-100"
                )}>
                  <HeaderProfileMenu name={name} email={email} roleTitle={roleTitle} />
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
          </ShortcutsModalContext.Provider>
        </RBACProvider>
      )}
    </div>
  )
}
