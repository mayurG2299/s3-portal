"use client"

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'

export default function DirectLinkModal({ file, open, onClose }: { file: { id: string, name: string }, open: boolean, onClose: () => void }) {
  const [directUrl, setDirectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !file) return
    setLoading(true)
    setDirectUrl(null)
    fetch(`/api/files/${file.id}/direct-link`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to get direct link')
        const data = await res.json()
        setDirectUrl(data.url)
      })
      .catch((err) => {
        toast({ variant: 'destructive', title: 'Direct Link Error', description: err.message })
        onClose()
      })
      .finally(() => setLoading(false))
  }, [open, file, onClose])

  const handleCopy = () => {
    if (directUrl) {
      navigator.clipboard.writeText(directUrl)
      toast({ title: 'Copied!', description: 'Direct link copied to clipboard.' })
    }
  }

  if (!file) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Permanant Direct Link (No Expiry)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1">Permanent Link (S3 or CDN, does not expire)</label>
            <Input
              value={directUrl || ''}
              readOnly
              className="w-full text-xs font-mono"
              onFocus={e => e.target.select()}
            />
          </div>
          <Button onClick={handleCopy} disabled={!directUrl || loading} className="w-full">
            {loading ? 'Loading...' : 'Copy Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
