'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Link as LinkIcon, Copy, Trash2, Clock, Download, ExternalLink, Shield, Lock, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

  const { data: session } = useSession()
  const activeTeamId = session?.user?.teamId

  useEffect(() => {
    fetchLinks()
  }, [activeTeamId])

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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
        <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
          Shared <span className="gradient-text">Links</span>
        </h2>
        <p className="text-muted-foreground font-medium">
          Manage and monitor your active file sharing endpoints.
        </p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        {isLoading ? (
          <div className="glass-card p-20 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-4 animate-pulse">
              <LinkIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Synchronizing Link Data...</p>
          </div>
        ) : links.length === 0 ? (
            <div className="glass-card p-20 text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-6">
                <LinkIcon className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">No Active Links</h3>
              <p className="text-muted-foreground max-w-xs mx-auto font-medium mb-8">
                You haven&apos;t shared any files yet. Go to your Files Explorer to generate secure links.
            </p>
              <Button
                asChild
                className="btn-primary-gradient h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                <a href="/dashboard/files">Go to Explorer</a>
              </Button>
            </div>
        ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {links.map((link, idx) => {
              const expired = isExpired(link.expiresAt)
              const limitReached = isLimitReached(link)
              const isInactive = expired || limitReached

              return (
                <div
                  key={link.id}
                  className={cn(
                    "glass-card !p-0 overflow-hidden flex flex-col transition-all group hover:scale-[1.02] hover:-translate-y-1",
                    isInactive && "opacity-60 grayscale-[0.5]"
                  )}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-6">
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                        isInactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}>
                        <LinkIcon size={22} strokeWidth={2.5} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyLink(link.hash)}
                          disabled={isInactive}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-rose-500 dark:hover:text-rose-500"
                          onClick={() => handleDelete(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="font-bold text-foreground tracking-tight text-lg mb-2 truncate group-hover:text-primary transition-colors">
                      {link.file.name}
                    </h3>

                    <div className="flex flex-wrap gap-3 mb-6">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {formatFileSize(Number(link.file.size))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
                          {link.downloadCount}{link.maxDownloads ? ` / ${link.maxDownloads}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-muted-foreground">Status</span>
                        {expired ? (
                          <span className="text-rose-500">Expired</span>
                        ) : limitReached ? (
                          <span className="text-rose-500">Limit Reached</span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-muted-foreground">Valid Until</span>
                        <span className={cn("text-foreground/80", expired && "text-rose-500/50")}>
                          {link.expiresAt ? formatRelativeTime(new Date(link.expiresAt)) : 'Permanent'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Security Features Bar */}
                  <div className="px-6 py-4 bg-background border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg border transition-colors",
                        link.passwordHash ? "bg-amber-400/10 border-amber-400/20 text-amber-500 dark:text-amber-400" : "bg-transparent border-border text-muted-foreground"
                      )} title={link.passwordHash ? "Password Protected" : "No Password"}>
                        <Lock size={12} strokeWidth={2.5} />
                      </div>
                      <div className={cn(
                        "p-1.5 rounded-lg border transition-colors",
                        link.allowDownload ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-border text-muted-foreground"
                      )} title={link.allowDownload ? "Downloads Allowed" : "Preview Only"}>
                        <Download size={12} strokeWidth={2.5} />
                      </div>
                      <div className={cn(
                        "p-1.5 rounded-lg border transition-colors",
                        link.allowPreview ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-500 dark:text-emerald-400" : "bg-transparent border-border text-muted-foreground"
                      )} title={link.allowPreview ? "Preview Active" : "Preview Disabled"}>
                        <Shield size={12} strokeWidth={2.5} />
                      </div>
                    </div>

                    {!isInactive && (
                      <button
                        onClick={() => handleCopyLink(link.hash)}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
                      >
                        Copy Share URL
                        <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
