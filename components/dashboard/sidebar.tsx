'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FolderOpen,
  Users,
  Users as UsersIcon,
  Link as LinkIcon,
  Shield,
  ClipboardList,
  Mail,
  Search,
  ChevronDown,
  Database,
  Star,
  Activity,
} from 'lucide-react'
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

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  isActive,
  isExpanded,
  onClick,
  onShowTooltip,
  onHideTooltip,
}: NavItem & {
  isActive: boolean
  isExpanded: boolean
  onClick: () => void
  onShowTooltip?: (label: string, y: number) => void
  onHideTooltip?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      onMouseEnter={!isExpanded && onShowTooltip
        ? (e) => onShowTooltip(label, e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2)
        : undefined}
      onMouseLeave={!isExpanded ? onHideTooltip : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl transition-all duration-300 group relative overflow-hidden',
        isActive
          ? 'bg-slate-100 text-brand shadow-xl dark:bg-white/[0.05] dark:text-white'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:hover:text-slate-200 dark:hover:bg-white/[0.02]',
        isExpanded ? 'px-4 py-3' : 'justify-center py-4 px-0'
      )}
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
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 border border-white dark:border-slate-950">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {isExpanded && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-xs font-black uppercase tracking-widest">{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 text-[9px] font-black border border-rose-500/20">
              {badge}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

function GroupHeader({
  label,
  isOpen,
  isExpanded,
  onToggle,
}: {
  label: string
  isOpen: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  if (!isExpanded) return null
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-1 mt-2 mb-0.5 group"
    >
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">
        {label}
      </span>
      <ChevronDown
        className={cn(
          'h-3 w-3 text-slate-500 transition-transform duration-200',
          isOpen ? 'rotate-0' : '-rotate-90'
        )}
      />
    </button>
  )
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
  pendingInviteCount,
}: SidebarProps) {
  const pathname = usePathname()
  const { selectedTeamId, isLoading, setTeam } = useDashboard()
  const { canViewScreen, isAdmin } = useRBAC()

  const storageKey = `sidebar-groups:${email}`

  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null)
  const showTooltip = useCallback((label: string, top: number) => setTooltip({ label, top }), [])
  const hideTooltip = useCallback(() => setTooltip(null), [])

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { files: true, workspace: true, admin: true }
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : { files: true, workspace: true, admin: true }
    } catch {
      return { files: true, workspace: true, admin: true }
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(groupOpen))
    } catch { /* ignore */ }
  }, [groupOpen, storageKey])

  const toggleGroup = useCallback((id: string) => {
    setGroupOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const filesGroup = useMemo<NavGroup>(() => {
    const canViewFiles = canViewScreen(SCREENS.FILES_LIST)
    const canViewLinks = canViewScreen(SCREENS.LINKS_LIST)
    const canViewInvitations = canViewScreen(SCREENS.TEAM_INVITATIONS)
    return {
      id: 'files',
      label: 'Files',
      items: [
        ...(canViewFiles ? [{ href: '/dashboard/files', label: 'Files', icon: FolderOpen }] : []),
        ...(canViewLinks ? [{ href: '/dashboard/links', label: 'Shared Links', icon: LinkIcon }] : []),
        ...(canViewInvitations
          ? [{ href: '/dashboard/invitations', label: 'Invitations', icon: Mail, badge: pendingInviteCount }]
          : []),
      ],
    }
  }, [canViewScreen, pendingInviteCount])

  const workspaceGroup = useMemo<NavGroup>(() => {
    return {
      id: 'workspace',
      label: 'Workspace',
      items: [],
    }
  }, [])

  const adminGroup = useMemo<NavGroup>(() => {
    const canViewTeams = isAdmin
    const canViewPermissions = isAdmin
    const canViewAuditLogs = canViewScreen(SCREENS.ADMIN_AUDIT_LOG)
    return {
      id: 'admin',
      label: 'Admin',
      items: [
        ...(canViewTeams ? [{ href: '/dashboard/teams', label: 'Teams', icon: Users }] : []),
        ...(canViewPermissions
          ? [{ href: '/dashboard/admin/permissions', label: 'Permissions', icon: Shield }]
          : []),
        ...(canViewAuditLogs
          ? [{ href: '/dashboard/admin/audit', label: 'Audit Logs', icon: ClipboardList }]
          : []),
        ...(isAdmin
          ? [{ href: '/dashboard/admin/indexing', label: 'Indexing Pipeline', icon: Activity }]
          : []),
      ],
    }
  }, [canViewScreen, isAdmin])

  const handleNavClick = useCallback(() => { onClose() }, [onClose])

  const handleLogoClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) { onClose(); return }
    event.preventDefault()
    onToggle()
  }, [isMobile, onClose, onToggle])

  const sidebarExpanded = isMobile ? true : isOpen

  const openSearchPalette = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    onClose()
  }, [onClose])

  function renderGroup(group: NavGroup) {
    if (group.items.length === 0) return null

    const isGroupOpen = groupOpen[group.id] !== false
    const showSingleFlat = !sidebarExpanded || (!isAdmin && group.id === 'workspace' && group.items.length === 1)

    return (
      <div key={group.id} className="mb-1">
        {sidebarExpanded && !showSingleFlat && (
          <GroupHeader
            label={group.label}
            isOpen={isGroupOpen}
            isExpanded={sidebarExpanded}
            onToggle={() => toggleGroup(group.id)}
          />
        )}
        {(isGroupOpen || !sidebarExpanded) && (
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                isExpanded={sidebarExpanded}
                onClick={handleNavClick}
                onShowTooltip={showTooltip}
                onHideTooltip={hideTooltip}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

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

        {/* Team Selector */}
        {sidebarExpanded && (
          <div className="px-4 pb-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Team</p>
              <Select value={selectedTeamId || currentTeamId || undefined} onValueChange={setTeam}>
                <SelectTrigger className={cn(
                  'w-full h-10 bg-purple-500/10 border-purple-500/20 text-xs font-bold text-purple-400 rounded-xl focus:ring-purple-500/20 focus-visible:ring-2 focus-visible:ring-purple-500/20 focus-visible:ring-offset-0',
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

        {/* AI Search bar */}
        <div className={cn('px-4 pb-3', !sidebarExpanded && 'flex justify-center')}>
          {sidebarExpanded ? (
            <button
              onClick={openSearchPalette}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-400 hover:border-brand/40 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200 group"
              aria-label="Open AI search"
            >
              <Search className="h-4 w-4 text-slate-400 group-hover:text-brand transition-colors shrink-0" />
              <span className="text-xs font-medium flex-1 text-left">AI Search…</span>
              <kbd className="text-[9px] font-bold bg-slate-200 dark:bg-white/10 text-slate-500 px-1.5 py-0.5 rounded-md shrink-0">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={openSearchPalette}
              onMouseEnter={(e) => showTooltip('AI Search ⌘K', e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2)}
              onMouseLeave={hideTooltip}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-400 hover:border-brand/40 hover:text-brand transition-all duration-200"
              aria-label="Open AI search (⌘K)"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-4 py-2" aria-label="Main navigation">
          {renderGroup(filesGroup)}

          {workspaceGroup.items.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-white/5 my-2" />
              {renderGroup(workspaceGroup)}
            </>
          )}

          {adminGroup.items.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-white/5 my-2" />
              {renderGroup(adminGroup)}
            </>
          )}
        </nav>

        {/* Storage Metrics */}
        {sidebarExpanded && (
          <div className="px-6 py-8 border-t border-slate-200 dark:border-white/5 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-900/40 dark:to-transparent">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Main Usage Plan</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
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

      </aside>

      {!sidebarExpanded && tooltip && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: 88, top: tooltip.top, transform: 'translateY(-50%)' }}
        >
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-xl">
            {tooltip.label}
          </div>
        </div>
      )}
    </>
  )
}
