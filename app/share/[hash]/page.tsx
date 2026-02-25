'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { formatFileSize } from '@/lib/utils'

export default function SharePage({ params }: { params: { hash: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchShare = useCallback(async (pwd?: string) => {
    try {
      setIsLoading(true)
      const url = pwd
        ? `/api/share/${params.hash}?password=${encodeURIComponent(pwd)}`
        : `/api/share/${params.hash}`

      const response = await fetch(url)
      const data = await response.json()

      if (response.status === 401 && data.requiresPassword) {
        setRequiresPassword(true)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to access file')
      }

      setFile(data)
      setIsLoading(false)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      setIsLoading(false)
    }
  }, [params.hash])

  useEffect(() => {
    fetchShare()
  }, [fetchShare])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetchShare(password)
  }

  async function handleDownload() {
    if (!file?.downloadUrl) return

    try {
      window.location.href = file.downloadUrl
      toast({
        title: 'Download started',
        description: 'Your file is downloading',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to download file',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <p className="text-center text-gray-500">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (requiresPassword && !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Enter password to access this file</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Access File
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">File not found or link expired</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Shared File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">{file.file.name}</h2>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>{formatFileSize(Number(file.file.size))}</span>
              {file.file.contentType && <span>{file.file.contentType}</span>}
            </div>
          </div>

          {file.allowDownload && (
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Download File
            </Button>
          )}

          {!file.allowDownload && (
            <p className="text-center text-gray-500">
              Download is disabled for this file
            </p>
          )}

          <div className="pt-4 border-t text-center text-xs text-gray-500">
            <p>Powered by S3 Portal</p>
            <p className="mt-1">Secure, self-hosted file sharing</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
