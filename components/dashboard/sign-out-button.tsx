"use client"

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type SignOutButtonProps = {
  label?: string
  icon?: ReactNode
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
}

export function SignOutButton({
  label = 'Sign out',
  icon,
  variant = 'outline',
  size = 'default',
  className,
}: SignOutButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleConfirm = async () => {
    setOpen(false)

    const result = await signOut({ redirect: false, callbackUrl: '/login' })

    if (result?.url) {
      router.push(result.url)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} type="button" className={className}>
          {icon ? <span className="mr-2 flex items-center" aria-hidden>{icon}</span> : null}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign out</DialogTitle>
          <DialogDescription>
            Are you sure you want to end this session? You will need to sign in again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
