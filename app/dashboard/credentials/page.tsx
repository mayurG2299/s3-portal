'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Trash2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { useListNav } from '@/hooks/use-list-nav'
import { cn } from '@/lib/utils'

interface Credential {
  id: string
  name: string
  region: string
  buckets: { id: string; bucket: string; cloudfrontDomain?: string }[]
  team?: { name: string }
  createdAt: string
}

export default function CredentialsPage() {
  const { teamRemoved } = useTeamRemoved();
  const router = useRouter()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [personalScopeFallback, setPersonalScopeFallback] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const { selectedTeamId, handleTeamAccessFailure } = useDashboard()
  const activeTeamId = selectedTeamId

  const { focusedIndex, itemRefs } = useListNav({
    items: credentials,
    isModalOpen: false,
    keyActions: {
      onDelete: (cred) => handleDelete(cred.id),
    },
  })

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()


    const run = async () => {
      try {
        setIsLoading(true)
        const url = activeTeamId
          ? `/api/credentials?teamId=${encodeURIComponent(activeTeamId)}`
          : '/api/credentials'
        const response = await fetch(url, { signal: controller.signal })

        if (response.status === 403 || response.status === 404) {
          handleTeamAccessFailure(response.status)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch credentials')
        }

        const data = await response.json()
        if (!isActive) return

        // Support both new and old API response shapes
        if (Array.isArray(data)) {
          setCredentials(data)
          setPersonalScopeFallback(false)
          if (data.length === 0) {
            router.push('/dashboard/settings')
          }
        } else {
          setCredentials(data.credentials || [])
          setPersonalScopeFallback(!!data.personalScopeFallback)
          if ((data.credentials || []).length === 0) {
            router.push('/dashboard/settings')
          }
        }
      } catch (error: any) {
        if (controller.signal.aborted) return
        if (!teamRemoved) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: error?.message || 'Failed to fetch credentials',
          })
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [router, refreshKey, activeTeamId, handleTeamAccessFailure])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this credential?')) return

    try {
      const response = await fetch(`/api/credentials?id=${id}`, {
        method: 'DELETE',
      })

      if (response.status === 403 || response.status === 404) {
        handleTeamAccessFailure(response.status)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: 'Success',
        description: 'Credential deleted',
      })

      // Trigger refetch by incrementing refreshKey
      setRefreshKey((prev) => prev + 1)
    } catch (error: any) {
      if (!teamRemoved) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to delete credential',
        })
      }
    }
  }

  return (
    <div className="min-h-screen">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="mb-8 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <KeyRound size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  AWS <span className="text-gradient">Credentials</span>
                </h1>
                <p className="text-sm text-muted-foreground">Manage your AWS access keys and storage identities.</p>
              </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {personalScopeFallback && (
              <div className="mb-6 p-4 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-center">
                You are viewing your personal resources. Select or join a team for more.
              </div>
            )}
            <div className="grid gap-4">
              {credentials.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-gray-500 mb-4">No credentials added yet</p>
                    <Button onClick={() => router.push('/dashboard/settings')}>
                      Add credentials in Settings
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                credentials.map((cred, idx) => (
                  <div
                    key={cred.id}
                    ref={itemRefs[idx]}
                    tabIndex={0}
                    className={cn("rounded-lg focus:outline-none focus:ring-2 focus:ring-primary", focusedIndex === idx && "ring-2 ring-primary")}
                  >
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle>{cred.name}</CardTitle>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          <span>Region: {cred.region}</span>
                          <span>
                            Bucket: {cred.buckets[0]?.bucket || 'None'}
                            {cred.buckets.length > 1
                              ? ` (+${cred.buckets.length - 1})`
                              : ''}
                          </span>
                          {cred.buckets.some((bucket) => bucket.cloudfrontDomain) && (
                            <span>
                              CDN: {cred.buckets.filter((bucket) => bucket.cloudfrontDomain).length}
                            </span>
                          )}
                        </div>
                        {cred.team && (
                          <p className="text-sm text-gray-500 mt-1">
                            Team: {cred.team.name}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cred.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                  </Card>
                  </div>
                ))
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}
