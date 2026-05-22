"use client"

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

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
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} type="button" className={className}>
          {icon ? <span className="mr-2 flex items-center" aria-hidden>{icon}</span> : null}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to end this session? You will need to sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" onClick={handleConfirm}>
              {label}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
