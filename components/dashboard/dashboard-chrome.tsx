'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const [isOpen, setIsOpen] = useState(true)

  // Default to collapsed on small screens, expanded on md+
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const updateState = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsOpen(!e.matches)
    }

    updateState(mq)
    mq.addEventListener('change', updateState)
    return () => mq.removeEventListener('change', updateState)
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        email={email}
        isAdmin={isAdmin}
        isOwner={isOwner}
        teams={teams}
        currentTeamId={currentTeamId}
        isOpen={isOpen}
        onToggle={handleToggle}
        onClose={handleClose}
      />

      <main
        className={cn(
          'min-h-screen overflow-y-auto transition-all duration-300 ease-in-out',
          isOpen ? 'md:ml-64' : 'md:ml-20',
          'pt-4 md:pt-6 px-4 md:px-8'
        )}
      >
        {children}
      </main>
    </div>
  )
}
