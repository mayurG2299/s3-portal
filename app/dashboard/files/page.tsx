'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Upload, Download, Trash2, Share2, Folder, Tag, Star, RefreshCw, Eye, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FileUpload } from '@/components/file-upload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'
import FilePreviewModal from '@/components/file-preview-modal'
import DirectLinkModal from '@/components/DirectLinkModal'
import { getPreviewType } from '@/lib/preview-utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'

interface Bucket {
  id: string
  bucket: string
  cloudfrontDomain?: string | null
}

interface Credential {
  id: string
  name: string
  buckets: Bucket[]
}

interface StoredFile {
  id: string
  name: string
  size: string
  contentType?: string
  createdAt: string
  key: string
  tags?: string[]
  isFavorite?: boolean
  description?: string | null
}
export default function FilesPage() {
  const { selectedIdentityId, selectedBucketId } = useDashboard()
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderTags, setNewFolderTags] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [shareTargets, setShareTargets] = useState<StoredFile[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [isSharing, setIsSharing] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const searchParams = useSearchParams()
  const searchQuery = (searchParams.get('q') || '').trim()
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'recents'>('all')
  const [editingTagsFile, setEditingTagsFile] = useState<StoredFile | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [uploadTags, setUploadTags] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDirectLinkOpen, setIsDirectLinkOpen] = useState(false)
  const [directLinkFile, setDirectLinkFile] = useState<StoredFile | null>(null)

  // CDN Configuration Modal State
  const [isCdnDialogOpen, setIsCdnDialogOpen] = useState(false)
  const [cdnConfig, setCdnConfig] = useState({
    cloudfrontDomain: '',
    cloudfrontKeyPairId: '',
    cloudfrontPrivateKey: '',
  })
  const [isSavingCdn, setIsSavingCdn] = useState(false)

  const [shareSettings, setShareSettings] = useState({
    linkMode: 'preview' as 'preview' | 'download' | 'direct' | 'raw',
    expiryMode: 'preset' as 'preset' | 'custom' | 'never',
    expiresIn: '86400',
    customExpiry: '',
    password: '',
    maxDownloads: '',
    previewOnly: false,
    allowPreview: true,
  })
  const [currentPath, setCurrentPath] = useState('/')
  const appliedPathFromUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const rawPath = searchParams.get('path')
    if (!rawPath) {
      return
    }

    const trimmed = rawPath.trim()
    const withoutEdgeSlashes = trimmed.replace(/^\/+|\/+$/g, '')
    const normalizedPath = withoutEdgeSlashes ? `/${withoutEdgeSlashes}/` : '/'

    if (appliedPathFromUrlRef.current === normalizedPath) {
      return
    }

    appliedPathFromUrlRef.current = normalizedPath
    setCurrentPath(normalizedPath)
  }, [searchParams])

  const fetchFiles = useCallback(async () => {
    try {
      if (!selectedBucketId) {
        setFiles([])
        setLoadError(null)
        return
      }
      setIsRefreshing(true)
      setLoadError(null)
      const action = viewMode === 'favorites' ? 'favorites' : viewMode === 'recents' ? 'recents' : 'list'
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bucketId: selectedBucketId,
          prefix: currentPath === '/' ? '' : currentPath,
          tag: tagFilter.trim() || undefined,
          query: searchQuery.trim().length >= 3 ? searchQuery.trim() : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || 'Failed to load files from storage'
        setLoadError(errorMessage)
        setFiles([])
        return
      }

      const data = await response.json()
      setFiles(data.objects || [])
      setLoadError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load files from storage. Please check your connection and try again.'
      setLoadError(message)
      setFiles([])
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedBucketId, currentPath, tagFilter, searchQuery, viewMode])

  const isFolder = useCallback((file: StoredFile) => {
    return file.key.endsWith('/') || file.contentType === 'application/x-directory'
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  useEffect(() => {
    setSelectedFileIds([])
    setShareTargets([])
  }, [selectedBucketId, currentPath])

  useEffect(() => {
    if (editingTagsFile) {
      setTagInput((editingTagsFile.tags || []).join(', '))
      setDescriptionInput(editingTagsFile.description || '')
    } else {
      setTagInput('')
      setDescriptionInput('')
    }
  }, [editingTagsFile])

  useEffect(() => {
    if (!isUploadOpen) {
      setUploadTags('')
      setUploadDescription('')
    }
  }, [isUploadOpen])


  async function handleUpload(uploadFiles: File[], onProgress?: (fileIndex: number, progress: number) => void) {
    if (!selectedBucketId) {
      throw new Error('Select a bucket before uploading')
    }

    const tags = uploadTags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    const description = uploadDescription.trim() || undefined
    const MULTIPART_THRESHOLD = 50 * 1024 * 1024 // 50MB
    const PART_SIZE = 10 * 1024 * 1024 // 10MB
    const MAX_CONCURRENT_PARTS = 3

    const uploadAbortControllers = new Map<string, AbortController>()

    const uploadPart = async (
      key: string,
      uploadId: string,
      partNumber: number,
      blobPart: Blob,
      url: string
    ): Promise<{ ETag: string; PartNumber: number }> => {
      try {
        const partUpload = await fetch(url, {
          method: 'PUT',
          body: blobPart,
          signal: uploadAbortControllers.get(key)?.signal,
        })
        if (!partUpload.ok) {
          throw new Error(`Part ${partNumber} upload failed with status ${partUpload.status}`)
        }
        const etag = partUpload.headers.get('ETag') || ''
        if (!etag) {
          throw new Error(
            `Part ${partNumber} uploaded but ETag header is not readable. ` +
            `Update bucket CORS to expose ETag (Access-Control-Expose-Headers: ETag).`
          )
        }
        return { ETag: etag.replace(/"/g, ''), PartNumber: partNumber }
      } catch (error: any) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          throw new Error('CORS configuration error - check S3 bucket CORS settings')
        }
        throw error
      }
    }

    const uploadWithConcurrency = async (
      parts: Array<{ partNumber: number; blobPart: Blob; url: string }>,
      uploadId: string,
      key: string
    ): Promise<Array<{ ETag: string; PartNumber: number }>> => {
      const results: Array<{ ETag: string; PartNumber: number } | null> = new Array(parts.length).fill(null)
      let index = 0

      const worker = async () => {
        while (index < parts.length) {
          const currentIndex = index++
          const part = parts[currentIndex]
          try {
            results[currentIndex] = await uploadPart(key, uploadId, part.partNumber, part.blobPart, part.url)
          } catch (error) {
            throw error
          }
        }
      }

      const workers = Array(Math.min(MAX_CONCURRENT_PARTS, parts.length)).fill(null).map(() => worker())
      await Promise.all(workers)
      
      // Filter nulls and sort by PartNumber (required by AWS S3)
      const uploadedParts = results
        .filter((r) => r !== null) as Array<{ ETag: string; PartNumber: number }>
      
      if (uploadedParts.length !== parts.length) {
        throw new Error(`Only ${uploadedParts.length}/${parts.length} parts uploaded successfully`)
      }
      
      return uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
    }

    for (let fileIndex = 0; fileIndex < uploadFiles.length; fileIndex++) {
      const file = uploadFiles[fileIndex]
      const progressKey = `${file.name}-${fileIndex}`
      uploadAbortControllers.set(progressKey, new AbortController())

      try {
        if (file.size < MULTIPART_THRESHOLD) {
          // Simple PUT upload
          const response = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upload',
              bucketId: selectedBucketId,
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              path: currentPath,
              tags,
              description,
            }),
          })

          if (!response.ok) throw new Error('Failed to get upload URL')
          const { url, fileId } = await response.json()

          try {
            const uploadResponse = await fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
              signal: uploadAbortControllers.get(progressKey)?.signal,
            })
            if (!uploadResponse.ok) {
              throw new Error(`Upload failed with status ${uploadResponse.status}`)
            }

            // Verify upload with server to ensure metadata and quota are correct
            try {
              if (fileId) {
                await fetch('/api/files/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId }),
                })
              }
            } catch (err) {
              console.error('Post-upload verification failed:', err)
            }
          } catch (error: any) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
              throw new Error('CORS configuration error - check S3 bucket CORS settings')
            }
            throw error
          }
          onProgress?.(fileIndex, 100)
        } else {
          // Multipart upload
          const initRes = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'multipartInit',
              bucketId: selectedBucketId,
              fileName: file.name,
              contentType: file.type,
              path: currentPath,
              tags,
              description,
            }),
          })
          if (!initRes.ok) throw new Error('Failed to init multipart upload')
          const { uploadId, key, fileId } = await initRes.json()

          const totalParts = Math.ceil(file.size / PART_SIZE)
          const parts: Array<{ partNumber: number; blobPart: Blob; url: string }> = []

          // Pre-presign all parts
          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * PART_SIZE
            const end = Math.min(start + PART_SIZE, file.size)
            const blobPart = file.slice(start, end)

            const presignRes = await fetch('/api/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'multipartPresign',
                bucketId: selectedBucketId,
                key,
                uploadId,
                partNumber,
              }),
            })
            if (!presignRes.ok) throw new Error('Failed to presign part')
            const { url } = await presignRes.json()
            parts.push({ partNumber, blobPart, url })
            onProgress?.(fileIndex, (partNumber / totalParts) * 50) // 0-50% for presigning
          }

          // Upload parts in parallel with concurrency limit
          const uploadedParts = await uploadWithConcurrency(parts, uploadId, key)
          onProgress?.(fileIndex, 90)

          const completeRes = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'multipartComplete',
              bucketId: selectedBucketId,
              key,
              uploadId,
              fileId,
              parts: uploadedParts,
            }),
          })
          if (!completeRes.ok) {
            const errorData = await completeRes.json().catch(() => ({ message: 'Unknown error' }))
            throw new Error(`Multipart completion failed: ${errorData.message || 'Unknown error'} (Status: ${completeRes.status})`)
          }
          onProgress?.(fileIndex, 100)
        }
      } catch (error: any) {
        // Abort on error: delete incomplete upload if multipart
        uploadAbortControllers.delete(progressKey)
        
        // Detect CORS errors
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError') ||
            error.message.includes('CORS')) {
          throw new Error(
            `${file.name}: CORS configuration is missing or incorrect on the S3 bucket. ` +
            `Please ensure your bucket settings allow uploads from this domain.`
          )
        }
        
        throw new Error(`Failed to upload ${file.name}: ${error.message}`)
      }
    }

    toast({
      title: 'Success!',
      description: `${uploadFiles.length} file(s) uploaded`,
    })

    setIsUploadOpen(false)
    fetchFiles()
  }

  const handleAbort = async (fileIndex: number) => {
    // Stub for abort handling - can be extended to cancel partial multipart uploads
    console.log(`Upload ${fileIndex} aborted by user`)
  }

  async function handleDelete(file: StoredFile) {
    if (!confirm(`Delete ${file.name}?`)) return

    try {
      const response = await fetch(`/api/files?id=${file.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast({
        title: 'Success',
        description: 'File deleted',
      })

      fetchFiles()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    }
  }

  function resolveExpirySeconds() {
    if (shareSettings.expiryMode === 'preset') {
      return Number(shareSettings.expiresIn)
    }

    if (!shareSettings.customExpiry) return null
    const customDate = new Date(shareSettings.customExpiry)
    const seconds = Math.floor((customDate.getTime() - Date.now()) / 1000)
    return seconds > 0 ? seconds : null
  }

  async function handleShare() {
    if (shareTargets.length === 0) return

    const expiresIn = resolveExpirySeconds()

    if (!expiresIn) {
      toast({
        variant: 'destructive',
        title: 'Invalid expiry',
        description: 'Choose a preset or pick a future date/time',
      })
      return
    }

    setIsSharing(true)

    const payloadBase = {
      type: 'PRESIGNED',
      expiresIn: expiresIn || undefined,
      mode: shareSettings.linkMode,
      password: shareSettings.password || undefined,
      maxDownloads: shareSettings.maxDownloads
        ? Number(shareSettings.maxDownloads)
        : undefined,
      allowDownload: shareSettings.linkMode !== 'preview',
      allowPreview: shareSettings.allowPreview ?? true,
    }

    try {
      const results = await Promise.allSettled(
        shareTargets.map(async (file) => {
          const response = await fetch('/api/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payloadBase, fileId: file.id }),
          })

          if (!response.ok) {
            const message = (await response.json())?.message || 'Failed to create link'
            throw new Error(message)
          }

          return response.json()
        })
      )

      const successes = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[]
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

      if (successes.length) {
        const urls = successes.map((r) => r.value.url).filter(Boolean)
        if (urls.length) {
          await navigator.clipboard.writeText(urls.join('\n'))
        }

        toast({
          title: 'Link ready',
          description:
            successes.length === 1
              ? 'Share link copied to clipboard'
              : `${successes.length} links created and copied to clipboard`,
        })
      }

      if (failures.length) {
        toast({
          variant: 'destructive',
          title: 'Some links failed',
          description: failures[0].reason?.message || 'Unable to create one or more links',
        })
      }

      setIsShareOpen(false)
      setShareTargets([])
      setSelectedFileIds([])
      setShareSettings((prev) => ({ ...prev, password: '', maxDownloads: '' }))
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsSharing(false)
    }
  }

  async function handleSaveCdn(e: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedBucketId) return

    setIsSavingCdn(true)
    try {
      const response = await fetch('/api/credentials/cdn', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketId: selectedBucketId,
          ...cdnConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save CDN configuration')
      }

      toast({
        title: 'Success',
        description: 'CDN successfully attached to bucket',
      })

      // Close modal, clear form, and refresh credentials to instantly unlock CDN URL
      setIsCdnDialogOpen(false)
      setCdnConfig({ cloudfrontDomain: '', cloudfrontKeyPairId: '', cloudfrontPrivateKey: '' })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsSavingCdn(false)
    }
  }

  async function handleCreateFolder() {
    if (!selectedBucketId) return
    if (!newFolderName.trim()) return

    const tags = newFolderTags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFolder',
          bucketId: selectedBucketId,
          path: currentPath,
          folderName: newFolderName.trim(),
          tags,
          description: newFolderDescription.trim() || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create folder')
      }

      toast({
        title: 'Success',
        description: 'Folder created successfully',
      })

      setIsFolderDialogOpen(false)
      setNewFolderName('')
      setNewFolderTags('')
      setNewFolderDescription('')
      fetchFiles()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    }
  }

  function navigateToFolder(folderPath: string) {
    setCurrentPath(folderPath)
  }

  function navigateUp() {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.length ? '/' + parts.join('/') + '/' : '/')
  }

  function getBreadcrumbs() {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }]
    const parts = currentPath.split('/').filter(Boolean)
    return [
      { name: 'Root', path: '/' },
      ...parts.map((part, index) => ({
        name: part,
        path: '/' + parts.slice(0, index + 1).join('/') + '/',
      })),
    ]
  }

  async function handleSaveTags() {
    if (!editingTagsFile) return

    const tags = tagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    setIsSavingTags(true)
    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateTags',
          id: editingTagsFile.id,
          tags,
          description: descriptionInput.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update tags')
      }

      toast({
        title: 'Success',
        description: 'Tags updated',
      })

      setEditingTagsFile(null)
      fetchFiles()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleToggleFavorite(file: StoredFile) {
    if (isFolder(file)) return

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleFavorite',
          id: file.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update favorite')
      }

      fetchFiles()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await fetchFiles()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mb-8">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Files</h1>
            {selectedBucketId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                {getBreadcrumbs().map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center gap-2">
                    {index > 0 && <span>/</span>}
                    <button
                      onClick={() => setCurrentPath(crumb.path)}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setIsUploadOpen(true)} disabled={!selectedBucketId}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button
                onClick={() => {
                  const targets = files.filter(
                    (file) => selectedFileIds.includes(file.id) && !isFolder(file)
                  )
                  if (targets.length === 0) return
                  setShareTargets(targets)
                  setIsShareOpen(true)
                }}
              disabled={!selectedBucketId || selectedFileIds.length === 0}
                variant="secondary"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Selected
              </Button>
            <Button onClick={() => setIsFolderDialogOpen(true)} disabled={!selectedBucketId} variant="outline">
                <Folder className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <Button
                onClick={handleRefresh}
              disabled={!selectedBucketId || isRefreshing}
                variant="outline"
              >
                <RefreshCw className={isRefreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh
              </Button>
            </div>
        </div>
      </header>

      <main>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border">
            <Button
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('all')}
              className={viewMode === 'all' ? 'shadow-sm' : ''}
            >
              All
            </Button>
            <Button
              variant={viewMode === 'favorites' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('favorites')}
              className={viewMode === 'favorites' ? 'shadow-sm' : ''}
            >
              Favorites
            </Button>
            <Button
              variant={viewMode === 'recents' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('recents')}
              className={viewMode === 'recents' ? 'shadow-sm' : ''}
            >
              Recents
            </Button>
          </div>
          <Input
            placeholder="Filter by tag"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="max-w-xs"
            autoComplete="new-password"
          />
          {tagFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTagFilter('')}>
              Clear
            </Button>
          )}
        </div>
        {!selectedBucketId ? (
          <Card className="p-12 text-center bg-muted/30 border-border">
            <p className="text-muted-foreground">
              Please select your AWS Credentials and Storage Bucket in the header to browse files
            </p>
          </Card>
        ) : loadError ? (
          <Card className="p-12 text-center bg-destructive/10 border-destructive/30">
            <Folder className="mx-auto h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-medium mb-2">Unable to load files</p>
            <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
            <Button onClick={() => fetchFiles()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </Card>
          ) : files.length === 0 && !isRefreshing ? (
            <Card className="p-12 text-center bg-muted/30 border-border">
              <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery.trim().length >= 3 ? `No results found for "${searchQuery}"` : 'No files yet'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsUploadOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Button>
                )}
            </Card>
        ) : (
                <div className={cn("space-y-2 transition-opacity duration-200", isRefreshing && "opacity-50 pointer-events-none")}>
                  {files.length === 0 && isRefreshing && (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/10 rounded-xl border border-dashed border-border">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary/40 mb-3" />
                      <p className="text-sm text-muted-foreground animate-pulse">Syncing files...</p>
                    </div>
                  )}
                  {files.map((file) => (
                  <Card key={file.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          aria-label={`Select ${file.name}`}
                          checked={selectedFileIds.includes(file.id)}
                          onCheckedChange={(checked) => {
                            setSelectedFileIds((prev) => {
                              if (checked === true) return [...prev, file.id]
                              return prev.filter((id) => id !== file.id)
                            })
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            {isFolder(file) && <Folder className="h-4 w-4 text-blue-600" />}
                            <button
                              type="button"
                              onClick={() => {
                                if (isFolder(file)) {
                                  navigateToFolder(`${currentPath}${file.name}/`)
                                }
                              }}
                              className={
                                isFolder(file)
                                  ? 'font-medium text-blue-700 hover:underline'
                                  : 'font-medium'
                              }
                            >
                              {file.name}
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {isFolder(file)
                              ? 'Folder'
                              : `${formatFileSize(Number(file.size))} • ${formatRelativeTime(
                                new Date(file.createdAt)
                              )}`}
                          </p>
                          {file.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {file.description}
                            </p>
                          )}
                          {!!file.tags?.length && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {file.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium dark:text-primary-foreground/90 backdrop-blur-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                    {!isFolder(file) && (
                      <Button
                        variant="ghost"
                            size="sm"
                        onClick={() => handleToggleFavorite(file)}
                      >
                            <Star
                              className={
                                file.isFavorite
                                  ? 'h-4 w-4 text-yellow-500'
                                  : 'h-4 w-4 text-gray-400'
                              }
                            />
                      </Button>
                    )}
                        {/* Preview button remains for non-direct mode */}
                    {!isFolder(file) && (() => {
                      const t = getPreviewType(file.contentType, file.name)
                      if (t !== 'UNSUPPORTED') {
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewFile(file)
                              setIsPreviewOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )
                      }
                      return null
                    })()}
                        {/* Direct S3/CDN link button */}
                        {!isFolder(file) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsShareOpen(false)
                              setShareTargets([])
                              setDirectLinkFile(file)
                              setIsDirectLinkOpen(true)
                            }}
                          >
                            <Database className="h-4 w-4" />
                          </Button>
                        )}
                    <Button
                      variant="ghost"
                          size="sm"
                      onClick={() => setEditingTagsFile(file)}
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                    {!isFolder(file) && (
                      <Button
                        variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDirectLinkFile(null)
                              setIsDirectLinkOpen(false)
                              setShareTargets([file])
                              setIsShareOpen(true)
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                          size="sm"
                      onClick={() => handleDelete(file)}
                    >
                          <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                  </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Files will be uploaded directly to your S3 bucket. Large files (50MB+) use parallel uploads for better performance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="upload-tags">Tags (optional)</Label>
              <Input
                id="upload-tags"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="marketing, assets"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-description">Description (optional)</Label>
              <Input
                id="upload-description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Short note about these files"
              />
            </div>
            <FileUpload
              onUpload={async (files, onProgress) => {
                try {
                  await handleUpload(files, onProgress)
                  setIsUploadOpen(false)
                  setUploadTags('')
                  setUploadDescription('')
                  fetchFiles()
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: error.message || 'Failed to upload files',
                  })
                  throw error
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isShareOpen}
        onOpenChange={(open) => {
          setIsShareOpen(open)
          if (!open) setShareTargets([])
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share File</DialogTitle>
            <DialogDescription>
              {shareTargets.length === 0
                ? 'Select at least one file to share'
                : `Generate a shareable link for ${shareTargets.length === 1 ? shareTargets[0].name : `${shareTargets.length} files`}`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleShare()
            }}
          >
            <div className="space-y-6">
              {shareTargets.length > 1 && (
                <Card className="p-3 text-sm text-muted-foreground bg-muted/50 border-border">
                  {shareTargets.slice(0, 3).map((file) => file.name).join(', ')}
                  {shareTargets.length > 3 && ` +${shareTargets.length - 3} more`}
                </Card>
              )}

              <div className="space-y-2">
                <Label>Link Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Preview Page', value: 'preview' },
                    { label: 'Auto Download', value: 'download' },
                    { label: 'Direct S3/CDN', value: 'direct' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={shareSettings.linkMode === option.value ? 'default' : 'outline'}
                      onClick={() => {
                        setShareSettings((prev) => ({
                          ...prev,
                          linkMode: option.value as 'preview' | 'download' | 'direct',
                        }))
                      }}
                      className="h-auto py-2 whitespace-normal text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expiration</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '1 hour', value: '3600' },
                    { label: '1 day', value: '86400' },
                    { label: '1 week', value: '604800' },
                    { label: '30 days', value: '2592000' },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        shareSettings.expiryMode === 'preset' && shareSettings.expiresIn === option.value
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => setShareSettings((prev) => ({ ...prev, expiryMode: 'preset', expiresIn: option.value }))}
                      className="h-auto py-2 whitespace-normal text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {shareSettings.linkMode !== 'direct' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="share-password">Password (optional)</Label>
                    <Input
                      id="share-password"
                      type="password"
                      value={shareSettings.password}
                      onChange={(e) => setShareSettings((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Set a password for this link"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="share-max-downloads">Download Limit (optional)</Label>
                    <Input
                      id="share-max-downloads"
                      type="number"
                      value={shareSettings.maxDownloads}
                      onChange={(e) => setShareSettings((prev) => ({ ...prev, maxDownloads: e.target.value }))}
                      placeholder="Max downloads allowed"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsShareOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSharing || shareTargets.length === 0}
                  className="btn-primary-gradient"
                >
                  {isSharing ? 'Generating...' : 'Generate Link'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {currentPath === '/' ? 'root' : currentPath}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folderTags">Tags (optional)</Label>
              <Input
                id="folderTags"
                value={newFolderTags}
                onChange={(e) => setNewFolderTags(e.target.value)}
                placeholder="marketing, assets"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folderDescription">Description (optional)</Label>
              <Input
                id="folderDescription"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Short note for this folder"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingTagsFile}
        onOpenChange={(open) => !open && setEditingTagsFile(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              Add tags and a short description to organize items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="invoice, january, finance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                placeholder="Short note about this item"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTagsFile(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTags} disabled={isSavingTags}>
                {isSavingTags ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewModal file={previewFile} open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} />
      {/* DirectLinkModal for permanent S3/CDN link */}
      {directLinkFile && isDirectLinkOpen && (
        <DirectLinkModal file={directLinkFile} open={isDirectLinkOpen} onClose={() => {
          setIsDirectLinkOpen(false)
          setDirectLinkFile(null)
        }} />
      )}
    </div>
  )
}
