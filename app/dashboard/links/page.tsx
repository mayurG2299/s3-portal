'use client'

import { useState, useEffect } from 'react'
import { Link as LinkIcon, Copy, Trash2, Clock, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime, formatFileSize } from '@/lib/utils'

interface Link {
  id: string
  hash: string
  type: string
  expiresAt?: string
  downloadCount: number
  maxDownloads?: number
  allowDownload: boolean
  allowPreview: boolean
  passwordHash?: string | null
  createdAt: string
  file: {
    name: string
    size: string
    contentType?: string
  }
}

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLinks()
  }, [])

  async function fetchLinks() {
    try {
      const response = await fetch('/api/links')
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch links',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyLink(hash: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/share/${hash}`
    
    try {
      await navigator.clipboard.writeText(url)
      toast({
        title: 'Copied!',
        description: 'Link copied to clipboard',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to copy link',
      })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this link?')) return

    try {
      const response = await fetch(`/api/links?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: 'Success',
        description: 'Link deleted',
      })

      fetchLinks()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    }
  }

  function isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  function isLimitReached(link: Link): boolean {
    return link.maxDownloads ? link.downloadCount >= link.maxDownloads : false
  }

  return (
    <div className="max-w-7xl mx-auto py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Shared Links</h1>
        <p className="text-slate-500 mt-1">Manage your shared file links</p>
      </div>

      <div>
        {isLoading ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500">Loading...</p>
          </Card>
        ) : links.length === 0 ? (
          <Card className="p-12 text-center">
            <LinkIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">No shared links yet</p>
            <p className="text-sm text-gray-400">
              Share files from the Files page to create links
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {links.map((link) => {
              const expired = isExpired(link.expiresAt)
              const limitReached = isLimitReached(link)
              const isInactive = expired || limitReached

              return (
                <Card key={link.id} className={isInactive ? 'opacity-60' : ''}>
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">
                          {link.file.name}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            {formatFileSize(Number(link.file.size))}
                          </span>
                          {link.file.contentType && (
                            <span>{link.file.contentType}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {link.downloadCount}
                            {link.maxDownloads && ` / ${link.maxDownloads}`} downloads
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(link.hash)}
                          disabled={isInactive}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(link.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        Created {formatRelativeTime(new Date(link.createdAt))}
                      </span>
                      {link.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {expired ? (
                            <span className="text-red-600 font-medium">Expired</span>
                          ) : (
                            `Expires ${formatRelativeTime(new Date(link.expiresAt))}`
                          )}
                        </span>
                      )}
                      {limitReached && (
                        <span className="text-red-600 font-medium">
                          Download limit reached
                        </span>
                      )}
                      {link.passwordHash && (
                        <span className="text-amber-600">Password protected</span>
                      )}
                      {!link.allowDownload && (
                        <span className="text-amber-600">Preview only</span>
                      )}
                      {!link.allowPreview && (
                        <span className="text-amber-600">Preview disabled</span>
                      )}
                    </div>

                    {!isInactive && (
                      <div className="mt-4 p-3 bg-gray-50 rounded border font-mono text-xs break-all">
                        {process.env.NEXT_PUBLIC_APP_URL || window.location.origin}
                        /share/{link.hash}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
