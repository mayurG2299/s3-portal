import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import React from 'react'

interface TeamRemovedModalProps {
  open: boolean
  onRefresh: () => void
}

export function TeamRemovedModal({ open, onRefresh }: TeamRemovedModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle>You have been removed from this team by the owner.</DialogTitle>
          <DialogDescription>
            Your workspace context was reset to keep data consistent. Click OK to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center mt-4">
          <Button onClick={onRefresh} autoFocus>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
