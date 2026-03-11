'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Lock, FileText, Image as ImageIcon, Film, FileIcon, Shield, Eye, EyeOff, FileJson, Copy, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatFileSize, isImageFile, isVideoFile, isPDFFile, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getPreviewType } from '@/lib/preview-utils'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'

// Map extensions to Prism languages
const getLanguageFromFilename = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', md: 'markdown', mdx: 'markdown'
  }
  return ext && map[ext] ? map[ext] : 'text'
}

export default function SharePage({ params }: { params: { hash: string } }) {
  const searchParams = useSearchParams()
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy code to clipboard.' })
    }
  }

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
    if (isImageFile(ct, name)) return <ImageIcon className="h-8 w-8" />
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4 transition-colors">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-black/20 p-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center animate-pulse">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Verifying Access
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4 transition-colors">
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
                  className="w-full h-12 px-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-sm"
                />
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-brand/20"
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4 transition-colors">
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

  const previewType = getPreviewType(file.file.contentType, file.file.name)
  const isTextPreview = !isDownloadMode && previewType === 'TEXT' && file.textContent
  const isCsvPreview = !isDownloadMode && previewType === 'CSV' && file.csvRows

  const hasPreview = showImagePreview || showVideoPreview || showPDFPreview || isTextPreview || isCsvPreview
  const language = getLanguageFromFilename(file.file.name)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-brand to-brand-dark rounded-2xl shadow-lg shadow-brand/20">
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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

          {isTextPreview && language === 'markdown' && (
            <div className="h-[60vh] overflow-y-auto p-8 bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 prose prose-slate dark:prose-invert max-w-none border-b border-slate-100 dark:border-white/5">
              <ReactMarkdown>{file.textContent}</ReactMarkdown>
            </div>
          )}

          {isTextPreview && language !== 'markdown' && (
            <div className="h-[60vh] relative group border-b border-slate-100 dark:border-white/5 bg-[#1e1e1e]">
              <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  onClick={() => handleCopyCode(file.textContent)}
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 h-8 text-xs font-mono shadow-lg transition-all border",
                    isCopied
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600"
                      : "bg-black/50 text-slate-300 hover:bg-black/80 hover:text-white border-white/10 backdrop-blur-md"
                  )}
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '1.5rem', height: '100%', background: 'transparent', fontSize: '0.875rem' }}
                showLineNumbers
                wrapLines
              >
                {file.textContent}
              </SyntaxHighlighter>
            </div>
          )}

          {isCsvPreview && (
            <div className="h-[60vh] overflow-auto bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-white/5 p-4">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {file.csvRows.map((row: string[], i: number) => (
                    <tr key={i} className="border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      {row.map((cell: string, j: number) => (
                        <td key={j} className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* File Info + Actions */}
          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl text-brand dark:text-brand-light">
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
                  className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-bold rounded-2xl text-white bg-gradient-to-r from-brand to-brand-dark hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand shadow-lg shadow-brand/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
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
                <div className="flex items-center gap-2 text-xs text-brand dark:text-brand-light">
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
