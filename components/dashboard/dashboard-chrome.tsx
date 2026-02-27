'use client'

import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { cn } from '@/lib/utils'

interface Team {
  id: string
  name: string
  slug: string
}

interface DashboardChromeProps {
  email: string
  isAdmin: boolean
  isOwner: boolean
  teams: Team[]
  currentTeamId?: string
  children: React.ReactNode
}

export function DashboardChrome({ email, isAdmin, isOwner, teams, currentTeamId, children }: DashboardChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches
      setIsMobile(mobile)
      setSidebarOpen(!mobile) // open on desktop, closed on mobile
    }
    update(mq)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const handleToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <Sidebar
        email={email}
        isAdmin={isAdmin}
        isOwner={isOwner}
        teams={teams}
        currentTeamId={currentTeamId}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onToggle={handleToggle}
        onClose={handleClose}
      />

      {/* Mobile hamburger — only on mobile */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={handleToggle}
          className="fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-lg shadow-slate-200/50 hover:bg-white transition-all duration-200"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>
      )}

      <main
        className={cn(
          'min-h-screen transition-all duration-300 ease-in-out',
          // Desktop: margin for sidebar
          !isMobile && sidebarOpen && 'md:ml-64',
          !isMobile && !sidebarOpen && 'md:ml-20',
          // Mobile: no margin, add top padding for hamburger
          isMobile ? 'pt-16 px-4' : 'pt-6 px-6 lg:px-8'
        )}
      >
        {children}
      </main>
    </div>
  )
}
