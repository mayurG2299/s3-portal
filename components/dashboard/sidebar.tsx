'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FolderOpen,
  Users,
  Link as LinkIcon,
  Settings,
  Shield,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { switchTeam } from '@/app/actions/teams'
import { ProfileActions } from './profile-actions'
import { TeamSwitcher } from './team-switcher'
import { cn } from '@/lib/utils'

interface Team {
  id: string
  name: string
  slug: string
}

interface SidebarProps {
  email: string
  isAdmin: boolean
  isOwner: boolean
  teams: Team[]
  currentTeamId?: string
  isOpen: boolean
  onToggle: () => void
  onClose?: () => void
}

export function Sidebar({ 
  email, 
  isAdmin, 
  isOwner, 
  teams, 
  currentTeamId,
  isOpen, 
  onToggle, 
  onClose 
}: SidebarProps) {
  const pathname = usePathname()

  const navItems = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: Home },
      { href: '/dashboard/files', label: 'Files', icon: FolderOpen },
      { href: '/dashboard/links', label: 'Shared Links', icon: LinkIcon },
      { href: '/dashboard/teams', label: 'Teams', icon: Users },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ...(isAdmin
        ? [{ href: '/dashboard/admin/permissions', label: 'Permissions', icon: Shield }]
        : []),
      ...(isOwner
        ? [{ href: '/dashboard/admin/audit', label: 'Audit Logs', icon: ClipboardList }]
        : []),
    ],
    [isAdmin, isOwner]
  )

  const handleMobileNavClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose?.()
    }
  }, [onClose])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose ?? onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-50',
          isOpen ? 'w-64' : 'w-20',
          'shadow-sm'
        )}
      >
        {/* Header */}
        <div className="relative px-4 py-4 border-b border-gray-200">
          <Link href="/dashboard" className="block" aria-label="Go to dashboard">
            {isOpen ? (
              <div>
                <h1 className="text-base font-semibold text-gray-900 tracking-tight">
                  S3 Portal
                </h1>
                <p className="text-xs text-gray-500 mt-1 truncate" title={email}>
                  {email}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center" aria-label="S3 Portal">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">S3</span>
                </div>
              </div>
            )}
          </Link>

          {/* Toggle Button */}
          <button
            onClick={onToggle}
            className={cn(
              'absolute top-5 p-1.5 rounded-full bg-white border-2 border-gray-200',
              'hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm',
              isOpen ? '-right-4' : '-right-3'
            )}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-blue-600" />
            )}
          </button>
        </div>

        {/* Team Switcher */}
        {isOpen && teams.length > 0 && (
          <div className="px-3 py-3 border-b border-gray-200">
            <TeamSwitcher 
              teams={teams} 
              currentTeamId={currentTeamId || ''} 
              onTeamChange={switchTeam}
            />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-6 space-y-3" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                onClick={handleMobileNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-lg transition-all duration-200 group',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100',
                  isOpen ? 'px-3 py-3' : 'justify-center py-3.5 px-0'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={!isOpen ? label : undefined}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-900'
                  )}
                  aria-hidden="true"
                />
                {isOpen && <span className="text-sm font-medium">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-200">
          <ProfileActions isCollapsed={!isOpen} />
        </div>
      </aside>

      {/* Main content spacing */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          isOpen ? 'md:ml-64' : 'md:ml-20'
        )}
      />
    </>
  )
}
