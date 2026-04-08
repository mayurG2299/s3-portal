'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CredentialForm from '@/components/CredentialForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { Pencil, Trash2, Key, Globe, ShieldCheck, AlertCircle, Cloud, Server, Users, User, PlusCircle, Moon, Sun, Palette } from 'lucide-react'
import { THEMES, getSavedTheme, getSavedMode, applyThemeAndMode } from '@/lib/theme-store'
import type { ThemeId, ThemeMode } from '@/lib/theme-store'
import { useDashboard } from '@/lib/contexts/dashboard-context'

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
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [isAddCredentialOpen, setIsAddCredentialOpen] = useState(false)
  const [isUpdatingCredential, setIsUpdatingCredential] = useState(false)
  const [editBuckets, setEditBuckets] = useState<BucketInput[]>([])
  const [activeTheme, setActiveTheme] = useState<ThemeId>('nebula')
  const [activeMode, setActiveMode] = useState<ThemeMode>('dark')

  const { selectedTeamId, handleTeamAccessFailure } = useDashboard()

  useEffect(() => {
    setActiveTheme(getSavedTheme())
    setActiveMode(getSavedMode())
  }, [])

  const handleThemeChange = useCallback((id: ThemeId) => {
    setActiveTheme(id)
    applyThemeAndMode(id, activeMode)
  }, [activeMode])

  const handleModeChange = useCallback((mode: ThemeMode) => {
    setActiveMode(mode)
    applyThemeAndMode(activeTheme, mode)
  }, [activeTheme])
  const activeTeamId = selectedTeamId

  const fetchCredentials = useCallback(async () => {
    try {
      const url = activeTeamId
        ? `/api/credentials?teamId=${encodeURIComponent(activeTeamId)}`
        : '/api/credentials'
      const response = await fetch(url)
      if (response.status === 403 || response.status === 404) {
        handleTeamAccessFailure(response.status)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setCredentials(Array.isArray(data.credentials) ? data.credentials : [])
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch credentials',
      })
    }
  }, [activeTeamId, handleTeamAccessFailure])

  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

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

  async function handleDeleteCredential(id: string) {
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

      if (response.status === 403 || response.status === 404) {
        handleTeamAccessFailure(response.status)
        return
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update credentials')
      }

      const updated = await response.json()

      toast({
        title: 'Success',
        description: 'Credential updated successfully',
      })

      // Notify admin if any restricted team members don't have access to newly added buckets.
      // Collect across ALL new buckets and fire ONE consolidated toast.
      const teamId = editingCredential.teamId
      if (teamId && Array.isArray(updated?.buckets)) {
        try {
          const existingBucketIds = new Set(
            (editingCredential.buckets || []).map((b: BucketInput) => b.id).filter(Boolean)
          )
          const newBuckets = (updated.buckets as { id: string }[]).filter(
            (b) => !existingBucketIds.has(b.id)
          )

          type RestrictedMember = { id: string; bucketAccess: { bucketId: string }[] }
          const missingByMember = new Map<string, { member: RestrictedMember; newBucketIds: string[] }>()

          await Promise.all(
            newBuckets.map(async (b) => {
              const res = await fetch(
                `/api/team/members/restricted?teamId=${encodeURIComponent(teamId)}&bucketId=${encodeURIComponent(b.id)}`
              )
              if (!res.ok) return
              const { members } = await res.json()
              for (const m of members as RestrictedMember[]) {
                const entry = missingByMember.get(m.id)
                if (entry) {
                  entry.newBucketIds.push(b.id)
                } else {
                  missingByMember.set(m.id, { member: m, newBucketIds: [b.id] })
                }
              }
            })
          )

          if (missingByMember.size > 0) {
            const bucketWord = newBuckets.length === 1 ? 'bucket' : 'buckets'
            toast({
              title: `${newBuckets.length} new ${bucketWord} added`,
              description: `${missingByMember.size} restricted member(s) lack access to at least one new bucket.`,
              action: (
                <ToastAction
                  altText="Grant access"
                  onClick={async () => {
                    const results = await Promise.allSettled(
                      [...missingByMember.values()].map(({ member, newBucketIds }) =>
                        fetch(`/api/team/members/${member.id}/buckets`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            bucketIds: [
                              ...member.bucketAccess.map((ba) => ba.bucketId),
                              ...newBucketIds,
                            ],
                          }),
                        })
                      )
                    )
                    const failed = results.filter((r) => r.status === 'rejected').length
                    if (failed === 0) {
                      toast({ title: 'Access granted to all affected members' })
                    } else {
                      toast({
                        variant: 'destructive',
                        title: `Partial failure: ${failed} of ${results.length} member(s) could not be granted access`,
                      })
                    }
                  }}
                >
                  Grant Access
                </ToastAction>
              ),
            })
          }
        } catch {
          // Non-critical: silently ignore notification errors
        }
      }

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

      {/* Appearance Section */}
      <div className="glass-card mb-10 animate-slide-up">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
            <Palette size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">Appearance</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Customize your portal theme and color mode</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mb-8">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Color Mode</p>
          <div className="flex p-1 bg-muted/50 border border-border rounded-2xl w-fit">
            <button
              onClick={() => handleModeChange('dark')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeMode === 'dark'
                  ? 'bg-brand text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon size={14} />
              Dark
            </button>
            <button
              onClick={() => handleModeChange('light')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeMode === 'light'
                  ? 'bg-brand text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun size={14} />
              Light
            </button>
          </div>
        </div>

        {/* Theme Grid */}
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {THEMES.map((t) => {
              const isActive = activeTheme === t.id
              const bg = activeMode === 'dark' ? t.darkBg : t.lightBg
              const accent = activeMode === 'dark' ? t.darkAccent : t.lightAccent
              return (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className={`relative rounded-2xl p-3 border-2 transition-all duration-300 text-left ${
                    isActive
                      ? 'border-brand shadow-lg shadow-brand/20 scale-[1.02]'
                      : 'border-border hover:border-brand/40'
                  }`}
                >
                  <div
                    className="h-12 w-full rounded-xl mb-2 relative overflow-hidden"
                    style={{ backgroundColor: bg }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: accent }}
                    />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground truncate">{t.label}</p>
                  <p className="text-[8px] text-muted-foreground truncate">{t.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {credentials.length === 0 ? (
        <div className="space-y-8">
          <div className="max-w-xl mx-auto glass-card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <ShieldCheck size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">New Credentials</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Link a new AWS environment</p>
              </div>
            </div>
            <CredentialForm onSuccess={fetchCredentials} />
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
      ) : (
        <div className="space-y-8 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground tracking-tight">Saved Connections</h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active infrastructure endpoints</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {credentials.map((credential) => (
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
              ))}

            <button
              type="button"
              onClick={() => setIsAddCredentialOpen(true)}
              className="group glass-card !p-0 overflow-hidden flex flex-col border-2 border-dashed border-border hover:border-primary hover:border-solid transition-all bg-muted/40 hover:bg-primary/5 cursor-pointer"
            >
              <div className="p-6 flex-1 min-h-[230px] flex flex-col items-center justify-center text-center">
                <PlusCircle size={40} className="mb-3 text-muted-foreground transition-colors group-hover:text-primary" />
                <p className="text-base font-bold text-muted-foreground">Add New</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Link AWS Environment</p>
              </div>
            </button>
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
      )}

      <Dialog open={isAddCredentialOpen} onOpenChange={setIsAddCredentialOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-card border-border text-foreground rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl font-black tracking-tight">New Credentials</DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              Link a new AWS environment
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 pb-8 pt-4 flex-1 overflow-y-auto">
            <CredentialForm
              onSuccess={() => {
                fetchCredentials()
                setIsAddCredentialOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingCredential}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCredential(null)
            setEditBuckets([])
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-card border-border text-foreground rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl font-black tracking-tight">Edit <span className="gradient-text">Connection</span></DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              Update endpoints and configuration for this integration.
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 pb-8 pt-4 flex-1 overflow-y-auto">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="h-11 px-8 rounded-xl bg-brand hover:bg-brand text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand/20"
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
