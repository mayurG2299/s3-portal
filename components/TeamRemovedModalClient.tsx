"use client"

import { useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { TeamRemovedModal } from '@/components/dashboard/TeamRemovedModal'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function TeamRemovedModalClient() {
  const router = useRouter()
  const { teamRemoved, setTeamRemoved } = useTeamRemoved()
  const handleRefresh = useCallback(() => {
    setTeamRemoved(false)
    router.refresh()
  }, [router, setTeamRemoved])

  if (!teamRemoved) return null
  return <TeamRemovedModal open={true} onRefresh={handleRefresh} />
}
