'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { RoleManagement } from './role-management'

type Props = {
  teamId: string
}

export function PermissionManagement({ teamId }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Page header with Engineer Role button */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="hidden md:block">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
            Access <span className="gradient-text">Permissions</span>
          </h1>
          <p className="text-muted-foreground font-medium">
            Control team synergy through precise role and screen access management.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="btn-primary-gradient h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0"
        >
          <Plus size={14} strokeWidth={3} />
          Engineer Role
        </Button>
      </div>

      <div className="glass-card !p-0 overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-border bg-muted">
          <h2 className="text-lg font-black text-foreground tracking-tight">Access Control Hierarchies</h2>
          <p className="text-sm text-muted-foreground font-medium">Engineer specialized roles with granular permission protocols.</p>
        </div>
        <div className="p-2 sm:p-6">
          <RoleManagement teamId={teamId} open={open} onOpenChange={setOpen} />
        </div>
      </div>
    </div>
  )
}
