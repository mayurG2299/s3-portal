'use client'

import { useMemo, useState } from 'react'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { CheckCircle, XCircle, Users, Clock, Shield, Mail, Crown, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'

interface Invite {
  id: string
  email: string
  expiresAt: string
  createdAt: string
  team: { id: string; name: string; slug: string }
  role: { id: string; name: string; description: string | null }
  invitedBy: { name: string | null; email: string }
}

function RoleIcon({ name, level }: { name: string; level?: number }) {
  if (name === 'OWNER') return <Crown size={14} className="text-amber-500" />
  if (name === 'ADMIN') return <Shield size={14} className="text-primary" />
  return <Eye size={14} className="text-muted-foreground" />
}

export default function InvitationsPage() {
  const { invitations, acceptInvitation, rejectInvitation, isLoading } = useDashboard()
  const invites = useMemo(() => invitations as Invite[], [invitations])
  const [processing, setProcessing] = useState<string | null>(null)

  async function handleAction(inviteId: string, action: 'accept' | 'decline') {
    setProcessing(inviteId)
    try {
      if (action === 'accept') {
        const result = await acceptInvitation(inviteId)
        toast({
          title: '🎉 Welcome aboard!',
          description: `You've joined ${result.teamName}. Switch to it from the team selector!`,
        })
      } else {
        await rejectInvitation(inviteId)
        toast({
          title: 'Invite declined',
          description: 'The invitation has been declined.',
        })
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process invite'
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      })
    } finally {
      setProcessing(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Mail size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Team <span className="text-gradient">Invitations</span>
            </h1>
            <p className="text-sm text-muted-foreground">Accept or decline pending workspace invitations</p>
          </div>
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center mb-6">
            <Mail size={36} className="text-muted-foreground/80" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-black text-foreground tracking-tight mb-1">No Pending Invitations</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            You&apos;re all caught up! When someone invites you to their workspace, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invites.map((invite, idx) => (
            <div
              key={invite.id}
              className="glass-card !p-0 overflow-hidden animate-slide-up hover:border-primary/50 transition-all duration-300"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                {/* Left side info */}
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg flex-shrink-0 shadow-lg shadow-primary/20">
                    {invite.team.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-foreground tracking-tight">
                        {invite.team.name}
                      </h3>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary">
                        <RoleIcon name={invite.role.name} />
                        {invite.role.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Invited by <span className="font-bold text-foreground/80">{invite.invitedBy.name || invite.invitedBy.email}</span>
                    </p>
                    {invite.role.description && (
                      <p className="text-[11px] italic text-muted-foreground/80">{invite.role.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                      <Clock size={10} />
                    <span>Expires {formatRelativeTime(new Date(invite.expiresAt))}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(invite.id, 'decline')}
                    disabled={processing === invite.id}
                    className="h-9 px-4 rounded-xl text-xs font-bold border-rose-500/30 text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/50 dark:border-rose-500/20 transition-all"
                  >
                    {processing === invite.id ? (
                      <div className="h-3.5 w-3.5 border-2 border-rose-400/40 border-t-rose-400 rounded-full animate-spin" />
                    ) : (
                      <><XCircle size={14} className="mr-1.5" /> Decline</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(invite.id, 'accept')}
                    disabled={processing === invite.id}
                    className="h-9 px-5 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 transition-all"
                  >
                    {processing === invite.id ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle size={14} className="mr-1.5" /> Accept</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
