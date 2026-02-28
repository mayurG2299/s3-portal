'use client'

import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  uploadId?: string
  key?: string
  fileId?: string
  partsProgress?: Record<number, number>
}

interface FileUploadProps {
  onUpload: (files: File[], onProgress?: (fileIndex: number, progress: number) => void) => Promise<void>
  onAbort?: (fileIndex: number) => Promise<void>
  maxFiles?: number
  maxSize?: number
  accept?: Record<string, string[]>
  className?: string
}

export function FileUpload({
  onUpload,
  onAbort,
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024, // 100MB
  accept,
  className,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const uploadControllers = useRef<Map<number, AbortController>>(new Map())

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }))

      setFiles((prev) => [...prev, ...newFiles])
      setIsUploading(true)

      const startIndex = files.length
      const onProgress = (fileIndex: number, progress: number) => {
        setFiles((prev) => {
          const updated = [...prev]
          if (updated[startIndex + fileIndex]) {
            updated[startIndex + fileIndex].progress = progress
          }
          return updated
        })
      }

      try {
        // Mark as uploading
        setFiles((prev) =>
          prev.map((f, i) =>
            i >= startIndex
              ? { ...f, status: 'uploading' as const }
              : f
          )
        )

        await onUpload(acceptedFiles, onProgress)

        setFiles((prev) =>
          prev.map((f, i) =>
            i >= startIndex
              ? { ...f, progress: 100, status: 'success' as const }
              : f
          )
        )
      } catch (error: any) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i >= startIndex
              ? { ...f, status: 'error' as const, error: error.message }
              : f
          )
        )
      } finally {
        setIsUploading(false)
        uploadControllers.current.clear()
      }
    },
    [files.length, onUpload]
  )

  const handleAbort = async (index: number) => {
    const controller = uploadControllers.current.get(index)
    if (controller) {
      controller.abort()
      uploadControllers.current.delete(index)
    }

    if (onAbort) {
      try {
        await onAbort(index)
      } catch (error) {
        console.error('Error aborting upload:', error)
      }
    }

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, status: 'error' as const, error: 'Cancelled' }
          : f
      )
    )
  }

  const handleRetry = async (index: number) => {
    const uploadFile = files[index]
    if (!uploadFile) return

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, status: 'uploading' as const, progress: 0, error: undefined }
          : f
      )
    )

    try {
      await onUpload([uploadFile.file], (_, progress) => {
        setFiles((prev) => {
          const updated = [...prev]
          if (updated[index]) {
            updated[index].progress = progress
          }
          return updated
        })
      })

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: 'success' as const, progress: 100 }
            : f
        )
      )
    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: 'error' as const, error: error.message }
            : f
        )
      )
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept,
    disabled: isUploading,
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status === 'uploading'))
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative group border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-500 overflow-hidden',
          isUploading && 'opacity-50 cursor-not-allowed',
          isDragActive
            ? 'border-[#8c2bee] bg-[#8c2bee]/5 shadow-[0_0_30px_rgba(99,102,241,0.1)]'
            : 'border-white/10 bg-white/[0.02] hover:border-[#8c2bee]/30 hover:bg-white/[0.04]'
        )}
      >
        <input {...getInputProps()} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#8c2bee]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10">
          <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 text-slate-400 group-hover:text-[#b673ff] group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-500">
            <Upload size={28} strokeWidth={2.5} />
          </div>

          {isDragActive ? (
            <p className="text-lg font-black text-[#b673ff] uppercase tracking-widest animate-pulse">Release to Ingest</p>
          ) : (
            <>
                <p className="text-lg font-black text-white uppercase tracking-tight mb-2">
                  Drop Resources <span className="text-slate-500">or</span> <span className="gradient-text">Browse Files</span>
                </p>
              <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <span>Max {maxFiles} Entities</span>
                <div className="h-1 w-1 rounded-full bg-slate-700" />
                <span>Limit {formatFileSize(maxSize)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-[#8c2bee] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Transmission Queue / {files.length} Item{files.length !== 1 ? 's' : ''}
              </h3>
            </div>
            {files.some((f) => f.status === 'success' || f.status === 'error') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                disabled={isUploading}
                className="h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5"
              >
                Flush Queue
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {files.map((uploadFile, index) => (
              <div
                key={index}
                className="group relative flex items-center gap-4 p-4 glass-card border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden"
              >
                {uploadFile.status === 'success' && (
                  <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
                )}

                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-white transition-colors">
                  <File size={18} strokeWidth={2.5} />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                  </div>

                  {uploadFile.status === 'uploading' && (
                    <div className="space-y-1.5 animate-fade-in">
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#8c2bee] via-violet-500 to-[#6a1bbf] transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[#b673ff]">
                        <span>Uploading Payload</span>
                        <span>{Math.round(uploadFile.progress)}%</span>
                      </div>
                    </div >
                  )}

                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tight italic">
                      Error: {uploadFile.error}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-2 relative z-10">
                  {uploadFile.status === 'success' && (
                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <CheckCircle2 size={16} strokeWidth={3} />
                    </div>
                  )}

                  {uploadFile.status === 'error' && (
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(index)}
                        className="h-8 w-8 rounded-xl text-[#b673ff] hover:text-white hover:bg-white/5 border border-white/0 hover:border-white/5 transition-all"
                        title="Retry upload"
                      >
                        <RotateCcw size={14} strokeWidth={2.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-white/0 hover:border-rose-500/10 transition-all"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </Button>
                    </div>
                  )}

                  {uploadFile.status === 'uploading' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbort(index)}
                      className="h-8 w-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Abort"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </Button>
                  )}

                  {uploadFile.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 rounded-xl text-slate-500 hover:text-white transition-all"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
