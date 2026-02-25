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
    <div className={cn('space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isUploading && 'opacity-50 cursor-not-allowed',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-2">
              Drag & drop files here, or click to select
            </p>
            <p className="text-sm text-muted-foreground">
              Max {maxFiles} files, up to {formatFileSize(maxSize)} each
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </h3>
            {files.some((f) => f.status === 'success' || f.status === 'error') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                disabled={isUploading}
              >
                Clear completed
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((uploadFile, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(uploadFile.file.size)}
                  </p>
                  {uploadFile.status === 'uploading' && (
                    <>
                      <Progress value={uploadFile.progress} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(uploadFile.progress)}%
                      </p>
                    </>
                  )}
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="text-xs text-destructive mt-1">
                      {uploadFile.error}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex gap-2">
                  {uploadFile.status === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(index)}
                        title="Retry upload"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {uploadFile.status === 'uploading' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbort(index)}
                      title="Cancel upload"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {uploadFile.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
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
