'use client'

import { useCallback, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useRBAC } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'

interface Team {
  id: string
  name: string
  slug: string
}

interface TeamSwitcherProps {
  teams: Team[]
  currentTeamId: string
  onTeamChange: (teamId: string) => Promise<any>
}

export function TeamSwitcher({ teams, currentTeamId, onTeamChange }: TeamSwitcherProps) {
  const router = useRouter()
  const { update } = useSession()
  const [isPending, startTransition] = useTransition()
  const [optimisticTeamId, setOptimisticTeamId] = useOptimistic(currentTeamId)
  const { canViewScreen } = useRBAC()
  const canCreateTeam = canViewScreen(SCREENS.TEAM_SETTINGS)

  const handleTeamChange = useCallback(
    (teamId: string) => {
      setOptimisticTeamId(teamId)
      startTransition(async () => {
        try {
          const res = await onTeamChange(teamId)
          if (res?.success) {
            await update({ teamId: res.teamId, roleId: res.roleId })
          }
          router.refresh()
        } catch (error) {
          setOptimisticTeamId(currentTeamId)
          console.error('Failed to switch team:', error)
        }
      })
    },
    [onTeamChange, currentTeamId, setOptimisticTeamId, router, update]
  )

  return (
    <div className="flex items-center gap-2">
      <Select value={optimisticTeamId} onValueChange={handleTeamChange} disabled={isPending}>
        <SelectTrigger className="w-full bg-slate-800/50 border-white/10 text-white hover:bg-slate-700/50 transition-colors">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canCreateTeam && (
        <Button variant="ghost" size="icon" asChild title="Create new team" className="text-slate-400 hover:text-white hover:bg-white/10">
          <Link href="/dashboard/teams/new">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}
