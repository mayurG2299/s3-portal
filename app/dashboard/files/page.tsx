'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, Trash2, Share2, Folder, Tag, Star, RefreshCw, Eye } from 'lucide-react'
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
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import FilePreviewModal from '@/components/file-preview-modal'
import { getPreviewType } from '@/lib/preview-utils'

interface Bucket {
  id: string
  bucket: string
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
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedCredential, setSelectedCredential] = useState<string>('')
  const [selectedBucket, setSelectedBucket] = useState<string>('')
  const [files, setFiles] = useState<StoredFile[]>([])
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
  const [searchQuery, setSearchQuery] = useState('')
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
  const [shareSettings, setShareSettings] = useState({
    expiryMode: 'preset' as 'preset' | 'custom',
    expiresIn: '86400',
    customExpiry: '',
    password: '',
    maxDownloads: '',
    previewOnly: false,
    allowPreview: true,
  })
  const [currentPath, setCurrentPath] = useState('/')

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await fetch('/api/credentials')
      if (response.ok) {
        const data = await response.json()
        setCredentials(data)
        if (data.length > 0 && !selectedCredential) {
          setSelectedCredential(data[0].id)
          setSelectedBucket(data[0].buckets?.[0]?.id || '')
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch credentials',
      })
    }
  }, [selectedCredential])

  const fetchFiles = useCallback(async () => {
    try {
      if (!selectedBucket) {
        setFiles([])
        return
      }
      const action = viewMode === 'favorites' ? 'favorites' : viewMode === 'recents' ? 'recents' : 'list'
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bucketId: selectedBucket,
          prefix: currentPath === '/' ? '' : currentPath,
          tag: tagFilter.trim() || undefined,
          query: searchQuery.trim() || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }

      const data = await response.json()
      setFiles(data.objects || [])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch files',
      })
      setFiles([])
    }
  }, [selectedBucket, currentPath, tagFilter, searchQuery, viewMode])

  const isFolder = useCallback((file: StoredFile) => {
    return file.key.endsWith('/') || file.contentType === 'application/x-directory'
  }, [])

  // lazy import preview type util in client component
  // import at top-level to classify which files can be previewed
  // getPreviewType is a pure function

  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  useEffect(() => {
    if (selectedBucket) {
      fetchFiles()
    }
  }, [selectedBucket, currentPath, tagFilter, searchQuery, viewMode, fetchFiles])

  useEffect(() => {
    if (!selectedCredential) {
      setSelectedBucket('')
      return
    }

    const credential = credentials.find((item) => item.id === selectedCredential)
    if (!credential || credential.buckets.length === 0) {
      setSelectedBucket('')
      return
    }

    const isValid = credential.buckets.some((bucket) => bucket.id === selectedBucket)
    if (!isValid) {
      setSelectedBucket(credential.buckets[0].id)
    }
  }, [credentials, selectedCredential, selectedBucket])

  useEffect(() => {
    setSelectedFileIds([])
    setShareTargets([])
  }, [selectedBucket, currentPath])

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
    if (!selectedBucket) {
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
      return results.filter((r) => r !== null) as Array<{ ETag: string; PartNumber: number }>
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
              bucketId: selectedBucket,
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
              bucketId: selectedBucket,
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
                bucketId: selectedBucket,
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
              bucketId: selectedBucket,
              key,
              uploadId,
              fileId,
              parts: uploadedParts,
            }),
          })
          if (!completeRes.ok) throw new Error('Failed to complete multipart upload')
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
            `${file.name}: CORS configuration missing on S3 bucket. ` +
            `Please configure CORS on your S3 bucket to allow uploads from this domain. ` +
            `See docs/S3-CORS-SETUP.md for instructions.`
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
      expiresIn,
      password: shareSettings.password || undefined,
      maxDownloads: shareSettings.maxDownloads
        ? Number(shareSettings.maxDownloads)
        : undefined,
      allowDownload: !shareSettings.previewOnly,
      allowPreview: shareSettings.allowPreview,
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

  async function handleCreateFolder() {
    if (!selectedBucket) return
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
          bucketId: selectedBucket,
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

  const activeCredential = credentials.find((item) => item.id === selectedCredential)
  const availableBuckets = activeCredential?.buckets || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Files</h1>
            <div className="flex items-center gap-4">
              <Select value={selectedCredential} onValueChange={setSelectedCredential}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select credential" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedBucket}
                onValueChange={setSelectedBucket}
                disabled={!selectedCredential || availableBuckets.length === 0}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select bucket" />
                </SelectTrigger>
                <SelectContent>
                  {availableBuckets.map((bucket) => (
                    <SelectItem key={bucket.id} value={bucket.id}>
                      {bucket.bucket}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setIsUploadOpen(true)} disabled={!selectedBucket}>
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
                disabled={!selectedBucket || selectedFileIds.length === 0}
                variant="secondary"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Selected
              </Button>
              <Button onClick={() => setIsFolderDialogOpen(true)} disabled={!selectedBucket} variant="outline">
                <Folder className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={!selectedBucket || isRefreshing}
                variant="outline"
              >
                <RefreshCw className={isRefreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
                {isRefreshing ? 'Refreshing' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Breadcrumb navigation */}
          {selectedBucket && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              {getBreadcrumbs().map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400">/</span>}
                  <button
                    onClick={() => setCurrentPath(crumb.path)}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('all')}
            >
              All
            </Button>
            <Button
              variant={viewMode === 'favorites' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('favorites')}
            >
              Favorites
            </Button>
            <Button
              variant={viewMode === 'recents' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('recents')}
            >
              Recents
            </Button>
          </div>
          <Input
            placeholder="Filter by tag"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="Search files"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="max-w-xs"
          />
          {tagFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTagFilter('')}>
              Clear
            </Button>
          )}
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          )}
        </div>
        {!selectedBucket ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500">
              Please select a credential and bucket to browse files
            </p>
          </Card>
        ) : files.length === 0 ? (
            <Card className="p-12 text-center">
              <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No files yet</p>
              <Button onClick={() => setIsUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
            </Button>
            </Card>
        ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <Card key={file.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          aria-label={`Select ${file.name}`}
                          checked={selectedFileIds.includes(file.id)}
                          disabled={isFolder(file)}
                          onCheckedChange={(checked) => {
                            if (isFolder(file)) return
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
                          <p className="text-sm text-gray-500">
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
                                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
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
                onChange={(event) => setUploadTags(event.target.value)}
                placeholder="invoice, january, finance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-description">Description (optional)</Label>
              <Input
                id="upload-description"
                value={uploadDescription}
                onChange={(event) => setUploadDescription(event.target.value)}
                placeholder="Short note about these files"
              />
            </div>
          </div>
          <FileUpload onUpload={handleUpload} onAbort={handleAbort} />
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
          <div className="space-y-6">
            {shareTargets.length > 1 && (
              <Card className="p-3 text-sm text-gray-600">
                {shareTargets.slice(0, 3).map((file) => file.name).join(', ')}
                {shareTargets.length > 3 && ` +${shareTargets.length - 3} more`}
              </Card>
            )}

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
                    variant={
                      shareSettings.expiryMode === 'preset' && shareSettings.expiresIn === option.value
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() =>
                      setShareSettings((prev) => ({
                        ...prev,
                        expiryMode: 'preset',
                        expiresIn: option.value,
                      }))
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={shareSettings.expiryMode === 'custom'}
                  onCheckedChange={(checked) =>
                    setShareSettings((prev) => ({
                      ...prev,
                      expiryMode: checked === true ? 'custom' : 'preset',
                    }))
                  }
                  id="custom-expiry-toggle"
                />
                <Label htmlFor="custom-expiry-toggle" className="text-sm text-gray-600">
                  Use custom expiration date/time
                </Label>
              </div>
              {shareSettings.expiryMode === 'custom' && (
                <Input
                  type="datetime-local"
                  value={shareSettings.customExpiry}
                  onChange={(e) =>
                    setShareSettings((prev) => ({ ...prev, customExpiry: e.target.value }))
                  }
                />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={shareSettings.password}
                  onChange={(e) =>
                    setShareSettings((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Set a password to protect access"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-downloads">Max downloads (optional)</Label>
                <Input
                  id="max-downloads"
                  type="number"
                  min={1}
                  value={shareSettings.maxDownloads}
                  onChange={(e) =>
                    setShareSettings((prev) => ({ ...prev, maxDownloads: e.target.value }))
                  }
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="preview-only"
                  checked={shareSettings.previewOnly}
                  onCheckedChange={(checked) =>
                    setShareSettings((prev) => ({ ...prev, previewOnly: Boolean(checked) }))
                  }
                />
                <Label htmlFor="preview-only" className="text-sm">
                  Preview only (disable downloads)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allow-preview"
                  checked={shareSettings.allowPreview}
                  onCheckedChange={(checked) =>
                    setShareSettings((prev) => ({ ...prev, allowPreview: Boolean(checked) }))
                  }
                />
                <Label htmlFor="allow-preview" className="text-sm">
                  Allow preview
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsShareOpen(false)
                  setShareTargets([])
                }}
                disabled={isSharing}
              >
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={isSharing || shareTargets.length === 0}>
                {isSharing ? 'Generating…' : 'Generate link'}
              </Button>
            </div>
          </div>
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
    </div>
  )
}
