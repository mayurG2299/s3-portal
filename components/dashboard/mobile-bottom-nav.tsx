'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, FolderOpen, Link as LinkIcon, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileBottomNavProps {
  pendingInviteCount?: number
}

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/files', icon: FolderOpen, label: 'Files' },
  { href: '/dashboard/links', icon: LinkIcon, label: 'Links' },
  { href: '/dashboard/teams', icon: Users, label: 'Teams' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export function MobileBottomNav({ pendingInviteCount = 0 }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/5 safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] relative',
                isActive
                  ? 'text-brand'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Icon
                size={20}
                className={cn(
                  'transition-all duration-200',
                  isActive && 'scale-110'
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                isActive && 'font-black'
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
