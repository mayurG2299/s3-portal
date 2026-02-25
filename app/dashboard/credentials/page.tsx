'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

interface Credential {
  id: string
  name: string
  region: string
  buckets: { id: string; bucket: string; cloudfrontDomain?: string }[]
  team?: { name: string }
  createdAt: string
}

export default function CredentialsPage() {
  const router = useRouter()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const run = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/credentials', { signal: controller.signal })

        if (!response.ok) {
          throw new Error('Failed to fetch credentials')
        }

        const data = await response.json()
        if (!isActive) return

        setCredentials(data)

        if (data.length === 0) {
          router.push('/dashboard/settings')
        }
      } catch (error: any) {
        if (controller.signal.aborted) return

        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'Failed to fetch credentials',
        })
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
  }, [router, refreshKey])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this credential?')) return

    try {
      const response = await fetch(`/api/credentials?id=${id}`, {
        method: 'DELETE',
      })

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete credential',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <header className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-2xl font-bold">AWS Credentials</h1>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                credentials.map((cred) => (
                  <Card key={cred.id}>
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
                ))
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}
