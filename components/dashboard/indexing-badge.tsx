'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Loader2, XCircle, Clock, AlertCircle } from 'lucide-react'

export type IndexingStatus = 'DONE' | 'PROCESSING' | 'FAILED' | 'PENDING' | null

interface IndexingBadgeProps {
  fileId: string
  initialStatus?: IndexingStatus
  onRetry?: (fileId: string) => void
}

interface TooltipProps {
  fileId: string
  onRetry?: (fileId: string) => void
}

function FailedTooltip({ fileId, onRetry }: TooltipProps) {
  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-56 bg-slate-900 border border-red-500/30 rounded-xl p-3 shadow-[0_16px_32px_rgba(0,0,0,0.8)] text-left">
      <div className="flex items-center gap-2 mb-2">
        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-xs font-bold text-red-400">Indexing failed</span>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
        The file could not be processed. Check the Indexing Pipeline for details.
      </p>
      {onRetry && (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(fileId) }}
          className="w-full flex items-center justify-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg py-1.5 text-[10px] font-bold hover:bg-red-500/20 transition-colors"
        >
          Retry indexing
        </button>
      )}
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-500/30" />
    </div>
  )
}

export function IndexingBadge({ fileId, initialStatus, onRetry }: IndexingBadgeProps) {
  const [status, setStatus] = useState<IndexingStatus>(initialStatus ?? null)
  const [showTooltip, setShowTooltip] = useState(false)

  // Update when parent provides new status (e.g. after SSE event)
  useEffect(() => {
    if (initialStatus !== undefined) setStatus(initialStatus)
  }, [initialStatus])

  if (status === null) return null

  if (status === 'DONE') {
    return (
      <div
        title="Indexed — searchable via AI"
        className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5"
      >
        <CheckCircle className="h-3 w-3 text-green-400" />
        <span className="text-[9px] font-bold text-green-400">Indexed</span>
      </div>
    )
  }

  if (status === 'PROCESSING') {
    return (
      <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">
        <Loader2 className="h-3 w-3 text-purple-400 animate-spin" />
        <span className="text-[9px] font-bold text-purple-400">Indexing</span>
      </div>
    )
  }

  if (status === 'PENDING') {
    return (
      <div className="flex items-center gap-1.5 bg-slate-500/10 border border-slate-500/20 rounded-full px-2 py-0.5">
        <Clock className="h-3 w-3 text-slate-400" />
        <span className="text-[9px] font-bold text-slate-400">Queued</span>
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="relative inline-block">
        <button
          onClick={(e) => { e.stopPropagation(); setShowTooltip((p) => !p) }}
          onBlur={() => setShowTooltip(false)}
          className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 cursor-pointer hover:bg-red-500/15 transition-colors"
        >
          <AlertCircle className="h-3 w-3 text-red-400" />
          <span className="text-[9px] font-bold text-red-400">Failed</span>
        </button>
        {showTooltip && <FailedTooltip fileId={fileId} onRetry={onRetry} />}
      </div>
    )
  }

  return null
}
