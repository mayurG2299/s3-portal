'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { LogOut, Trash2, User, KeyRound, ChevronDown } from 'lucide-react'

type Member = {
  id: string
  email: string
  name: string | null
}

type ProfileActionsProps = {
  isCollapsed?: boolean
}

export function ProfileActions({ isCollapsed = false }: ProfileActionsProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { selectedTeamId } = useDashboard()

  useEffect(() => {
    setOpen(false)
  }, [pathname])
  const [members, setMembers] = useState<Member[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [ownedTeamCount, setOwnedTeamCount] = useState(0)
  const [transferToUserId, setTransferToUserId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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
        body: JSON.stringify({
          transferToUserId: transferToUserId || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }

      await signOut({ callbackUrl: '/login' })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete account',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors duration-200',
          isCollapsed && 'justify-center'
        )}
        aria-expanded={open}
        title={isCollapsed ? 'Profile' : undefined}
      >
        <User className="h-4 w-4" />
        {!isCollapsed && (
          <>
            <span className="font-medium">Profile</span>
            <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', !open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <div className={cn('space-y-2', isCollapsed && 'items-center')}>
          <Link
            href="/dashboard/profile"
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors duration-200',
              isCollapsed && 'justify-center'
            )}
            title={isCollapsed ? 'Change Password' : undefined}
          >
            <KeyRound className="h-4 w-4" />
            {!isCollapsed && <span>Change Password</span>}
          </Link>

          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-200',
                  isCollapsed && 'justify-center'
                )}
                title={isCollapsed ? 'Delete Account' : undefined}
              >
                <Trash2 className="h-4 w-4" />
                {!isCollapsed && <span>Delete Account</span>}
              </button>
            </DialogTrigger>
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
                  {ownedTeamCount > 1 ? (
                    <p className="text-sm text-red-600">
                      You own multiple teams. Transfer or delete those teams before deleting your account.
                    </p>
                  ) : null}
                  {members.length === 0 ? (
                    <p className="text-sm text-red-600">
                      No other team members available to transfer ownership.
                    </p>
                  ) : null}
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
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={!canDelete || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? 'Deleting...' : 'Delete account'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors duration-200',
              isCollapsed && 'justify-center'
            )}
            title={isCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      )}
    </div>
  )
}
