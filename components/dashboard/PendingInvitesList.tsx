'use client'

import { useDashboard } from '@/lib/contexts/dashboard-context'
import { Button } from '@/components/ui/button'
import { Mail, XCircle } from 'lucide-react'

export function PendingInvitesList({ teamId }: { teamId: string }) {
  const { invitations, rejectInvitation, refreshInvitations } = useDashboard()
  const pending = invitations.filter(invite => invite.team.id === teamId)

  if (pending.length === 0) return null

  return (
    <div className="glass-card !p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '120ms' }}>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Mail size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-bold text-foreground tracking-tight">Pending Invites</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Invites awaiting acceptance</p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {pending.map(invite => (
          <div key={invite.id} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
            <div>
              <div className="font-bold text-foreground">{invite.email}</div>
              <div className="text-xs text-muted-foreground">Role: {invite.role.name}</div>
              <div className="text-xs text-muted-foreground">Invited by: {invite.invitedBy.name || invite.invitedBy.email}</div>
              <div className="text-xs text-muted-foreground">Sent: {new Date(invite.createdAt).toLocaleDateString()}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Cancel invite"
              onClick={async () => { await rejectInvitation(invite.id); await refreshInvitations(); }}
              className="text-destructive hover:bg-destructive/10"
            >
              <XCircle size={18} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
