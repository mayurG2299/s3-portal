import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const isFuture = diffMs > 0
  const absDiff = Math.abs(diffMs)

  const diffSecs = Math.floor(absDiff / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return isFuture ? 'in a few seconds' : 'just now'
  if (diffMins < 60) return isFuture ? `in ${diffMins}m` : `${diffMins}m ago`
  if (diffHours < 24) return isFuture ? `in ${diffHours}h` : `${diffHours}h ago`
  if (diffDays < 30) return isFuture ? `in ${diffDays}d` : `${diffDays}d ago`

  return date.toLocaleDateString()
}

/**
 * Generate random hash for links
 */
export function generateLinkHash(length: number = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Check if file is an image
 */
export function isImageFile(contentType?: string | null, filename?: string): boolean {
  if (contentType) {
    return contentType.startsWith('image/')
  }
  if (filename) {
    const ext = getFileExtension(filename)
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
  }
  return false
}

/**
 * Check if file is a video
 */
export function isVideoFile(contentType?: string | null, filename?: string): boolean {
  if (contentType) {
    return contentType.startsWith('video/')
  }
  if (filename) {
    const ext = getFileExtension(filename)
    return ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)
  }
  return false
}

/**
 * Check if file is a PDF
 */
export function isPDFFile(contentType?: string | null, filename?: string): boolean {
  if (contentType) {
    return contentType === 'application/pdf'
  }
  if (filename) {
    return getFileExtension(filename) === 'pdf'
  }
  return false
}

/**
 * Sanitize filename for S3
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)
}

/**
 * Build S3 key from path and filename
 */
export function buildS3Key(path: string, filename: string): string {
  const isFolder = filename.endsWith('/')
  const baseName = isFolder ? filename.slice(0, -1) : filename
  const sanitized = sanitizeFilename(baseName)
  const normalizedPath = path.replace(/^\/+|\/+$/g, '')
  const key = normalizedPath ? `${normalizedPath}/${sanitized}` : sanitized
  return isFolder ? `${key}/` : key
}

/**
 * Parse S3 key to get path and filename
 */
export function parseS3Key(key: string): { path: string; filename: string } {
  const parts = key.split('/')
  const filename = parts[parts.length - 1]
  const path = parts.slice(0, -1).join('/')
  return { path: path || '/', filename }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}
