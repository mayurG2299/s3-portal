
'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { TeamRemovedModal } from '@/components/dashboard/TeamRemovedModal'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TeamInvitation, TeamSummary, useTeamStore } from '@/lib/stores/team-store'


// Global context for team removal modal
interface TeamRemovedContextType {
  teamRemoved: boolean
  setTeamRemoved: (value: boolean) => void
}

export interface Bucket {
  id: string
  bucket: string
  cloudfrontDomain?: string | null
}

export interface CloudIdentity {
  id: string
  name: string
  buckets: Bucket[]
}

export interface Team {
  id: string
  name: string
  slug: string
}

const TEAM_POLLING_INTERVAL_MS = 20_000
const INVITATION_POLLING_INTERVAL_MS = 20_000

class TeamAccessError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Defines the shape of the DashboardContext value
interface DashboardContextType {
  selectedTeamId: string | null
  selectedIdentityId: string | null // null means "All"
  selectedBucketId: string | null // null means "All"
  identities: CloudIdentity[]
  teams: Team[]
  invitations: TeamInvitation[]
  isLoading: boolean
  setTeam: (id: string) => void
  setIdentity: (id: string | null) => void
  setBucket: (id: string | null) => void
  refreshIdentities: () => Promise<void>
  refreshTeams: () => Promise<void>
  pendingInviteCount: number
  refreshInvitations: () => Promise<void>
  acceptInvitation: (inviteId: string) => Promise<{ teamId: string; teamName: string }>
  rejectInvitation: (inviteId: string) => Promise<void>
  handleTeamAccessFailure: (statusCode: number) => void
}



const TeamRemovedContext = createContext<TeamRemovedContextType | undefined>(undefined)
const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

interface DashboardProviderProps {
  children: React.ReactNode
  initialTeams: Team[]
  initialTeamId: string | null
  initialIdentityId?: string | null
  initialBucketId?: string | null
}

export function DashboardProvider({
  children,
  initialTeams,
  initialTeamId,
  initialIdentityId,
  initialBucketId
}: DashboardProviderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const {
    currentTeamId,
    teams,
    invitations,
    removalModalOpen,
    initialize,
    setCurrentTeamId,
    setTeams,
    setInvitations,
    addTeam,
    removeTeam,
    removeInvitation,
    closeRemovalModal,
    openRemovalModal,
  } = useTeamStore()

  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(initialIdentityId || null)
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(initialBucketId || null)
  const [identities, setIdentities] = useState<CloudIdentity[]>([])
  const [teamRemoved, setTeamRemoved] = useState(false)
  useEffect(() => {
    initialize({
      teams: initialTeams,
      currentTeamId: initialTeamId,
    })
  }, [initialize, initialTeams, initialTeamId])

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<TeamSummary[]> => {
      const response = await fetch('/api/teams', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load teams')
      }
      const data = await response.json()
      return Array.isArray(data) ? data : data.teams || []
    },
    refetchInterval: TEAM_POLLING_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: async (): Promise<TeamInvitation[]> => {
      const response = await fetch('/api/team/invites', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load invitations')
      }
      const data = await response.json()
      return Array.isArray(data) ? data : []
    },
    refetchInterval: INVITATION_POLLING_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const identitiesQuery = useQuery({
    queryKey: ['credentials', currentTeamId],
    enabled: Boolean(currentTeamId),
    queryFn: async (): Promise<CloudIdentity[]> => {
      if (!currentTeamId) return []

      const response = await fetch(`/api/credentials?teamId=${encodeURIComponent(currentTeamId)}`, {
        cache: 'no-store',
      })

      if (response.status === 403 || response.status === 404) {
        throw new TeamAccessError(response.status, 'No longer authorized for selected team')
      }

      if (!response.ok) {
        throw new Error('Failed to load team credentials')
      }

      const data = await response.json()
      return Array.isArray(data) ? data : data.credentials || []
    },
  })

  useEffect(() => {
    if (teamsQuery.data) {
      setTeams(teamsQuery.data)
    }
  }, [teamsQuery.data, setTeams])

  useEffect(() => {
    if (invitationsQuery.data) {
      setInvitations(invitationsQuery.data)
    }
  }, [invitationsQuery.data, setInvitations])

  useEffect(() => {
    if (identitiesQuery.error instanceof TeamAccessError) {
      if (identitiesQuery.error.status === 403 || identitiesQuery.error.status === 404) {
        if (currentTeamId) {
          removeTeam(currentTeamId)
          setTeamRemoved(true)
        }
      }
      return
    }
    setIdentities(identitiesQuery.data || [])
  }, [currentTeamId, identitiesQuery.data, identitiesQuery.error, removeTeam])

  // Real-time path (primary): SSE broadcast of membership changes.
  useEffect(() => {
    const evtSource = new window.EventSource('/api/events/membership')

    const handleMembershipChange = () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    }

    evtSource.addEventListener('membership', handleMembershipChange)

    return () => {
      evtSource.removeEventListener('membership', handleMembershipChange)
      evtSource.close()
    }
  }, [queryClient])

  const refreshTeams = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['teams'] })
    await queryClient.refetchQueries({ queryKey: ['teams'], type: 'active' })
  }, [queryClient])

  const refreshInvitations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['invitations'] })
    await queryClient.refetchQueries({ queryKey: ['invitations'], type: 'active' })
  }, [queryClient])

  const refreshIdentities = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['credentials', currentTeamId] })
    await queryClient.refetchQueries({ queryKey: ['credentials', currentTeamId], type: 'active' })
  }, [currentTeamId, queryClient])

  const handleTeamAccessFailure = useCallback(
    (statusCode: number) => {
      if ((statusCode === 403 || statusCode === 404) && currentTeamId) {
        removeTeam(currentTeamId)
        setTeamRemoved(true)
      }
    },
    [currentTeamId, removeTeam]
  )

  // Listen for teamRemoved sync from other tabs
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === 'teamRemoved' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue)
          if (data?.id === currentTeamId && currentTeamId) {
            openRemovalModal(currentTeamId)
          }
        } catch { }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [currentTeamId, openRemovalModal])

  // Multi-tab/session sync for selectedTeamId, selectedIdentityId, selectedBucketId
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'selectedTeamId') {
        setCurrentTeamId(event.newValue)
      }
      if (event.key === 'selectedIdentityId') {
        setSelectedIdentityId(event.newValue)
      }
      if (event.key === 'selectedBucketId') {
        setSelectedBucketId(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [setCurrentTeamId])

  // Reset stale identity/bucket selections when switching teams or when data changes.
  useEffect(() => {
    if (!selectedIdentityId) return

    const identityExists = identities.some((identity) => identity.id === selectedIdentityId)
    if (!identityExists) {
      setSelectedIdentityId(null)
      setSelectedBucketId(null)
      Cookies.remove('selectedIdentityId')
      Cookies.remove('selectedBucketId')
    }
  }, [identities, selectedIdentityId])

  useEffect(() => {
    if (!selectedBucketId || !selectedIdentityId) return

    const identity = identities.find((item) => item.id === selectedIdentityId)
    const bucketExists = identity?.buckets.some((bucket) => bucket.id === selectedBucketId)

    if (!bucketExists) {
      setSelectedBucketId(null)
      Cookies.remove('selectedBucketId')
    }
  }, [identities, selectedIdentityId, selectedBucketId])

  const setTeam = useCallback((id: string) => {
    if (!id) return

    setCurrentTeamId(id)
    setSelectedIdentityId(null)
    setSelectedBucketId(null)

    Cookies.set('selectedTeamId', id, { expires: 7 })
    Cookies.remove('selectedIdentityId')
    Cookies.remove('selectedBucketId')
    localStorage.setItem('selectedTeamId', id)
    localStorage.removeItem('selectedIdentityId')
    localStorage.removeItem('selectedBucketId')

    // Team changes are boundary crossings: invalidate all queries to force resync.
    queryClient.invalidateQueries()
    router.refresh()
  }, [queryClient, router, setCurrentTeamId])

  const setIdentity = useCallback((id: string | null) => {
    setSelectedIdentityId(id)
    setSelectedBucketId(null)

    if (id) {
      Cookies.set('selectedIdentityId', id, { expires: 7 })
      localStorage.setItem('selectedIdentityId', id)
    } else {
      Cookies.remove('selectedIdentityId')
      localStorage.removeItem('selectedIdentityId')
    }

    Cookies.remove('selectedBucketId')
    localStorage.removeItem('selectedBucketId')
    router.refresh()
  }, [router])

  const setBucket = useCallback((id: string | null) => {
    setSelectedBucketId(id)

    if (id) {
      Cookies.set('selectedBucketId', id, { expires: 7 })
      localStorage.setItem('selectedBucketId', id)
    } else {
      Cookies.remove('selectedBucketId')
      localStorage.removeItem('selectedBucketId')
    }

    router.refresh()
  }, [router])

  const acceptInvitation = useCallback(async (inviteId: string): Promise<{ teamId: string; teamName: string }> => {
    const snapshot = invitations
    const invite = snapshot.find((item) => item.id === inviteId)

    if (!invite) {
      throw new Error('Invitation no longer available')
    }

    removeInvitation(inviteId)
    addTeam(invite.team)

    const response = await fetch(`/api/team/invites/${inviteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    })

    if (!response.ok) {
      setInvitations(snapshot)
      setTeams(teams)
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Failed to accept invitation')
    }

    const payload = await response.json()
    await Promise.all([refreshTeams(), refreshInvitations()])
    return { teamId: payload.teamId, teamName: payload.teamName }
  }, [addTeam, invitations, refreshInvitations, refreshTeams, removeInvitation, setInvitations, setTeams, teams])

  const rejectInvitation = useCallback(async (inviteId: string): Promise<void> => {
    const snapshot = invitations
    removeInvitation(inviteId)

    const response = await fetch(`/api/team/invites/${inviteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    })

    if (!response.ok) {
      setInvitations(snapshot)
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Failed to reject invitation')
    }

    await refreshInvitations()
  }, [invitations, refreshInvitations, removeInvitation, setInvitations])

  // Handler for modal CTA
  const handleTeamRemovedRefresh = useCallback(async () => {
    const latestTeams = useTeamStore.getState().teams
    const preferredFallback = initialTeamId && latestTeams.some((team) => team.id === initialTeamId)
      ? initialTeamId
      : null
    const fallbackTeamId = preferredFallback || latestTeams[0]?.id || null

    setCurrentTeamId(fallbackTeamId)
    setSelectedIdentityId(null)
    setSelectedBucketId(null)

    if (fallbackTeamId) {
      Cookies.set('selectedTeamId', fallbackTeamId, { expires: 7 })
      localStorage.setItem('selectedTeamId', fallbackTeamId)
    } else {
      Cookies.remove('selectedTeamId')
      localStorage.removeItem('selectedTeamId')
    }

    Cookies.remove('selectedIdentityId')
    Cookies.remove('selectedBucketId')
    localStorage.removeItem('selectedIdentityId')
    localStorage.removeItem('selectedBucketId')
    closeRemovalModal()

    try {
      localStorage.removeItem('teamRemoved')
    } catch { }

    await queryClient.invalidateQueries()
    router.refresh()
  }, [closeRemovalModal, initialTeamId, queryClient, router, setCurrentTeamId])

  useEffect(() => {
    if (!teamsQuery.isSuccess) return
    if (teams.length === 0) return

    if (currentTeamId && !teams.some((team) => team.id === currentTeamId)) {
      openRemovalModal(currentTeamId)
      try {
        localStorage.setItem('teamRemoved', JSON.stringify({ id: currentTeamId, ts: Date.now() }))
      } catch { }
    }
  }, [currentTeamId, openRemovalModal, teams, teamsQuery.isSuccess])

  // If teamRemoved, block all dashboard content except modal

  // Remove modal rendering from here; will be handled globally

  return (
    <TeamRemovedContext.Provider value={{ teamRemoved, setTeamRemoved }}>
      <DashboardContext.Provider
        value={{
          selectedTeamId: currentTeamId,
          selectedIdentityId,
          selectedBucketId,
          identities,
          teams,
          invitations,
          isLoading: identitiesQuery.isFetching || teamsQuery.isFetching || invitationsQuery.isFetching,
          setTeam,
          setIdentity,
          setBucket,
          refreshIdentities,
          refreshTeams,
          pendingInviteCount: invitations.length,
          refreshInvitations,
          acceptInvitation,
          rejectInvitation,
          handleTeamAccessFailure,
        }}
      >
        {children}
      </DashboardContext.Provider>
    </TeamRemovedContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

// Global hook for team removed modal
export function useTeamRemoved() {
  const context = useContext(TeamRemovedContext)
  if (context === undefined) {
    throw new Error('useTeamRemoved must be used within a TeamRemovedContext provider')
  }
  return context
}
