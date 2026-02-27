"use client"

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { getPreviewType, PreviewType } from '@/lib/preview-utils'
import { RefreshCw, Maximize, Minimize } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'

type FileRecord = {
  id: string
  name: string
  contentType?: string | null
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
      <DialogContent className={isFullscreen ? "max-w-[100vw] w-screen h-screen max-h-screen m-0 p-6 rounded-none flex flex-col" : "max-w-4xl w-full"}>
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>
              Preview: {file.name}
              {fileSizeStr && <span className="text-sm font-normal text-gray-500 ml-2">({fileSizeStr})</span>}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={fetchPreview} disabled={loading} title="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogDescription>
            Previewing file. Downloads are possible from this view if supported.
          </DialogDescription>
        </DialogHeader>

        <div className={`mt-4 ${isFullscreen ? 'flex-1 min-h-0 flex flex-col overflow-auto' : ''}`}>
          {loading && <div className="text-sm text-gray-500 text-center py-8">Loading preview…</div>}

          {!loading && type === 'IMAGE' && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={file.name} className={`${isFullscreen ? 'h-full w-full object-contain' : 'max-h-[70vh] mx-auto'}`} />
          )}

          {!loading && type === 'PDF' && previewUrl && (
            <iframe src={previewUrl} className={`w-full border ${isFullscreen ? 'h-full flex-1 min-h-0' : 'h-[70vh]'}`} />
          )}

          {!loading && type === 'VIDEO' && previewUrl && (
            <video controls src={previewUrl} className={`w-full ${isFullscreen ? 'h-full flex-1 max-h-full min-h-0' : 'max-h-[70vh]'}`} />
          )}

          {!loading && type === 'AUDIO' && previewUrl && (
            <audio controls src={previewUrl} className="w-full" />
          )}

          {!loading && type === 'TEXT' && isTooLarge && (
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded text-sm text-center border border-yellow-200">
              <p className="font-medium text-base mb-2">File too large to preview (&gt;1MB)</p>
              <p>Please download the file instead.</p>
              <div className="mt-4">
                <a href={`/api/files/download?id=${file.id}`} className="inline-block">
                  <Button variant="outline" className="bg-white border-yellow-300 text-yellow-800 hover:bg-yellow-100">Download File</Button>
                </a>
              </div>
            </div>
          )}

          {!loading && type === 'TEXT' && !isTooLarge && (textContent !== null) && (
            <pre className={`whitespace-pre-wrap overflow-auto border bg-gray-50 p-4 rounded ${isFullscreen ? 'h-full flex-1 min-h-0' : 'max-h-[70vh]'}`}>{textContent}</pre>
          )}

          {!loading && type === 'CSV' && csvRows && (
            <div className={`overflow-auto border rounded ${isFullscreen ? 'h-full flex-1 min-h-0' : 'max-h-[70vh]'}`}>
              <table className="min-w-full table-auto">
                <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                  <tr>
                    {csvRows[0]?.map((cell, j) => (
                      <th key={j} className="border px-4 py-2 text-left text-sm font-semibold">{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(1).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {row.map((cell, j) => (
                        <td key={j} className="border px-4 py-1 text-sm">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && type === 'UNSUPPORTED' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Preview not supported for this file type.</p>
              <div>
                <a href={`/api/files/download?id=${file.id}`} className="inline-block">
                  <Button>Download</Button>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
