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
      <div className="flex items-center justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Plus size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Access <span className="text-gradient">Permissions</span>
            </h1>
            <p className="text-sm text-muted-foreground">Control team synergy through precise role and screen access management.</p>
          </div>
        </div>
        <div className="hidden md:block">
          <Button
            onClick={() => setOpen(true)}
            className="btn-primary-gradient h-9 px-5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Plus size={14} strokeWidth={3} />
            Engineer Role
          </Button>
        </div>
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
