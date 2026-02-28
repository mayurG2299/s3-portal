"use client"

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { getPreviewType, PreviewType } from '@/lib/preview-utils'
import { RefreshCw, Maximize, Minimize, FileJson, Loader2 } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'

type FileRecord = {
  id: string
  name: string
  contentType?: string | null
}

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

export default function FilePreviewModal({ file, open, onClose }: { file: FileRecord | null; open: boolean; onClose: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<string[][] | null>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fileSizeStr, setFileSizeStr] = useState<string | null>(null)
  const [isTooLarge, setIsTooLarge] = useState(false)

  const fetchPreview = React.useCallback(async () => {
    if (!file) return
    const type = getPreviewType(file.contentType, file.name)
    if (type === 'UNSUPPORTED') return

    setLoading(true)
    setPreviewUrl(null)
    setTextContent(null)
    setCsvRows(null)
    setIsTooLarge(false)

    try {
      // For TEXT/CSV use server-side proxy to avoid CORS and parsing issues
      if (type === 'TEXT' || type === 'CSV') {
        const res = await fetch(`/api/files/${file.id}/preview-content`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Failed to generate preview' }))
          throw new Error(err.message || 'Failed to generate preview')
        }
        const data = await res.json()
        if (data.fileSize !== undefined) {
          const sizeNum = Number(data.fileSize)
          setFileSizeStr(formatFileSize(sizeNum))
          if (type === 'TEXT' && sizeNum > 1024 * 1024) {
            setIsTooLarge(true)
            setLoading(false)
            return
          }
        }

        if (type === 'TEXT') {
          setTextContent(data.text || '')
        }

        if (type === 'CSV') {
          if (data.csvRows) {
            setCsvRows(data.csvRows)
          } else if (data.text) {
            // Fallback: naive parse
            const rows = (data.text as string).split(/\r?\n/).filter(Boolean).map((line) => line.split(','))
            setCsvRows(rows)
          }
        }
      } else {
        const res = await fetch(`/api/files/${file.id}/preview-url`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Failed to generate preview' }))
          throw new Error(err.message || 'Failed to generate preview')
        }
        const data = await res.json()
        setPreviewUrl(data.url)
        if (data.fileSize !== undefined) setFileSizeStr(formatFileSize(Number(data.fileSize)))
      }
    } catch (error: any) {
      console.error('Preview error', error)
      toast({ variant: 'destructive', title: 'Preview error', description: error.message || 'Unable to preview file' })
      onClose()
    } finally {
      setLoading(false)
    }
  }, [file, onClose])

  useEffect(() => {
    if (open) {
      fetchPreview()
    } else {
      setIsFullscreen(false)
    }
  }, [open, fetchPreview])

  if (!file) return null

  const type = getPreviewType(file.contentType, file.name)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(
        "glass-card !p-0 overflow-hidden border-white/10 shadow-2xl",
        isFullscreen
          ? "max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none flex flex-col backdrop-blur-3xl bg-slate-950/80"
          : "max-w-4xl w-[95vw] sm:w-full"
      )}>
        <DialogHeader className="p-6 border-b border-white/5 bg-white/[0.03]">
          <div className="flex items-center justify-between pr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                <span className="gradient-text">Preview</span>
                <span className="text-slate-500 font-medium">/</span>
                <span className="truncate max-w-[200px] sm:max-w-md">{file.name}</span>
              </DialogTitle>
              {fileSizeStr && (
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Payload Weight: <span className="text-[#b673ff]">{fileSizeStr}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchPreview}
                disabled={loading}
                className="h-10 w-10 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-10 w-10 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "relative overflow-hidden",
          isFullscreen ? "flex-1 flex flex-col" : "min-h-[300px] max-h-[75vh]"
        )}>
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#8c2bee]/20 animate-pulse" />
                <div className="h-12 w-12 border-2 border-white/5 border-t-indigo-500 rounded-full animate-spin relative z-10 shadow-[0_0_20px_rgba(99,102,241,0.2)]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#b673ff] animate-pulse">Synchronizing Data</p>
            </div>
          )}

          <div className={cn(
            "h-full overflow-auto custom-scrollbar p-1",
            isFullscreen ? "flex-1" : "max-h-[70vh]"
          )}>
            {!loading && type === 'IMAGE' && previewUrl && (
              <div className="flex items-center justify-center p-4 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file.name}
                  className={cn(
                    "rounded-xl shadow-2xl border border-white/10 ring-1 ring-white/5",
                    isFullscreen ? "max-h-full max-w-full object-contain" : "max-h-[60vh]"
                  )}
                />
              </div>
            )}

            {!loading && type === 'PDF' && previewUrl && (
              <iframe
                src={previewUrl}
                className={cn(
                  "w-full border-0 bg-slate-900/50",
                  isFullscreen ? "h-full" : "h-[65vh]"
                )}
              />
            )}

            {!loading && type === 'VIDEO' && previewUrl && (
              <div className="flex items-center justify-center h-full bg-black/20 p-4">
                <video
                  controls
                  src={previewUrl}
                  className={cn(
                    "rounded-2xl shadow-2xl border border-white/10",
                    isFullscreen ? "max-h-full max-w-full" : "max-h-[65vh]"
                  )}
                />
              </div>
            )}

            {!loading && type === 'AUDIO' && previewUrl && (
              <div className="flex items-center justify-center py-20 px-8">
                <div className="w-full max-w-md p-8 glass-card border-white/10 shadow-xl bg-white/[0.02]">
                  <audio controls src={previewUrl} className="w-full" />
                </div>
              </div>
            )}

            {!loading && type === 'TEXT' && isTooLarge && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in">
                <div className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                  <FileJson size={32} />
                </div>
                <h3 className="text-xl font-black text-white mb-3">Oversized Payload Detector</h3>
                <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed italic">
                  The data stream exceeds browser rendering threshold (&gt;1MB). Secure download protocol recommended.
                </p>
                <a href={`/api/files/download?id=${file.id}`}>
                  <Button className="btn-primary-gradient h-12 px-8 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">
                    Download Resource
                  </Button>
                </a>
              </div>
            )}

            {!loading && type === 'TEXT' && !isTooLarge && (textContent !== null) && (
              <div className="h-full">
                {getLanguageFromFilename(file.name) === 'markdown' ? (
                  <div className={cn(
                    "p-8 prose prose-invert prose-slate max-w-none bg-white/[0.01]",
                    isFullscreen ? "min-h-full" : ""
                  )}>
                    <ReactMarkdown>{textContent}</ReactMarkdown>
                  </div>
                ) : (
                    <div className="h-full bg-slate-950/40">
                      <SyntaxHighlighter
                        language={getLanguageFromFilename(file.name)}
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          background: 'transparent',
                          fontSize: '13px',
                          padding: '24px',
                          minHeight: '100%',
                          borderRadius: 0
                        }}
                        showLineNumbers={true}
                      >
                        {textContent}
                      </SyntaxHighlighter>
                    </div>
                )}
              </div>
            )}

            {!loading && type === 'CSV' && csvRows && (
              <div className="bg-slate-950/20 h-full">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/80 shadow-lg border-b border-white/5">
                    <tr>
                      {csvRows[0]?.map((cell, j) => (
                        <th key={j} className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#b673ff]">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {csvRows.slice(1).map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                        {row.map((cell, j) => (
                          <td key={j} className="px-6 py-3 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors border-r border-white/5 last:border-r-0">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && type === 'UNSUPPORTED' && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in">
                <div className="h-16 w-16 rounded-3xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400 mb-6 font-black text-xl">
                  ?
                </div>
                <h3 className="text-xl font-black text-white mb-3">Codec Incompatibility</h3>
                <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed italic">
                  The system signature for this resource is currently unsupported for live preview.
                </p>
                <a href={`/api/files/download?id=${file.id}`}>
                  <Button className="btn-primary-gradient h-12 px-8 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">
                    Force Download
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            Terminal View
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
