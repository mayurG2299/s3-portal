'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FolderOpen,
  Users,
  Users as UsersIcon,
  Link as LinkIcon,
  Settings,
  Shield,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  X,
  Mail
} from 'lucide-react'
import { ProfileActions } from './profile-actions'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { useRBAC } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Team {
  id: string
  name: string
  slug: string
}

interface SidebarProps {
  email: string
  teams: Team[]
  currentTeamId?: string
  storageUsedBytes?: number
  storageLimitBytes?: number
  isOpen: boolean
  isMobile: boolean
  onToggle: () => void
  onClose: () => void
  pendingInviteCount?: number
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
  teams,
  currentTeamId,
  storageUsedBytes = 0,
  storageLimitBytes = 1099511627776,
  isOpen,
  isMobile,
  onToggle,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const {
    selectedTeamId,
    isLoading,
    setTeam,
    pendingInviteCount
  } = useDashboard()
  const { canViewScreen, isAdmin } = useRBAC()

  const mainNavItems = useMemo(
    () => {
      const canViewFiles = canViewScreen(SCREENS.FILES_LIST)
      const canViewLinks = canViewScreen(SCREENS.LINKS_LIST)
      const canViewInvitations = canViewScreen(SCREENS.TEAM_INVITATIONS)

      return [
        { href: '/dashboard', label: 'Dashboard', icon: Home },
        ...(canViewFiles ? [{ href: '/dashboard/files', label: 'Files', icon: FolderOpen }] : []),
        ...(canViewLinks ? [{ href: '/dashboard/links', label: 'Shared Links', icon: LinkIcon }] : []),
        ...(canViewInvitations
          ? [{ href: '/dashboard/invitations', label: 'Invitations', icon: Mail, badge: pendingInviteCount }]
          : []),
      ]
    },
    [canViewScreen, pendingInviteCount]
  )

  const adminNavItems = useMemo(
    () => {
      const canViewTeams = isAdmin
      const canViewSettings =
        canViewScreen(SCREENS.CREDENTIALS_LIST) ||
        canViewScreen(SCREENS.TEAM_SETTINGS)
      const canViewPermissions = isAdmin
      const canViewAuditLogs = canViewScreen(SCREENS.ADMIN_AUDIT_LOG)

      return [
        ...(canViewTeams ? [{ href: '/dashboard/teams', label: 'Teams', icon: Users }] : []),
        ...(canViewSettings ? [{ href: '/dashboard/settings', label: 'Settings', icon: Settings }] : []),
        ...(canViewPermissions
          ? [{ href: '/dashboard/admin/permissions', label: 'Permissions', icon: Shield }]
          : []),
        ...(canViewAuditLogs
          ? [{ href: '/dashboard/admin/audit', label: 'Audit Logs', icon: ClipboardList }]
          : []),
      ]
    },
    [canViewScreen, isAdmin]
  )

  const handleNavClick = useCallback(() => {
    onClose()
  }, [onClose])

  const handleLogoClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) {
      onClose()
      return
    }

    event.preventDefault()
    onToggle()
  }, [isMobile, onClose, onToggle])

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
          'fixed inset-y-0 left-0 bg-white dark:bg-slate-950 flex flex-col z-[100] border-r border-slate-200 dark:border-white/5 transition-all duration-500 ease-in-out',
          sidebarExpanded ? 'w-64' : 'w-20',
          isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'
        )}
      >
        {/* Header */}
        <div className="relative px-4 py-6 md:px-6 md:py-8">
          {sidebarExpanded ? (
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2 group" onClick={handleLogoClick}>
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-brand to-brand-dark rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform duration-500">
                  <span className="text-white font-black text-sm tracking-tighter">S3</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] leading-none truncate block">
                    Admin
                  </h1>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate block">Console</span>
                </div>
              </Link>
            </div>
          ) : (
              <div className="flex justify-center">
                <Link href="/dashboard" onClick={handleLogoClick}>
                  <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-dark rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
                    <span className="text-white font-black text-sm tracking-tighter">S3</span>
                  </div>
                </Link>
            </div>
          )}
        </div>

        {/* Team Selector - compact and always right below the logo when expanded */}
        {sidebarExpanded && (
          <div className="px-4 pb-5">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Team</p>
              <Select value={selectedTeamId || currentTeamId || undefined} onValueChange={setTeam}>
                <SelectTrigger className={cn(
                  'w-full h-10 bg-purple-500/10 border-purple-500/20 text-xs font-bold text-purple-400 rounded-xl focus:ring-purple-500/20',
                  isLoading && 'animate-pulse opacity-50 pointer-events-none'
                )}>
                  <div className="flex items-center gap-2 truncate">
                    <UsersIcon size={14} className="shrink-0" />
                    <SelectValue placeholder={isLoading ? 'Loading...' : 'Select Team'} />
                  </div>
                </SelectTrigger>
                <SelectContent className="!bg-slate-950 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,1)] z-[110] rounded-2xl w-[var(--radix-select-trigger-width)]" position="popper">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm font-semibold py-3 transition-colors hover:bg-white/5 data-[highlighted]:bg-white/5">
                      <span className="whitespace-normal break-words leading-tight">{t.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2 py-4" aria-label="Main navigation">
          {mainNavItems.map(({ href, label, icon: Icon, badge }: any) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-2xl transition-all duration-300 group relative overflow-hidden',
                  isActive
                    ? 'bg-slate-100 text-brand shadow-xl dark:bg-white/[0.05] dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-slate-200 dark:hover:bg-white/[0.02]',
                  sidebarExpanded ? 'px-4 py-3' : 'justify-center py-4 px-0'
                )}
                aria-label={label}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-full shadow-[0_0_15px_hsl(var(--brand))]" />
                )}

                <div className="relative flex-shrink-0">
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-all duration-500',
                      isActive ? 'text-brand scale-110' : 'text-slate-600 group-hover:text-slate-400'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 border border-white dark:border-slate-950">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                {sidebarExpanded && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                    {badge > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 text-[9px] font-black border border-rose-500/20">
                        {badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}

          {adminNavItems.length > 0 && (
            <>
              <div className={cn(
                'pt-2 pb-1',
                sidebarExpanded ? 'px-1' : 'px-0'
              )}>
                <div className="border-t border-slate-200 dark:border-white/5" />
                {sidebarExpanded && (
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3 px-3">Admin</p>
                )}
              </div>
              {adminNavItems.map(({ href, label, icon: Icon }: any) => {
                const isActive = pathname === href

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl transition-all duration-300 group relative overflow-hidden',
                      isActive
                        ? 'bg-slate-100 text-brand shadow-xl dark:bg-white/[0.05] dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-slate-200 dark:hover:bg-white/[0.02]',
                      sidebarExpanded ? 'px-4 py-3' : 'justify-center py-4 px-0'
                    )}
                    aria-label={label}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-full shadow-[0_0_15px_hsl(var(--brand))]" />
                    )}
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-all duration-500',
                        isActive ? 'text-brand scale-110' : 'text-slate-600 group-hover:text-slate-400'
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {sidebarExpanded && (
                      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                    )}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Storage Metrics - New Section */}
        {sidebarExpanded && (
          <div className="px-6 py-8 border-t border-slate-200 dark:border-white/5 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-900/40 dark:to-transparent">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Main Usage Plan</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.05)] dark:shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                {Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden mb-3 p-[1px]">
              <div
                className="h-full bg-gradient-to-r from-brand via-brand-light to-brand transition-all duration-1000 shadow-[0_0_15px_hsl(var(--brand)/0.4)] rounded-full animate-pulse-slow"
                style={{ width: `${Math.min(100, Math.max(0, (storageUsedBytes / storageLimitBytes) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">{formatBytes(storageUsedBytes)}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{formatBytes(storageLimitBytes)} Limit</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-6 border-t border-slate-200 dark:border-white/5">
          <ProfileActions isCollapsed={!sidebarExpanded} />
        </div>
      </aside>
    </>
  )
}
