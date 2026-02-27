'use client'

import { useEffect, useState } from 'react'
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
import { Pencil, Trash2 } from 'lucide-react'

type Credential = {
  id: string
  name: string
  region: string
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

  useEffect(() => {
    fetchCredentials()
  }, [])

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
      .map((bucket) => ({
        bucket: bucket.bucket.trim(),
        cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
        cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
        cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
      }))
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
        .map((bucket) => ({
          id: bucket.id,
          bucket: bucket.bucket.trim(),
          cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
          cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
          cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
        }))
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
    <div className="max-w-4xl mx-auto py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">AWS Credentials</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add AWS Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCredentialSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Production bucket" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessKey">Access Key</Label>
                <Input
                  id="accessKey"
                  name="accessKey"
                  placeholder="AKIA..."
                  required
                  disabled={isSavingCredential}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretKey">Secret Access Key</Label>
                <Input
                  id="secretKey"
                  name="secretKey"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isSavingCredential}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" name="region" placeholder="ap-south-1" required />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Bucket(s)</Label>
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
                  >
                    Add Bucket
                  </Button>
                </div>
                {newBuckets.map((bucket, index) => (
                  <div key={`new-bucket-${index}`} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`bucket-${index}`}>Bucket Name</Label>
                      {newBuckets.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setNewBuckets((prev) => prev.filter((_, idx) => idx !== index))
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      id={`bucket-${index}`}
                      placeholder="my-bucket"
                      value={bucket.bucket}
                      onChange={(event) =>
                        setNewBuckets((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, bucket: event.target.value } : item
                          )
                        )
                      }
                      required={index === 0}
                    />
                    <div className="space-y-2">
                      <Label htmlFor={`cdn-domain-${index}`}>CloudFront Domain (optional)</Label>
                      <Input
                        id={`cdn-domain-${index}`}
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
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`cdn-keypair-${index}`}>Key Pair ID (optional)</Label>
                        <Input
                          id={`cdn-keypair-${index}`}
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`cdn-private-${index}`}>Private Key (optional)</Label>
                        <Input
                          id={`cdn-private-${index}`}
                          type="password"
                          value={bucket.cloudfrontPrivateKey}
                          onChange={(event) =>
                            setNewBuckets((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? { ...item, cloudfrontPrivateKey: event.target.value }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="submit" disabled={isSavingCredential}>
                {isSavingCredential ? 'Saving...' : 'Save Credentials'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credentials yet.</p>
            ) : (
              credentials.map((credential) => (
                <div key={credential.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div>
                    <div className="font-medium">{credential.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(credential.buckets.length > 0
                        ? `${credential.buckets[0].bucket}${
                            credential.buckets.length > 1
                              ? ` +${credential.buckets.length - 1}`
                              : ''
                          }`
                        : 'No buckets')}{' '}
                      • {credential.region}
                    </div>
                    {credential.buckets.some((bucket) => bucket.cloudfrontDomain) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        CDN configured for {credential.buckets.filter((bucket) => bucket.cloudfrontDomain).length}{' '}
                        bucket{credential.buckets.filter((bucket) => bucket.cloudfrontDomain).length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingCredential(credential)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCredential(credential.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit AWS Credentials</DialogTitle>
            <DialogDescription>
              Update bucket, region, or CDN settings. Leave access key and secret empty to keep them unchanged.
            </DialogDescription>
          </DialogHeader>
          {editingCredential && (
            <form onSubmit={handleUpdateCredential} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  name="editName"
                  defaultValue={editingCredential.name}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editRegion">Region</Label>
                  <Input
                    id="editRegion"
                    name="editRegion"
                    defaultValue={editingCredential.region}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editAccessKey">Access Key (optional)</Label>
                  <Input id="editAccessKey" name="editAccessKey" placeholder="AKIA..." autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSecretKey">Secret Access Key (optional)</Label>
                  <Input id="editSecretKey" name="editSecretKey" type="password" placeholder="••••••••" autoComplete="new-password" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Bucket(s)</Label>
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
                  >
                    Add Bucket
                  </Button>
                </div>
                {editBuckets.map((bucket, index) => (
                  <div key={`edit-bucket-${bucket.id || index}`} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`edit-bucket-${index}`}>Bucket Name</Label>
                      {!bucket.id && editBuckets.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditBuckets((prev) => prev.filter((_, idx) => idx !== index))
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      id={`edit-bucket-${index}`}
                      value={bucket.bucket}
                      onChange={(event) =>
                        setEditBuckets((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, bucket: event.target.value } : item
                          )
                        )
                      }
                      required={index === 0}
                    />
                    <div className="space-y-2">
                      <Label htmlFor={`edit-cdn-domain-${index}`}>CloudFront Domain (optional)</Label>
                      <Input
                        id={`edit-cdn-domain-${index}`}
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
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-cdn-keypair-${index}`}>Key Pair ID (optional)</Label>
                        <Input
                          id={`edit-cdn-keypair-${index}`}
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-cdn-private-${index}`}>Private Key (optional)</Label>
                        <Input
                          id={`edit-cdn-private-${index}`}
                          type="password"
                          value={bucket.cloudfrontPrivateKey}
                          onChange={(event) =>
                            setEditBuckets((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? { ...item, cloudfrontPrivateKey: event.target.value }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingCredential(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingCredential}>
                  {isUpdatingCredential ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
