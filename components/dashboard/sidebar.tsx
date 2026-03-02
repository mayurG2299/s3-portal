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
  storageUsedBytes?: number
  storageLimitBytes?: number
  isOpen: boolean
  isMobile: boolean
  onToggle: () => void
  onClose: () => void
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function Sidebar({
  email,
  isAdmin,
  isOwner,
  teams,
  currentTeamId,
  storageUsedBytes = 0,
  storageLimitBytes = 1099511627776, // default 1TB
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

  // On mobile: always render for transitions, but translate off-screen when closed
  const sidebarExpanded = isMobile ? true : isOpen


  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 bg-slate-950 flex flex-col z-50 border-r border-white/5 transition-all duration-500 ease-in-out',
          sidebarExpanded ? 'w-64' : 'w-20',
          isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'
        )}
      >
        {/* Header */}
        <div className="relative px-4 py-8 md:px-6">
          {sidebarExpanded ? (
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2 group" onClick={handleNavClick}>
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-[#8c2bee] to-[#6a1bbf] rounded-2xl flex items-center justify-center shadow-lg shadow-[#8c2bee]/20 group-hover:scale-110 transition-transform duration-500">
                  <span className="text-white font-black text-sm tracking-tighter">S3</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h1 className="text-sm font-black text-white uppercase tracking-[0.2em] leading-none truncate block">
                    Admin
                  </h1>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate block">Console</span>
                </div>
              </Link>
            </div>
          ) : (
              <div className="flex justify-center">
                <Link href="/dashboard" onClick={handleNavClick}>
                  <div className="w-10 h-10 bg-gradient-to-br from-[#8c2bee] to-[#6a1bbf] rounded-2xl flex items-center justify-center shadow-lg shadow-[#8c2bee]/20">
                    <span className="text-white font-black text-sm tracking-tighter">S3</span>
                  </div>
                </Link>
            </div>
          )}
        </div>

        {/* Team Switcher */}
        {sidebarExpanded && teams.length > 0 && (
          <div className="px-4 pb-6 px-6">
            <div className="p-1 rounded-2xl bg-white/[0.03] border border-white/5">
              <TeamSwitcher
                teams={teams}
                currentTeamId={currentTeamId || ''}
                onTeamChange={switchTeam}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2 py-4" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-2xl transition-all duration-300 group relative overflow-hidden',
                  isActive
                    ? 'bg-white/[0.05] text-white shadow-xl'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.02]',
                  sidebarExpanded ? 'px-4 py-3' : 'justify-center py-4 px-0'
                )}
                aria-label={label}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#8c2bee] rounded-full shadow-[0_0_15px_rgba(140,43,238,1)]" />
                )}

                <Icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-all duration-500',
                    isActive ? 'text-[#8c2bee] scale-110' : 'text-slate-600 group-hover:text-slate-400'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {sidebarExpanded && <span className="text-xs font-black uppercase tracking-widest">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Storage Metrics - New Section */}
        {sidebarExpanded && (
          <div className="px-6 py-8 border-t border-white/5 bg-gradient-to-t from-slate-900/40 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Main Usage Plan</span>
              <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                {Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-3 p-[1px]">
              <div
                className="h-full bg-gradient-to-r from-[#8c2bee] via-[#b673ff] to-[#8c2bee] transition-all duration-1000 shadow-[0_0_15px_rgba(140,43,238,0.4)] rounded-full animate-pulse-slow"
                style={{ width: `${Math.min(100, Math.max(0, (storageUsedBytes / storageLimitBytes) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-white uppercase tracking-tighter">{formatBytes(storageUsedBytes)}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{formatBytes(storageLimitBytes)} Limit</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-6 border-t border-white/5">
          <ProfileActions isCollapsed={!sidebarExpanded} />
        </div>
      </aside>
    </>
  )
}
