'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { cn } from '@/lib/utils'

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
}

export function DashboardChrome({ name, email, roleTitle, storageUsedBytes, storageLimitBytes, isAdmin, isOwner, teams, currentTeamId, children }: DashboardChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()

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
        currentTeamId={currentTeamId}
        storageUsedBytes={storageUsedBytes}
        storageLimitBytes={storageLimitBytes}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onToggle={handleToggle}
        onClose={handleClose}
      />

      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden relative transition-[margin] duration-500 ease-in-out",
          isMobile ? "ml-0" : (sidebarOpen ? "ml-64" : "ml-20")
        )}
      >
        {/* Top Navigation Bar */}
        <header className="h-16 flex-shrink-0 glass-navbar flex items-center justify-between px-6 lg:px-8">
          <div className="flex-1 flex items-center min-w-0 pr-4">
            <button
              onClick={handleToggle}
              className="md:hidden mr-3 p-2 shrink-0 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all focus:outline-none"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            {/* Title / Subtitle for mobile view */}
            <div className="md:hidden flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="text-sm font-black text-white truncate leading-tight tracking-tight">
                {(() => {
                  if (pathname.includes('/settings')) return <><span className="text-slate-300">Platform</span> <span className="text-[#b673ff]">Configuration</span></>
                  if (pathname.includes('/files')) return <><span className="text-slate-300">File</span> <span className="text-[#b673ff]">Explorer</span></>
                  if (pathname.includes('/teams')) return <><span className="text-slate-300">Team</span> <span className="text-[#b673ff]">Workspace</span></>
                  if (pathname.includes('/links')) return <><span className="text-slate-300">Shared</span> <span className="text-[#b673ff]">Links</span></>
                  if (pathname.includes('/admin/permissions')) return <><span className="text-slate-300">Access</span> <span className="text-[#b673ff]">Permissions</span></>
                  if (pathname.includes('/admin/audit')) return <><span className="text-slate-300">Audit</span> <span className="text-[#b673ff]">Logs</span></>
                  return <><span className="text-slate-300">System</span> <span className="text-[#b673ff]">Overview</span></>
                })()}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {(() => {
                  if (pathname.includes('/settings')) return 'Manage cloud endpoints'
                  if (pathname.includes('/files')) return 'Explore objects'
                  if (pathname.includes('/teams')) return 'Team collaboration'
                  if (pathname.includes('/links')) return 'Externally shared items'
                  if (pathname.includes('/admin/permissions')) return 'Role and access logic'
                  if (pathname.includes('/admin/audit')) return 'Monitor platform activity'
                  return 'Infrastructure telemetry'
                })()}
              </p>
            </div>

            <div className="max-w-md w-full relative group hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#8c2bee] transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search buckets, files, metadata..."
                className="block w-full pl-10 pr-3 py-2 bg-white/[0.03] border border-white/5 rounded-2xl text-xs font-medium text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#8c2bee]/50 focus:border-[#8c2bee]/50 focus:bg-white/[0.05] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="h-8 w-px bg-white/5 hidden sm:block" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-white uppercase tracking-tighter">{name}</p>
                <p className="text-[8px] font-bold text-[#8c2bee] uppercase tracking-widest">{roleTitle}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#8c2bee] to-[#6a1bbf] p-[1px]">
                <div className="h-full w-full rounded-[10px] bg-slate-900 flex items-center justify-center text-[10px] font-black text-white">
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
  )
}
