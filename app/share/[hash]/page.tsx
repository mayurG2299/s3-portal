'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Lock, FileText, Image, Film, FileIcon, Shield, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatFileSize, isImageFile, isVideoFile, isPDFFile } from '@/lib/utils'

export default function SharePage({ params }: { params: { hash: string } }) {
  const searchParams = useSearchParams()
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchShare = useCallback(async (pwd?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const url = pwd
        ? `/api/share/${params.hash}?password=${encodeURIComponent(pwd)}`
        : `/api/share/${params.hash}`

      const response = await fetch(url)
      const data = await response.json()

      if (response.status === 401 && data.requiresPassword) {
        setRequiresPassword(true)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to access file')
      }

      setFile(data)
      setIsLoading(false)

      if (searchParams.get('download') === 'true' && data.allowDownload && data.downloadUrl) {
        toast({
          title: 'Download started',
          description: 'Your file is downloading',
        })
        const a = document.createElement('a')
        a.href = data.downloadUrl
        a.download = data.file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (error: any) {
      setError(error.message)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      setIsLoading(false)
    }
  }, [params.hash, searchParams])

  useEffect(() => {
    fetchShare()
  }, [fetchShare])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetchShare(password)
  }

  function handleDownload() {
    if (!file?.downloadUrl) return
    try {
      window.location.href = file.downloadUrl
      toast({
        title: 'Download started',
        description: 'Your file is downloading',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to download file',
      })
    }
  }

  function getFileIcon() {
    if (!file) return <FileIcon className="h-8 w-8" />
    const ct = file.file.contentType || ''
    const name = file.file.name || ''
    if (isImageFile(ct, name)) return <Image className="h-8 w-8" />
    if (isVideoFile(ct, name)) return <Film className="h-8 w-8" />
    if (isPDFFile(ct, name)) return <FileText className="h-8 w-8" />
    return <FileIcon className="h-8 w-8" />
  }

  function getFileTypeLabel() {
    if (!file) return 'File'
    const ct = file.file.contentType || ''
    const name = file.file.name || ''
    if (isImageFile(ct, name)) return 'Image'
    if (isVideoFile(ct, name)) return 'Video'
    if (isPDFFile(ct, name)) return 'PDF Document'
    const ext = name.split('.').pop()?.toUpperCase()
    return ext ? `${ext} File` : 'File'
  }

  // ─── LOADING ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a1a] p-4 transition-colors">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-black/20 p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#8c2bee] to-[#6d28d9] flex items-center justify-center animate-pulse">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Verifying Access
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── PASSWORD REQUIRED ───
  if (requiresPassword && !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a1a] p-4 transition-colors">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-black/20 p-8">
            <div className="flex flex-col items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Password Protected
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enter the password to access this file
                </p>
              </div>
              <form onSubmit={handlePasswordSubmit} className="w-full space-y-4">
                <input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full h-12 px-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8c2bee]/50 focus:border-[#8c2bee] transition-all text-sm"
                />
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8c2bee] to-[#6d28d9] text-white font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-[#8c2bee]/20"
                >
                  Unlock File
                </button>
              </form>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Powered by S3 Portal · Secure file sharing
          </p>
        </div>
      </div>
    )
  }

  // ─── ERROR / NOT FOUND ───
  if (error || !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a1a] p-4 transition-colors">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-black/20 p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                <EyeOff className="h-8 w-8 text-rose-500" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Unavailable
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {error || 'This file is no longer available or the link has expired.'}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Powered by S3 Portal · Secure file sharing
          </p>
        </div>
      </div>
    )
  }

  // ─── FILE PREVIEW ───
  const isDownloadMode = searchParams.get('download') === 'true'
  const showImagePreview = !isDownloadMode && isImageFile(file.file.contentType, file.file.name)
  const showVideoPreview = !isDownloadMode && isVideoFile(file.file.contentType, file.file.name)
  const showPDFPreview = !isDownloadMode && isPDFFile(file.file.contentType, file.file.name)
  const hasPreview = showImagePreview || showVideoPreview || showPDFPreview

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a1a] py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-[#8c2bee] to-[#6d28d9] rounded-2xl shadow-lg shadow-[#8c2bee]/20">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Shared File
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Securely shared via S3 Portal
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden border border-slate-100 dark:border-white/10 transition-all hover:shadow-2xl hover:shadow-slate-200/60 dark:hover:shadow-black/30">

          {/* Preview Area */}
          {showImagePreview && (
            <div className="aspect-video bg-slate-50 dark:bg-black/30 flex items-center justify-center border-b border-slate-100 dark:border-white/5 overflow-hidden group">
              <img
                src={file.downloadUrl}
                alt={file.file.name}
                className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}

          {showVideoPreview && (
            <div className="aspect-video bg-black flex items-center justify-center border-b border-slate-100 dark:border-white/5 overflow-hidden">
              <video
                src={file.downloadUrl}
                controls
                className="max-w-full max-h-full"
              />
            </div>
          )}

          {showPDFPreview && (
            <div className="h-[60vh] border-b border-slate-100 dark:border-white/5">
              <iframe
                src={file.downloadUrl}
                className="w-full h-full border-0"
                title={file.file.name}
              />
            </div>
          )}

          {/* File Info + Actions */}
          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl text-[#8c2bee] dark:text-[#b673ff]">
                  {getFileIcon()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
                    {file.file.name}
                  </h3>
                  <div className="flex items-center mt-1 space-x-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{formatFileSize(Number(file.file.size))}</span>
                    <span>•</span>
                    <span>{getFileTypeLabel()}</span>
                  </div>
                </div>
              </div>

              {file.allowDownload && (
                <a
                  href={file.downloadUrl}
                  download={file.file.name}
                  onClick={(e) => {
                    e.preventDefault()
                    handleDownload()
                  }}
                  className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-bold rounded-2xl text-white bg-gradient-to-r from-[#8c2bee] to-[#6d28d9] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8c2bee] shadow-lg shadow-[#8c2bee]/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download
                </a>
              )}
            </div>

            {!file.allowDownload && (
              <div className="mt-6 flex items-center gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">
                <Eye className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  This file is shared in preview-only mode. Downloads are disabled.
                </p>
              </div>
            )}

            {/* Meta Info */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-6">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Shield className="h-3.5 w-3.5" />
                <span className="font-semibold uppercase tracking-wider">Encrypted Transfer</span>
              </div>
              {hasPreview && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-semibold uppercase tracking-wider">Preview Available</span>
                </div>
              )}
              {isDownloadMode && (
                <div className="flex items-center gap-2 text-xs text-[#8c2bee] dark:text-[#b673ff]">
                  <Download className="h-3.5 w-3.5" />
                  <span className="font-semibold uppercase tracking-wider">Auto Download</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Powered by <span className="font-semibold">S3 Portal</span> · Secure, self-hosted file sharing
          </p>
        </div>
      </div>
    </div>
  )
}
