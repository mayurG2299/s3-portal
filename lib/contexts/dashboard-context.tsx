'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'

import { toast } from '@/hooks/use-toast'

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

interface DashboardContextType {
  selectedTeamId: string | null
  selectedIdentityId: string | null // null means "All"
  selectedBucketId: string | null // null means "All"
  identities: CloudIdentity[]
  teams: Team[]
  isLoading: boolean
  setTeam: (id: string) => void
  setIdentity: (id: string | null) => void
  setBucket: (id: string | null) => void
  refreshIdentities: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({ 
  children, 
  initialTeams,
  initialTeamId,
  initialIdentityId,
  initialBucketId
}: { 
  children: React.ReactNode
  initialTeams: Team[]
  initialTeamId: string | null
  initialIdentityId?: string | null
  initialBucketId?: string | null
}) {
  const router = useRouter()

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(initialTeamId)
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(initialIdentityId || null)
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(initialBucketId || null)
  const [identities, setIdentities] = useState<CloudIdentity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [teamLost, setTeamLost] = useState(false)
  const prevTeamIdRef = useRef<string | null>(initialTeamId)

  // Effect: Team loss detection, auto-fallback, toast, and multi-tab sync
  useEffect(() => {
    // Team loss detection
    if (selectedTeamId && !initialTeams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(null)
      Cookies.remove('selectedTeamId')
      setSelectedIdentityId(null)
      setSelectedBucketId(null)
      Cookies.remove('selectedIdentityId')
      Cookies.remove('selectedBucketId')
      setTeamLost(true)
      prevTeamIdRef.current = selectedTeamId
    }
  }, [selectedTeamId, initialTeams])

  // Auto-fallback and toast notification
  useEffect(() => {
    if (teamLost) {
      if (initialTeams.length > 0) {
        const fallbackTeamId = initialTeams[0].id
        setSelectedTeamId(fallbackTeamId)
        Cookies.set('selectedTeamId', fallbackTeamId, { expires: 7 })
        toast({
          title: 'Team switched',
          description: `You lost access to your previous team. Switched to: ${initialTeams[0].name}.`,
          variant: 'default',
        })
      } else {
        toast({
          title: 'No teams available',
          description: 'You lost access to your last team. Please join or create a new team.',
          variant: 'destructive',
        })
        // Optionally, redirect to a "no teams" dashboard page here
      }
      setTeamLost(false)
    }
  }, [teamLost, initialTeams])

  // Multi-tab/session sync for selectedTeamId, selectedIdentityId, selectedBucketId
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'selectedTeamId') {
        setSelectedTeamId(event.newValue)
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
  }, [])

  // Fetch identities for the current team
  const refreshIdentities = useCallback(async () => {
    if (!selectedTeamId) {
      setIdentities([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/credentials?teamId=${encodeURIComponent(selectedTeamId)}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setIdentities(Array.isArray(data) ? data : data.credentials || [])
      } else {
        setIdentities([])
      }
    } catch (error) {
      console.error('Failed to fetch identities:', error)
      setIdentities([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedTeamId])

  useEffect(() => {
    refreshIdentities()
  }, [refreshIdentities])

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

  const setTeam = (id: string) => {
    setSelectedTeamId(id)
    setSelectedIdentityId(null)
    setSelectedBucketId(null)
    Cookies.set('selectedTeamId', id, { expires: 7 })
    Cookies.remove('selectedIdentityId')
    Cookies.remove('selectedBucketId')
    router.refresh()
  }

  const setIdentity = (id: string | null) => {
    setSelectedIdentityId(id)
    setSelectedBucketId(null)
    if (id) {
      Cookies.set('selectedIdentityId', id, { expires: 7 })
    } else {
      Cookies.remove('selectedIdentityId')
    }
    Cookies.remove('selectedBucketId')
    router.refresh()
  }

  const setBucket = (id: string | null) => {
    setSelectedBucketId(id)
    if (id) {
      Cookies.set('selectedBucketId', id, { expires: 7 })
    } else {
      Cookies.remove('selectedBucketId')
    }
    router.refresh()
  }

  return (
    <DashboardContext.Provider
      value={{
        selectedTeamId,
        selectedIdentityId,
        selectedBucketId,
        identities,
        teams: initialTeams,
        isLoading,
        setTeam,
        setIdentity,
        setBucket,
        refreshIdentities
      }}
    >
      {children}
      {/* Optionally, render a No Teams UI here if initialTeams.length === 0 */}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
