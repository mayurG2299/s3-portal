'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'

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

  // Fetch identities for the current team
  const refreshIdentities = useCallback(async () => {
    if (!selectedTeamId) {
      setIdentities([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/credentials')
      if (response.ok) {
        const data = await response.json()
        setIdentities(data)
      }
    } catch (error) {
      console.error('Failed to fetch identities:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedTeamId])

  useEffect(() => {
    refreshIdentities()
  }, [refreshIdentities])

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
