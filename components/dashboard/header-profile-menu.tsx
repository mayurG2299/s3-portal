'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import {
  LogOut,
  Loader2,
  Trash2,
  User,
  Database,
  Sun,
  Moon,
  HelpCircle,
  Keyboard,
  ChevronDown,
} from 'lucide-react'

type Member = {
  id: string
  email: string
  name: string | null
}

interface HeaderProfileMenuProps {
  name: string
  email: string
  roleTitle: string
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  href,
  destructive,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  href?: string
  destructive?: boolean
}) {
  const cls = cn(
    'flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer outline-none select-none',
    destructive
      ? 'text-red-400 hover:bg-red-500/10 data-[highlighted]:bg-red-500/10'
      : 'text-slate-300 hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]'
  )
  if (href) {
    return (
      <DropdownMenu.Item asChild>
        <Link href={href} className={cls} onClick={onClick}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      </DropdownMenu.Item>
    )
  }
  return (
    <DropdownMenu.Item className={cls} onSelect={onClick}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </DropdownMenu.Item>
  )
}

function Separator() {
  return <DropdownMenu.Separator className="my-1 border-t border-white/[0.06]" />
}

export function HeaderProfileMenu({ name, email, roleTitle }: HeaderProfileMenuProps) {
  const { selectedTeamId } = useDashboard()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [ownedTeamCount, setOwnedTeamCount] = useState(0)
  const [transferToUserId, setTransferToUserId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    const html = document.documentElement
    html.classList.toggle('dark')
    setIsDark(html.classList.contains('dark'))
  }

  useEffect(() => {
    const url = selectedTeamId
      ? `/api/account/members?teamId=${encodeURIComponent(selectedTeamId)}`
      : '/api/account/members'
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || [])
        setIsOwner(Boolean(data.isOwner))
        setOwnedTeamCount(Number(data.ownedTeamCount || 0))
      })
      .catch(() => {
        setMembers([])
        setIsOwner(false)
        setOwnedTeamCount(0)
      })
  }, [selectedTeamId])

  const canDelete = useMemo(() => {
    if (ownedTeamCount > 1) return false
    if (!isOwner) return true
    if (members.length === 0) return false
    return Boolean(transferToUserId)
  }, [isOwner, transferToUserId, members.length, ownedTeamCount])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferToUserId: transferToUserId || undefined }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }
      await signOut({ callbackUrl: '/login' })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete account' })
    } finally {
      setIsDeleting(false)
    }
  }

  const openKeyboardShortcuts = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true }))
  }

  const initials = name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase()

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border hover:bg-accent transition-colors duration-200 outline-none"
            aria-label="Profile menu"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[80px]">{name}</p>
              <p className="text-[8px] font-bold text-brand uppercase tracking-widest">{roleTitle}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {initials}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-[200] min-w-[220px] bg-slate-900 border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-bold text-slate-200 truncate">{name}</p>
              {email && <p className="text-[10px] text-slate-500 truncate">{email}</p>}
            </div>
            <Separator />

            <MenuItem icon={User} label="Account" href="/dashboard/account" />
            <MenuItem icon={Database} label="AI & Indexing" href="/dashboard/settings?tab=ai" />

            <Separator />

            <DropdownMenu.Item
              className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer outline-none select-none text-slate-300 hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]"
              onSelect={toggleTheme}
            >
              {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </DropdownMenu.Item>

            <Separator />

            <MenuItem icon={Keyboard} label="Keyboard shortcuts" onClick={openKeyboardShortcuts} />
            <MenuItem icon={HelpCircle} label="Help" href="https://docs.s3portal.io" />

            <Separator />

            <MenuItem
              icon={Trash2}
              label="Delete account"
              onClick={() => setDeleteOpen(true)}
              destructive
            />
            <MenuItem
              icon={LogOut}
              label="Sign out"
              onClick={() => signOut({ callbackUrl: '/login' })}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This will soft delete your account. You can contact support to restore it.
            </DialogDescription>
          </DialogHeader>
          {isOwner && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                You are the owner. Transfer ownership before deleting your account.
              </p>
              {ownedTeamCount > 1 && (
                <p className="text-sm text-red-600">
                  You own multiple teams. Transfer or delete those teams before deleting your account.
                </p>
              )}
              {members.length === 0 && (
                <p className="text-sm text-red-600">
                  No other team members available to transfer ownership.
                </p>
              )}
              <Select value={transferToUserId} onValueChange={setTransferToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a new owner" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              type="button"
              disabled={!canDelete || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
