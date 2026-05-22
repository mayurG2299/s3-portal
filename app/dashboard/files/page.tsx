'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Upload, Download, Trash2, Share2, Folder, FolderOpen, Tag, Star, RefreshCw, Eye, Database, Shield, ChevronDown } from 'lucide-react'
import { FilesActionBar } from '@/components/files/action-bar'
import { MobileFilesFAB } from '@/components/files/mobile-fab'
import { ShareModal, ShareLinkOptions } from '@/components/files/share-modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { useKeyboardNav } from '@/hooks/use-keyboard-nav'
import { useShortcutsModal } from '@/lib/contexts/shortcuts-modal-context'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'
import { getPreviewType } from '@/lib/preview-utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { useRBAC } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { FileChangedPayload } from '@/lib/events/types'
import { IndexingBadge, type IndexingStatus } from '@/components/dashboard/indexing-badge'

const FilePreviewModal = dynamic(() => import('@/components/file-preview-modal'), { ssr: false })
const DirectLinkModal = dynamic(() => import('@/components/DirectLinkModal'), { ssr: false })
const FileUpload = dynamic(() => import('@/components/file-upload').then(mod => ({ default: mod.FileUpload })), { ssr: false })

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
  const router = useRouter()
  const {
    selectedTeamId,
    selectedIdentityId,
    selectedBucketId,
    identities,
    isLoading: isDashboardLoading,
    setIdentity,
    setBucket,
    handleTeamAccessFailure,
  } = useDashboard()
  const { canViewScreen, loading, loadingScreenPermissions, screenPermissions, isAdmin } = useRBAC()
  const canAccessFiles = canViewScreen(SCREENS.FILES_LIST)
  const [files, setFiles] = useState<StoredFile[]>([])
  const [indexingStatuses, setIndexingStatuses] = useState<Record<string, IndexingStatus>>({})
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
  const pathname = usePathname()
  const searchQuery = (searchParams.get('q') || '').trim()
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'recents'>('all')
  const [editingTagsFile, setEditingTagsFile] = useState<StoredFile | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDownloadingFolder, setIsDownloadingFolder] = useState(false)
  const [uploadTags, setUploadTags] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDirectLinkOpen, setIsDirectLinkOpen] = useState(false)
  const [directLinkFile, setDirectLinkFile] = useState<StoredFile | null>(null)
  const { isShortcutsOpen } = useShortcutsModal()
  const [isTruncated, setIsTruncated] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; file: StoredFile | null }>({ open: false, file: null })
  // All useState hooks must be above the early return guard (Rules of Hooks)
  const [isCdnDialogOpen, setIsCdnDialogOpen] = useState(false)
  const [cdnConfig, setCdnConfig] = useState({
    cloudfrontDomain: '',
    cloudfrontKeyPairId: '',
    cloudfrontPrivateKey: '',
  })
  const [isSavingCdn, setIsSavingCdn] = useState(false)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [currentPath, setCurrentPath] = useState(() => searchParams.get('path') ?? '/')
  const [truncationDismissed, setTruncationDismissed] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiles, setTotalFiles] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 200
  const abortControllerRef = useRef<AbortController | null>(null)
  const uploadAbortControllers = useRef<Map<number, AbortController>>(new Map())
  const inFlightRequestKeyRef = useRef<string | null>(null)
  const lastEffectRequestKeyRef = useRef<string | null>(null)
  const fetchFilesRef = useRef<() => void>(() => {})
  const activeIdentity = identities.find((identity) => identity.id === selectedIdentityId)
  const availableBuckets = activeIdentity?.buckets || []

  const isAnyModalOpen =
    isUploadOpen || isShareOpen || isFolderDialogOpen ||
    !!editingTagsFile || isDirectLinkOpen || isCdnDialogOpen || isShortcutsOpen

  const { focusedIndex, itemRefs } = useKeyboardNav({
    files,
    isModalOpen: isAnyModalOpen,
    isPreviewOpen,
    onNavigateToFolder: (file) => navigateToFolder(`${currentPath}${file.name}/`),
    onNavigateUp: navigateUp,
    onPreview: (file) => {
      setPreviewFile(file as StoredFile)
      setIsPreviewOpen(true)
    },
    onClosePreview: () => setIsPreviewOpen(false),
    onDelete: (file) => handleDelete(file as StoredFile),
    onSelectAll: () => setSelectedFileIds(files.map((f) => f.id)),
    selectedFileIds,
    onSetSelectedFileIds: setSelectedFileIds,
    onFavorite: (file) => handleToggleFavorite(file as StoredFile),
    onDirectLink: (file) => { setDirectLinkFile(file as StoredFile); setIsDirectLinkOpen(true) },
    onShare: (file) => { setShareTargets([file as StoredFile]); setIsShareOpen(true) },
    onUpload: () => setIsUploadOpen(true),
    onNewFolder: () => setIsFolderDialogOpen(true),
  })

  useEffect(() => {
    const rawPath = searchParams.get('path')

    const trimmed = (rawPath || '').trim()
    const withoutEdgeSlashes = trimmed.replace(/^\/+|\/+$/g, '')
    const normalizedPath = withoutEdgeSlashes ? `/${withoutEdgeSlashes}/` : '/'

    setCurrentPath((prev) => {
      if (prev === normalizedPath) {
        return prev
      }

      setIsTruncated(false)
      setTruncationDismissed(false)
      return normalizedPath
    })
  }, [searchParams])


  const fetchFiles = useCallback(async () => {
    if (!selectedBucketId) {
      setFiles([])
      setLoadError(null)
      return
    }

    const action = viewMode === 'favorites' ? 'favorites' : viewMode === 'recents' ? 'recents' : 'list'
    const apiUrl = action === 'favorites' ? '/api/files/favorites' : action === 'recents' ? '/api/files/recents' : '/api/files'
    const requestPayload = {
      action,
      bucketId: selectedBucketId,
      prefix: currentPath === '/' ? '' : currentPath,
      tag: tagFilter.trim() || undefined,
      query: searchQuery.trim().length >= 3 ? searchQuery.trim() : undefined,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }
    const requestKey = JSON.stringify(requestPayload)

    if (inFlightRequestKeyRef.current === requestKey) {
      return
    }

    // Cancel any in-flight request before starting a new one.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    inFlightRequestKeyRef.current = requestKey

    try {
      setIsRefreshing(true)
      setLoadError(null)
      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      if (response.status === 403 || response.status === 404) {
        handleTeamAccessFailure(response.status)
        setFiles([])
        setLoadError(null)
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || 'Failed to load files from storage'
        setLoadError(errorMessage)
        setFiles([])
        return
      }

      const data = await response.json()
      setFiles(data.objects || [])
      setIsTruncated(data.isTruncated || false)
      setTruncationDismissed(false)
      setTotalFiles(data.totalFiles ?? 0)
      setTotalPages(data.totalPages ?? 1)
      setHasMore(data.hasMore ?? false)
      setLoadError(null)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const message = error instanceof Error ? error.message : 'Failed to load files from storage. Please check your connection and try again.'
      setLoadError(message)
      setFiles([])
    } finally {
      if (inFlightRequestKeyRef.current === requestKey) {
        inFlightRequestKeyRef.current = null
      }
      setIsRefreshing(false)
    }
  }, [selectedBucketId, currentPath, tagFilter, searchQuery, viewMode, currentPage, handleTeamAccessFailure])

  useEffect(() => { fetchFilesRef.current = fetchFiles }, [fetchFiles])

  const isFolder = useCallback((file: StoredFile) => {
    return file.key.endsWith('/') || file.contentType === 'application/x-directory'
  }, [])

  const currentFolderSummary = useMemo(() => {
    const foldersCount = files.filter((file) => isFolder(file)).length
    const regularFiles = files.filter((file) => !isFolder(file))
    const filesCount = regularFiles.length
    const usedBytes = regularFiles.reduce((sum, file) => sum + Number(file.size || 0), 0)

    return {
      foldersCount,
      filesCount,
      usedBytes,
      itemsCount: files.length,
    }
  }, [files, isFolder])

  useEffect(() => {
    if (!loading && !loadingScreenPermissions && screenPermissions !== null && !canAccessFiles) {
      router.replace('/dashboard')
    }
  }, [canAccessFiles, loading, loadingScreenPermissions, screenPermissions, router])

  useEffect(() => {
    if (!selectedBucketId) {
      return
    }

    const effectKey = JSON.stringify({
      selectedBucketId,
      currentPath,
      tagFilter,
      searchQuery,
      viewMode,
      currentPage,
    })

    if (lastEffectRequestKeyRef.current === effectKey) {
      return
    }

    lastEffectRequestKeyRef.current = effectKey
    fetchFiles()
  }, [fetchFiles, selectedBucketId, currentPath, tagFilter, searchQuery, viewMode, currentPage])

  useEffect(() => {
    if (!selectedTeamId || !selectedBucketId) return
    const evtSource = new EventSource(`/api/events/files?teamId=${selectedTeamId}`)
    evtSource.addEventListener('file-changed', (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as FileChangedPayload
      if (payload.bucketId !== selectedBucketId) return
      if (payload.action === 'indexing-status-changed' && payload.indexingStatus) {
        // Find fileId by key and update badge in place — no full refetch needed
        setFiles((prev) => {
          const file = prev.find((f) => f.key === payload.key)
          if (file) {
            setIndexingStatuses((s) => ({ ...s, [file.id]: payload.indexingStatus as IndexingStatus }))
          }
          return prev
        })
        return
      }
      // Clear dedup guard so SSE-triggered fetch always issues a fresh request.
      inFlightRequestKeyRef.current = null
      fetchFilesRef.current()
    })
    return () => evtSource.close()
  }, [selectedTeamId, selectedBucketId])  // fetchFiles intentionally excluded — stable via ref

  // Batch-fetch indexing statuses for visible files (admin/owner only)
  useEffect(() => {
    if (!isAdmin || files.length === 0) return
    const fileIds = files.filter((f) => !f.key.endsWith('/')).map((f) => f.id)
    if (fileIds.length === 0) return
    const url = new URL('/api/admin/indexing/file-statuses', window.location.origin)
    url.searchParams.set('ids', fileIds.join(','))
    if (selectedTeamId) url.searchParams.set('teamId', selectedTeamId)
    fetch(url).then((res) => res.json()).then((data: Record<string, IndexingStatus>) => {
      setIndexingStatuses((prev) => ({ ...prev, ...data }))
    }).catch(() => { /* non-fatal */ })
  }, [files, isAdmin, selectedTeamId])

  useEffect(() => {
    setSelectedFileIds([])
    setShareTargets([])
    setCurrentPage(1)
  }, [selectedBucketId, currentPath, tagFilter, searchQuery])

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

  const handleAbort = useCallback(async (fileIndex: number) => {
    const controller = uploadAbortControllers.current.get(fileIndex)
    if (controller) {
      controller.abort()
      uploadAbortControllers.current.delete(fileIndex)
    }
  }, [])

  if (loading || loadingScreenPermissions || screenPermissions === null || !canAccessFiles) {
    return null
  }


  async function handleUpload(uploadFiles: File[], onProgress?: (fileIndex: number, progress: number) => void) {

    if (!selectedBucketId) {
      throw new Error('Select a bucket before uploading')
    }
    if (!selectedTeamId) {
      throw new Error('Select a team before uploading')
    }

    const tags = uploadTags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    const description = uploadDescription.trim() || undefined
    const MULTIPART_THRESHOLD = 50 * 1024 * 1024 // 50MB
    const PART_SIZE = 10 * 1024 * 1024 // 10MB
    const MAX_CONCURRENT_PARTS = 3

    const uploadPart = async (
      signal: AbortSignal | undefined,
      uploadId: string,
      partNumber: number,
      blobPart: Blob,
      url: string
    ): Promise<{ ETag: string; PartNumber: number }> => {
      try {
        const partUpload = await fetch(url, {
          method: 'PUT',
          body: blobPart,
          signal,
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
      signal: AbortSignal | undefined
    ): Promise<Array<{ ETag: string; PartNumber: number }>> => {
      const results: Array<{ ETag: string; PartNumber: number } | null> = new Array(parts.length).fill(null)
      let index = 0

      const worker = async () => {
        while (index < parts.length) {
          const currentIndex = index++
          const part = parts[currentIndex]
          try {
            results[currentIndex] = await uploadPart(signal, uploadId, part.partNumber, part.blobPart, part.url)
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
      const controller = new AbortController()
      uploadAbortControllers.current.set(fileIndex, controller)

      try {
        if (file.size < MULTIPART_THRESHOLD) {
          // Simple PUT upload
          const response = await fetch('/api/files/upload', {
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
              teamId: selectedTeamId,
            }),
          })

          if (!response.ok) throw new Error('Failed to get upload URL')
          const { url, fileId } = await response.json()

          try {
            const uploadResponse = await fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
              signal: controller.signal,
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
          const initRes = await fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'multipartInit',
              bucketId: selectedBucketId,
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              path: currentPath,
              tags,
              description,
              teamId: selectedTeamId,
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

            const presignRes = await fetch('/api/files/upload', {
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
          const uploadedParts = await uploadWithConcurrency(parts, uploadId, controller.signal)
          onProgress?.(fileIndex, 90)

          const completeRes = await fetch('/api/files/upload', {
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
        uploadAbortControllers.current.delete(fileIndex)

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

  function handleDelete(file: StoredFile) {
    setConfirmDelete({ open: true, file })
  }

  async function handleConfirmDelete() {
    const file = confirmDelete.file
    if (!file) return
    setConfirmDelete({ open: false, file: null })

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

  async function handleShare(options: ShareLinkOptions) {
    if (shareTargets.length === 0) return

    // Calculate expiry seconds based on options
    let expiresIn: number | undefined

    if (options.expiryMode === 'never') {
      expiresIn = undefined
    } else if (options.expiryMode === 'preset' && options.expiresIn) {
      expiresIn = Number(options.expiresIn)
    } else if (options.expiryMode === 'custom' && options.customExpiry) {
      const customDate = new Date(options.customExpiry)
      if (isNaN(customDate.getTime()) || customDate <= new Date()) {
        toast({
          variant: 'destructive',
          title: 'Invalid expiry',
          description: 'Please pick a future date and time for the custom expiry.',
        })
        return
      }
      expiresIn = Math.floor((customDate.getTime() - Date.now()) / 1000)
    }

    setIsSharing(true)

    const payloadBase = {
      type: 'PRESIGNED',
      expiresIn,
      mode: options.mode,
      password: options.password || undefined,
      maxDownloads: options.maxDownloads ? Number(options.maxDownloads) : undefined,
      allowDownload: options.mode !== 'preview',
      allowPreview: true,
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
      const response = await fetch('/api/files/folder', {
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
    const params = new URLSearchParams(searchParams.toString())
    if (folderPath === '/') {
      params.delete('path')
    } else {
      params.set('path', folderPath)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function navigateUp() {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const newPath = parts.length ? '/' + parts.join('/') + '/' : '/'
    navigateToFolder(newPath)
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
      const response = await fetch('/api/files/folder', {
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
      const response = await fetch('/api/files/favorites', {
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
    await fetchFiles()
  }

  async function handleDownloadSelected() {
    if (!selectedBucketId || isDownloadingFolder) return

    const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id))
    const keys = selectedFiles.map((f) => f.key)

    if (keys.length === 0) return

    try {
      setIsDownloadingFolder(true)

      const response = await fetch('/api/files/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: selectedBucketId, keys }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to download selected files')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `selected-files-${Date.now()}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast({ title: 'Download ready', description: `${keys.length} file(s) downloaded as zip` })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to download selected files'
      toast({ variant: 'destructive', title: 'Error', description: message })
    } finally {
      window.setTimeout(() => setIsDownloadingFolder(false), 1200)
    }
  }

  function handleShareSelected() {
    if (!selectedBucketId) return

    const targets = files.filter(
      (file) => selectedFileIds.includes(file.id) && !isFolder(file)
    )

    if (targets.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No files selected',
        description: 'Select one or more files to share.',
      })
      return
    }

    setShareTargets(targets)
    setIsShareOpen(true)
  }

  async function handleDownloadFolder() {
    if (!selectedBucketId || isDownloadingFolder) return

    try {
      setIsDownloadingFolder(true)
      const params = new URLSearchParams({
        bucketId: selectedBucketId,
        path: currentPath,
      })
      const link = document.createElement('a')
      link.href = `/api/files/download-folder?${params.toString()}`
      link.setAttribute('download', '')
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast({
        title: 'Folder download started',
        description: 'Preparing zip archive for download',
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start folder download'
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      })
    } finally {
      window.setTimeout(() => setIsDownloadingFolder(false), 1200)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mb-5">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FolderOpen size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Files</h1>
              <p className="text-sm text-muted-foreground">Browse and manage your storage files.</p>
            </div>
          </div>
          {selectedBucketId && (() => {
            const breadcrumbs = getBreadcrumbs()
            const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Root'

            return (
              <div className="space-y-2">
                <nav
                  aria-label="Folder breadcrumbs"
                  className="overflow-x-auto whitespace-nowrap pb-1"
                >
                  <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground min-w-max">
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1

                      return (
                        <div key={crumb.path} className="inline-flex items-center gap-1.5">
                          {index > 0 && <span className="text-muted-foreground/60">/</span>}
                          <button
                            onClick={() => setCurrentPath(crumb.path)}
                            aria-current={isLast ? 'page' : undefined}
                            className={cn(
                              'rounded-full px-2.5 py-0.5 transition-colors',
                              isLast
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted hover:text-foreground'
                            )}
                          >
                            {crumb.name}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </nav>

                <p className="text-xs text-muted-foreground">
                  Current Folder: <span className="font-medium text-foreground">{currentFolderName}</span>
                </p>
              </div>
            )
          })()}
        </div>
      </header>

      {/* Desktop Action Bar - hidden on mobile */}
      <div className="hidden md:block mb-5">
        <FilesActionBar
          selectedCount={selectedFileIds.length}
          currentPath={currentPath}
          onUpload={() => setIsUploadOpen(true)}
          onShare={handleShareSelected}
          onDownload={handleDownloadSelected}
          onNewFolder={() => setIsFolderDialogOpen(true)}
          onRefresh={handleRefresh}
          onDownloadFolder={currentPath !== '/' ? handleDownloadFolder : undefined}
          disabled={!selectedBucketId}
          isRefreshing={isRefreshing}
          isDownloading={isDownloadingFolder}
        />
      </div>

      <div>
        {/* Sticky context bar — collapses to a single summary pill on small screens */}
        <div className="sticky top-0 z-20 mb-4">
          <Card className="border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur overflow-hidden">
            {/* Collapsed pill row — visible on small screens, hidden on lg+ */}
            <button
              type="button"
              onClick={() => setIsContextExpanded((prev) => !prev)}
              className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-left"
              aria-expanded={isContextExpanded}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Shield size={14} className="text-primary shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {activeIdentity ? activeIdentity.name : 'No credentials'}
                </span>
                {activeIdentity && (
                  <>
                    <span className="text-muted-foreground/40 text-sm">·</span>
                    <Database size={14} className="text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      {availableBuckets.find((b) => b.id === selectedBucketId)?.bucket || 'No bucket'}
                    </span>
                  </>
                )}
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'text-muted-foreground shrink-0 transition-transform duration-200',
                  isContextExpanded && 'rotate-180'
                )}
              />
            </button>

            {/* Full selector grid — always visible on lg+, toggled on small */}
            <div className={cn(
              'grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 lg:p-4',
              'lg:block',
              isContextExpanded ? 'block' : 'hidden lg:grid'
            )}>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AWS Credentials</Label>
                <Select value={selectedIdentityId || 'all'} onValueChange={(val) => { setIdentity(val === 'all' ? null : val); setIsContextExpanded(false) }}>
                  <SelectTrigger aria-label="AWS Credentials" className={cn(
                    'h-9 bg-card border-border text-sm',
                    isDashboardLoading && 'animate-pulse opacity-50 pointer-events-none'
                  )}>
                    <div className="flex items-center gap-2 truncate">
                      <Shield size={14} className="text-primary shrink-0" />
                      <SelectValue placeholder={isDashboardLoading ? 'Loading...' : 'Select credentials'} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Identities</SelectItem>
                    {identities.map((identity) => (
                      <SelectItem key={identity.id} value={identity.id}>
                        {identity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Storage Bucket</Label>
                <Select
                  value={selectedBucketId || 'all'}
                  onValueChange={(val) => { setBucket(val === 'all' ? null : val); setIsContextExpanded(false) }}
                  disabled={!selectedIdentityId}
                >
                  <SelectTrigger aria-label="Storage Bucket" className={cn(
                    'h-9 bg-card border-border text-sm disabled:opacity-50',
                    isDashboardLoading && 'animate-pulse opacity-50 pointer-events-none'
                  )}>
                    <div className="flex items-center gap-2 truncate">
                      <Database size={14} className="text-primary shrink-0" />
                      <SelectValue placeholder={isDashboardLoading ? 'Loading...' : 'Select bucket'} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buckets</SelectItem>
                    {availableBuckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.bucket}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        {selectedBucketId && (
          <Card className="mb-4 p-3 bg-muted/20 border-border">
            <p className="text-sm text-muted-foreground">
              Folder details: {currentFolderSummary.itemsCount} items • {currentFolderSummary.foldersCount} folders • {currentFolderSummary.filesCount} files • {formatFileSize(currentFolderSummary.usedBytes)} used
            </p>
          </Card>
        )}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-2xl">
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                viewMode === 'all'
                  ? "bg-brand text-white shadow-lg shadow-brand/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('favorites')}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                viewMode === 'favorites'
                  ? "bg-brand text-white shadow-lg shadow-brand/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Favorites
            </button>
            <button
              onClick={() => setViewMode('recents')}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                viewMode === 'recents'
                  ? "bg-brand text-white shadow-lg shadow-brand/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Recents
            </button>
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
          <div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <FolderOpen size={28} className="text-primary/60" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Bucket Selected</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Select a credential and bucket from the sidebar to browse your files.
            </p>
          </div>
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
            <div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <FolderOpen size={28} className="text-primary/60" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-black text-foreground tracking-tight mb-2">This Folder Is Empty</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-6">
                Upload files to populate this folder.
              </p>
              <Button onClick={() => setIsUploadOpen(true)} className="h-9 px-6 text-xs font-black uppercase tracking-widest">
                Upload Files
              </Button>
            </div>
        ) : (
                <>
                  {isTruncated && !truncationDismissed && (
                    <div className="glass-card bg-amber-50/50 dark:bg-amber-500/[0.03] border border-amber-500/20 dark:border-amber-500/10 p-5 rounded-2xl flex gap-4 items-start mb-6">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/20 dark:bg-amber-500/10 flex-shrink-0 flex items-center justify-center text-amber-600 dark:text-amber-500 text-xl">
                        ⚠
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-amber-700 dark:text-amber-200 tracking-tight">Too Many Items</h4>
                        <p className="text-xs text-amber-600 dark:text-amber-500/80 mt-1 leading-relaxed">
                          This folder contains too many items to display fully. Showing first 20,000 items. Use search to find specific files.
                        </p>
                      </div>
                      <button
                        onClick={() => setTruncationDismissed(true)}
                        className="text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors text-lg font-bold leading-none"
                        aria-label="Dismiss warning"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className={cn("space-y-2 transition-opacity duration-200", isRefreshing && "opacity-50 pointer-events-none")}>
                    {files.length === 0 && isRefreshing && (
                      <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/10 rounded-xl border border-dashed border-border">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary/40 mb-3" />
                        <p className="text-sm text-muted-foreground animate-pulse">Syncing files...</p>
                      </div>
                    )}
                  {files.map((file, index) => (
                  <Card
                    key={file.id}
                    ref={itemRefs[index] as React.RefObject<HTMLDivElement>}
                    tabIndex={0}
                    data-keyboard-focused={focusedIndex === index}
                    className={cn(
                      'p-4 hover:bg-accent/50 transition-colors outline-none',
                      'data-[keyboard-focused=true]:bg-accent/30 data-[keyboard-focused=true]:ring-1 data-[keyboard-focused=true]:ring-primary/50'
                    )}
                  >
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
                          <div className="flex items-center gap-2 flex-wrap">
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
                            {isAdmin && !isFolder(file) && indexingStatuses[file.id] !== undefined && (
                              <IndexingBadge
                                fileId={file.id}
                                initialStatus={indexingStatuses[file.id]}
                                onRetry={async (fid) => {
                                  await fetch('/api/admin/indexing/retry-failed', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fileId: fid }),
                                  })
                                  setIndexingStatuses((s) => ({ ...s, [fid]: 'PENDING' }))
                                }}
                              />
                            )}
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
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-2 py-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiles)} of {totalFiles} files
                      </p>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => prev - 1)}
                          disabled={currentPage === 1}
                        >
                          ← Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          disabled={!hasMore}
                        >
                          Next →
                        </Button>
                      </div>
                    </div>
                  )}
                </>
        )}
      </div>

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
              <Label htmlFor="upload-tags" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tags (optional)</Label>
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
              onAbort={handleAbort}
              onUpload={async (files, onProgress) => {
                try {
                  await handleUpload(files, onProgress)
                  setIsUploadOpen(false)
                  setUploadTags('')
                  setUploadDescription('')
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: error.message || 'Failed to upload files',
                  })
                  throw error
                } finally {
                  fetchFiles()
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={isShareOpen}
        onOpenChange={(open) => {
          setIsShareOpen(open)
          if (!open) setShareTargets([])
        }}
        shareTargets={shareTargets}
        onCreateLink={handleShare}
        isCreating={isSharing}
      />

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

      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete file"
        description={`"${confirmDelete.file?.name}" will be permanently deleted from S3. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ open: false, file: null })}
      />

      {/* Mobile FAB - hidden on desktop */}
      <MobileFilesFAB
        selectedCount={selectedFileIds.length}
        onUpload={() => setIsUploadOpen(true)}
        onShare={handleShareSelected}
        onDownload={handleDownloadSelected}
        onNewFolder={() => setIsFolderDialogOpen(true)}
        onRefresh={handleRefresh}
        disabled={!selectedBucketId}
        isRefreshing={isRefreshing}
        isDownloading={isDownloadingFolder}
      />
    </div>
  )
}
