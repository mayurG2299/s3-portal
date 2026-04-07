'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Database, ChevronDown, ChevronUp } from 'lucide-react'

type Bucket = { id: string; bucket: string }
type Credential = { id: string; name: string; region: string; buckets: Bucket[] }
type Member = {
  id: string
  user: { id: string; name: string | null; email: string }
  role: { name: string; level: number }
}

type Props = {
  member: Member
  teamId: string
  currentUserId: string
  ownerId: string
}

export function BucketAccessManager({ member, teamId, currentUserId, ownerId }: Props) {
  // All hooks must be declared before any conditional returns
  const [open, setOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setFetchError(false)
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        const [credsRes, accessRes] = await Promise.all([
          fetch(`/api/team/buckets?teamId=${encodeURIComponent(teamId)}`),
          fetch(`/api/team/members/${member.id}/buckets`),
        ])
        if (!credsRes.ok || !accessRes.ok) {
          setFetchError(true)
          return
        }
        const { credentials: creds } = await credsRes.json()
        setCredentials(creds || [])
        const { bucketIds } = await accessRes.json()
        setSelectedIds(bucketIds || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, teamId, member.id])

  // Admins/owners are unrestricted — no UI needed
  if (member.role.level >= 50) return null
  // Can't manage yourself or the owner
  if (member.user.id === currentUserId || member.user.id === ownerId) return null

  const toggle = (id: string) =>
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/team/members/${member.id}/buckets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketIds: selectedIds }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast({ title: 'Bucket access updated' })
      setOpen(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to update bucket access', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <Database size={11} />
        Bucket Access
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 space-y-3 animate-fade-in">
          {loading ? (
            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : fetchError ? (
            <p className="text-[11px] text-rose-500">Failed to load bucket access. Please try again.</p>
          ) : credentials.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No buckets in this team.</p>
          ) : (
            credentials.map((cred) => (
              <div key={cred.id} className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {cred.name} <span className="font-normal normal-case">({cred.region})</span>
                </p>
                {cred.buckets.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 ml-2">
                    <input
                      type="checkbox"
                      id={`bam-${b.id}`}
                      checked={selectedIds.includes(b.id)}
                      onChange={() => toggle(b.id)}
                      className="h-3 w-3 rounded accent-primary cursor-pointer"
                    />
                    <label htmlFor={`bam-${b.id}`} className="text-[11px] font-mono cursor-pointer">
                      {b.bucket}
                    </label>
                  </div>
                ))}
              </div>
            ))
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-[10px] font-black uppercase tracking-widest">
              {saving ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-[10px]">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
