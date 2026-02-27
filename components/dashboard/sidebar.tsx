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
  X,
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
  isMobile: boolean
  onToggle: () => void
  onClose: () => void
}

export function Sidebar({
  email,
  isAdmin,
  isOwner,
  teams,
  currentTeamId,
  isOpen,
  isMobile,
  onToggle,
  onClose,
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

  const handleNavClick = useCallback(() => {
    if (isMobile) onClose()
  }, [isMobile, onClose])

  // On mobile: sidebar is either visible (overlay) or hidden
  // On desktop: sidebar is always visible, either expanded (w-64) or collapsed (w-20)
  const sidebarVisible = isMobile ? isOpen : true
  const sidebarExpanded = isMobile ? true : isOpen // on mobile, always show labels when open

  if (!sidebarVisible) return null

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 bg-slate-900 flex flex-col z-50 transition-all duration-300 ease-in-out',
          sidebarExpanded ? 'w-64' : 'w-20',
        )}
      >
        {/* Header */}
        <div className="relative px-4 py-5 bg-gradient-to-br from-indigo-600/20 to-violet-600/10 border-b border-white/10">
          {sidebarExpanded ? (
            <div>
              <div className="flex items-center justify-between">
                <Link href="/dashboard" className="flex items-center gap-2.5" onClick={handleNavClick} aria-label="Go to dashboard">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <span className="text-white font-bold text-xs">S3</span>
                  </div>
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    S3 Portal
                  </h1>
                </Link>
                {/* Close / Collapse button */}
                {isMobile ? (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                ) : (
                  <button
                    onClick={onToggle}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-400" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 truncate" title={email}>
                {email}
              </p>
            </div>
          ) : (
              <div className="flex flex-col items-center gap-3">
                <Link href="/dashboard" onClick={handleNavClick} aria-label="Go to dashboard">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <span className="text-white font-bold text-xs">S3</span>
                  </div>
                </Link>
                {!isMobile && (
                  <button
                    onClick={onToggle}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Team Switcher */}
        {sidebarExpanded && teams.length > 0 && (
          <div className="px-3 py-3 border-b border-white/10">
            <TeamSwitcher
              teams={teams}
              currentTeamId={currentTeamId || ''}
              onTeamChange={switchTeam}
            />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-200 group',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                  sidebarExpanded ? 'px-3 py-2.5' : 'justify-center py-3 px-0'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={!sidebarExpanded ? label : undefined}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                  )}
                  aria-hidden="true"
                />
                {sidebarExpanded && <span className="text-sm font-medium">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/10">
          <ProfileActions isCollapsed={!sidebarExpanded} />
        </div>
      </aside>
    </>
  )
}
