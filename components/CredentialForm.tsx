"use client"

import { FormEvent, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { translateAWSError } from '@/lib/error-translator'

export interface BucketInput {
  id?: string
  bucket: string
  cloudfrontDomain?: string
  cloudfrontKeyPairId?: string
  cloudfrontPrivateKey?: string
}

export interface CredentialFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

export default function CredentialForm({ onSuccess, onCancel }: CredentialFormProps) {
  const [isSavingCredential, setIsSavingCredential] = useState(false)
  const [newBuckets, setNewBuckets] = useState<BucketInput[]>([
    { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
  ])
  const { data: session } = useSession()
  const activeTeamId = session?.user?.teamId

  async function handleCredentialSubmit(e: FormEvent<HTMLFormElement>) {
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
        const translated = translateAWSError(error.message || 'Unknown error')
        throw new Error(translated.message)
      }

      toast({
        title: 'Success',
        description: 'AWS credentials added successfully',
      })
      ;(e.target as HTMLFormElement).reset()
      setNewBuckets([
        { bucket: '', cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' },
      ])
      onSuccess()
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to add credentials'
      const translated = translateAWSError(errorMessage)
      toast({
        variant: 'destructive',
        title: 'Could not add credentials',
        description: translated.message,
      })
    } finally {
      setIsSavingCredential(false)
    }
  }

  return (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          className="w-full mt-2"
          onClick={onCancel}
        >
          Cancel
        </Button>
      )}
    </form>
  )
}
