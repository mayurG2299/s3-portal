'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Pencil, Trash2, Key, Globe, ShieldCheck, Plus, AlertCircle, Cloud, Server, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type Credential = {
  id: string
  name: string
  region: string
  team?: { name: string } | null
  teamId?: string | null
  buckets: BucketInput[]
}

type BucketInput = {
  id?: string
  bucket: string
  cloudfrontDomain?: string
  cloudfrontKeyPairId?: string
  cloudfrontPrivateKey?: string
}

export default function SettingsPage() {
  const [isSavingCredential, setIsSavingCredential] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [isUpdatingCredential, setIsUpdatingCredential] = useState(false)
  const [newBuckets, setNewBuckets] = useState<BucketInput[]>([
    { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
  ])
  const [editBuckets, setEditBuckets] = useState<BucketInput[]>([])

  const { data: session } = useSession()
  const activeTeamId = session?.user?.teamId

  useEffect(() => {
    fetchCredentials()
  }, [activeTeamId])

  useEffect(() => {
    if (editingCredential) {
      setEditBuckets(
        (editingCredential.buckets || []).map((bucket) => ({
          id: bucket.id,
          bucket: bucket.bucket,
          cloudfrontDomain: bucket.cloudfrontDomain || '',
          cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || '',
          cloudfrontPrivateKey: '',
        }))
      )
    }
  }, [editingCredential])

  async function fetchCredentials() {
    try {
      const response = await fetch('/api/credentials')
      if (response.ok) {
        const data = await response.json()
        setCredentials(data)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch credentials',
      })
    }
  }

  async function handleCredentialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSavingCredential(true)

    const formData = new FormData(e.currentTarget)
    const buckets = newBuckets
      .map((bucket, index) => {
        const fallbackBucket = (formData.get(`targetBucket_${index}`) as string) || ''
        return {
          bucket: (bucket.bucket || fallbackBucket).trim(),
          cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
          cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
          cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
        }
      })
      .filter((bucket) => bucket.bucket.length > 0)

    if (buckets.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Add at least one bucket',
      })
      setIsSavingCredential(false)
      return
    }

    const payload = {
      name: formData.get('name'),
      accessKey: formData.get('accessKey'),
      secretKey: formData.get('secretKey'),
      region: formData.get('region'),
      teamId: activeTeamId || undefined,
      buckets,
    }

    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add credentials')
      }

      toast({
        title: 'Success',
        description: 'AWS credentials added successfully',
      })
      ;(e.target as HTMLFormElement).reset()
      setNewBuckets([
        { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
      ])
      fetchCredentials()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsSavingCredential(false)
    }
  }

  async function handleDeleteCredential(id: string) {
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

      fetchCredentials()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    }
  }

  async function handleUpdateCredential(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCredential) return

    setIsUpdatingCredential(true)
    const formData = new FormData(e.currentTarget)

    const accessKey = (formData.get('editAccessKey') || '').toString().trim()
    const secretKey = (formData.get('editSecretKey') || '').toString().trim()

    const payload: Record<string, unknown> = {
      name: formData.get('editName'),
      region: formData.get('editRegion'),
      buckets: editBuckets
        .map((bucket, index) => {
          const fallbackBucket = (formData.get(`editTargetBucket_${index}`) as string) || ''
          return {
            id: bucket.id,
            bucket: (bucket.bucket || fallbackBucket).trim(),
            cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
            cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
            cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
          }
        })
        .filter((bucket) => bucket.bucket.length > 0),
    }

    if (accessKey) payload.accessKey = accessKey
    if (secretKey) payload.secretKey = secretKey
    if ((payload.buckets as any[]).length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Add at least one bucket',
      })
      setIsUpdatingCredential(false)
      return
    }

    try {
      const response = await fetch(`/api/credentials?id=${editingCredential.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update credentials')
      }

      toast({
        title: 'Success',
        description: 'Credential updated successfully',
      })

      setEditingCredential(null)
      setEditBuckets([])
      fetchCredentials()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsUpdatingCredential(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
        <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
          Platform <span className="gradient-text">Configuration</span>
        </h2>
        <p className="text-muted-foreground font-medium">
          Connect and manage your cloud infrastructure integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <div className="glass-card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <ShieldCheck size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">New Credentials</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Link a new AWS environment</p>
              </div>
            </div>

            <form onSubmit={handleCredentialSubmit} className="space-y-6" autoComplete="off">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Environment Name</Label>
                <Input name="name" placeholder="e.g., Production Assets" required className="bg-muted border-border rounded-xl h-12 focus:border-primary/50 transition-all font-medium text-foreground placeholder:text-muted-foreground/50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Access Key</Label>
                  <Input
                    name="accessKey"
                    placeholder="AKIA..."
                    required
                    disabled={isSavingCredential}
                    autoComplete="off"
                    className="bg-muted border-border rounded-xl h-12 focus:border-primary/50 transition-all font-bold text-xs uppercase tracking-widest text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Region</Label>
                  <Input name="region" placeholder="ap-south-1" required className="bg-muted border-border rounded-xl h-12 focus:border-primary/50 transition-all font-bold text-xs uppercase tracking-widest text-foreground placeholder:text-muted-foreground/50" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Secret Access Key</Label>
                <Input
                  name="secretKey"
                  type="password"
                  placeholder="••••••••••••••••"
                  required
                  disabled={isSavingCredential}
                  autoComplete="new-password"
                  className="bg-muted border-border rounded-xl h-12 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground/50 font-mono tracking-widest"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-foreground tracking-tight">Bucket Mapping</Label>
                    <p className="text-[10px] text-muted-foreground font-medium">Configure target S3 buckets</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewBuckets((prev) => [
                        ...prev,
                        { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
                      ])
                    }
                    className="h-8 rounded-lg bg-muted border border-border text-[10px] font-black uppercase tracking-widest text-primary hover:bg-muted/80"
                  >
                    <Plus size={14} className="mr-1.5" />
                    Expand
                  </Button>
                </div>

                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  {newBuckets.map((bucket, index) => (
                    <div key={`new-bucket-${index}`} className="rounded-xl bg-muted/50 border border-border p-4 space-y-4 animate-fade-in relative group/bucket">
                      {newBuckets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewBuckets((prev) => prev.filter((_, idx) => idx !== index))}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover/bucket:opacity-100 transition-opacity shadow-lg shadow-black/50"
                        >
                          <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Target Bucket</Label>
                        <Input
                          name={`targetBucket_${index}`}
                          placeholder="primary-assets-sync"
                          value={bucket.bucket}
                          onChange={(event) =>
                            setNewBuckets((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, bucket: event.target.value } : item
                              )
                            )
                          }
                          required={index === 0}
                          className="h-9 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:border-primary/50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">CDN Endpoint</Label>
                          <Input
                            placeholder="dxxxx.cloudfront.net"
                            value={bucket.cloudfrontDomain}
                            onChange={(event) =>
                              setNewBuckets((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? { ...item, cloudfrontDomain: event.target.value }
                                    : item
                                )
                              )
                            }
                            className="h-9 bg-background border border-border rounded-lg text-[10px] font-medium text-foreground/80 focus:border-primary/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Key Pair ID</Label>
                          <Input
                            placeholder="KXXXXXXXXX"
                            value={bucket.cloudfrontKeyPairId}
                            onChange={(event) =>
                              setNewBuckets((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? { ...item, cloudfrontKeyPairId: event.target.value }
                                    : item
                                )
                              )
                            }
                            className="h-9 bg-background border border-border rounded-lg text-[10px] font-medium text-foreground/80 focus:border-primary/50 font-mono tracking-tighter"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSavingCredential}
                className="w-full btn-primary-gradient h-12 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                {isSavingCredential ? 'Establishing Connection...' : 'Activate Integration'}
              </Button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground tracking-tight">Saved Connections</h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active infrastructure endpoints</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {credentials.length === 0 ? (
              <div className="col-span-full glass-card p-12 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4 opacity-50">
                  <Key className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No active integrations found.</p>
              </div>
            ) : (
              credentials.map((credential) => (
                <div key={credential.id} className="glass-card !p-0 overflow-hidden flex flex-col group hover:border-primary/50 transition-all">
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-6">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground border border-border group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                        <Key size={20} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingCredential(credential)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDeleteCredential(credential.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                      <Cloud className="text-primary h-5 w-5" />
                    </div>

                    <h4 className="font-bold text-foreground tracking-tight mb-1 truncate text-lg group-hover:text-primary transition-colors">
                      {credential.name}
                    </h4>

                    {credential.team ? (
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={11} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Team: {credential.team.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                          <User size={11} className="text-muted-foreground" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Personal Workspace</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-6">
                      <Globe size={11} className="text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{credential.region}</span>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <Server size={11} className="text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Infrastructure</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-foreground">AWS S3</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-muted-foreground">Resources</span>
                        <span className="text-primary">{credential.buckets.length} Buckets</span>
                      </div>
                    </div>
                  </div>

                  {credential.buckets.length > 0 && (
                    <div className="px-6 py-4 bg-muted/30 border-t border-border">
                      <div className="flex flex-wrap gap-2">
                        {credential.buckets.slice(0, 2).map((b, bi) => (
                          <span key={bi} className="px-2 py-0.5 rounded bg-background border border-border text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                            {b.bucket}
                          </span>
                        ))}
                        {credential.buckets.length > 2 && (
                          <span className="px-2 py-0.5 rounded bg-background border border-border text-[9px] font-bold text-primary uppercase tracking-tighter">
                            +{credential.buckets.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="glass-card bg-amber-50/50 dark:bg-amber-500/[0.03] border border-amber-500/20 dark:border-amber-500/10 p-5 rounded-2xl flex gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 dark:bg-amber-500/10 flex-shrink-0 flex items-center justify-center text-amber-600 dark:text-amber-500">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-700 dark:text-amber-200 tracking-tight">Security Protocol</h4>
              <p className="text-xs text-amber-600 dark:text-amber-500/80 mt-1 leading-relaxed">
                Credentials are encrypted using AES-256 before storage. Ensure your IAM policies follow the principle of least privilege for maximum security.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!editingCredential}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCredential(null)
            setEditBuckets([])
          }
        }}
      >
        <DialogContent className="max-w-2xl bg-card border-border text-foreground rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-2xl font-black tracking-tight">Edit <span className="gradient-text">Connection</span></DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              Update endpoints and configuration for this integration.
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 pb-8 pt-4">
            {editingCredential && (
              <form onSubmit={handleUpdateCredential} className="space-y-6" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Integration Name</Label>
                    <Input
                      id="editName"
                      name="editName"
                      defaultValue={editingCredential.name}
                      required
                      className="bg-muted border-border rounded-xl h-11 text-foreground focus:border-primary/50 transition-all font-bold tracking-tight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AWS Region</Label>
                    <Input
                      id="editRegion"
                      name="editRegion"
                      defaultValue={editingCredential.region}
                      required
                      className="bg-muted border-border rounded-xl h-11 text-foreground focus:border-primary/50 transition-all font-bold uppercase tracking-widest text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Access Key (Optional)</Label>
                    <Input id="editAccessKey" name="editAccessKey" placeholder="Leave empty to keep current" autoComplete="off" className="bg-muted border-border rounded-xl h-11 text-foreground focus:border-primary/50 transition-all font-bold uppercase tracking-widest text-xs placeholder:text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Secret Key (Optional)</Label>
                    <Input id="editSecretKey" name="editSecretKey" type="password" placeholder="••••••••" autoComplete="new-password" className="bg-muted border-border rounded-xl h-11 text-foreground focus:border-primary/50 transition-all placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mapped Buckets</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditBuckets((prev) => [
                          ...prev,
                          { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
                        ])
                      }
                      className="h-7 px-3 rounded-lg bg-primary/10 border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/20"
                    >
                      Add Resource
                    </Button>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    {editBuckets.map((bucket, index) => (
                      <div key={`edit-bucket-${bucket.id || index}`} className="rounded-2xl bg-muted/30 border-border border p-4 space-y-4 relative group/edit-bucket">
                        {!bucket.id && editBuckets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditBuckets((prev) => prev.filter((_, idx) => idx !== index))}
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg"
                          >
                            <Trash2 size={12} strokeWidth={2.5} />
                          </button>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">S3 Destination Name</Label>
                          <Input
                            name={`editTargetBucket_${index}`}
                            value={bucket.bucket}
                            onChange={(event) =>
                              setEditBuckets((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, bucket: event.target.value } : item
                                )
                              )
                            }
                            required={index === 0}
                            className="h-10 bg-background border-border rounded-xl text-xs font-bold text-foreground focus:border-primary/50"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">CDN Link (optional)</Label>
                            <Input
                              placeholder="dxxxx.cloudfront.net"
                              value={bucket.cloudfrontDomain}
                              onChange={(event) =>
                                setEditBuckets((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? { ...item, cloudfrontDomain: event.target.value }
                                      : item
                                  )
                                )
                              }
                              className="h-10 bg-background border-border rounded-xl text-[10px] font-medium text-foreground/80 placeholder:text-muted-foreground/60"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Key Pair ID</Label>
                            <Input
                              placeholder="KXXXXXXXXX"
                              value={bucket.cloudfrontKeyPairId}
                              onChange={(event) =>
                                setEditBuckets((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? { ...item, cloudfrontKeyPairId: event.target.value }
                                      : item
                                  )
                                )
                              }
                              className="h-10 bg-background border-border rounded-xl text-[10px] font-medium text-foreground/80 font-mono placeholder:text-muted-foreground/60"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingCredential(null)}
                    className="h-11 px-6 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdatingCredential}
                    className="h-11 px-8 rounded-xl bg-[#8c2bee] hover:bg-[#8c2bee] text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#8c2bee]/20"
                  >
                    {isUpdatingCredential ? 'Applying Changes...' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
