'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { cn } from '@/lib/utils'
import {
  Search,
  FileText,
  Film,
  Music,
  Image,
  File,
  Clock,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react'

interface SearchResult {
  id: string
  name: string
  key: string
  contentType: string | null
  parentPath: string
  score: number
}

const RECENTS_KEY = 'ai-search-recents'
const MAX_RECENTS = 5

function getRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  try {
    const prev = getRecents().filter((r) => r !== q)
    localStorage.setItem(RECENTS_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENTS)))
  } catch { /* ignore */ }
}

function FileIcon({ contentType }: { contentType: string | null }) {
  const ct = (contentType || '').toLowerCase()
  const cls = 'h-4 w-4 shrink-0'
  if (ct.startsWith('video/')) return <Film className={cn(cls, 'text-purple-400')} />
  if (ct.startsWith('audio/')) return <Music className={cn(cls, 'text-pink-400')} />
  if (ct.startsWith('image/')) return <Image className={cn(cls, 'text-green-400')} />
  if (ct === 'application/pdf') return <FileText className={cn(cls, 'text-red-400')} />
  if (ct.startsWith('text/') || ct.includes('document')) return <FileText className={cn(cls, 'text-blue-400')} />
  return <File className={cn(cls, 'text-slate-400')} />
}

export function AiSearchPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const { selectedTeamId } = useDashboard()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setLoading(false)
    setHighlighted(0)
  }, [])

  const openPalette = useCallback(() => {
    setRecents(getRecents())
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // ⌘K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && e.metaKey && !e.shiftKey && !e.repeat) {
        e.preventDefault()
        if (open) {
          close()
        } else {
          openPalette()
        }
      }
      if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, close, openPalette])

  // Debounced search
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const url = new URL('/api/ai/search', window.location.origin)
        url.searchParams.set('q', trimmed)
        if (selectedTeamId) url.searchParams.set('teamId', selectedTeamId)
        url.searchParams.set('limit', '8')
        const res = await fetch(url)
        if (!res.ok) throw new Error('Search failed')
        const data: SearchResult[] = await res.json()
        setResults(data)
        setHighlighted(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, selectedTeamId])

  const goToSearchPage = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    saveRecent(trimmed)
    router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`)
    close()
  }, [router, close])

  const openResult = useCallback((result: SearchResult) => {
    saveRecent(query.trim())
    router.push(`/dashboard/files?preview=${encodeURIComponent(result.id)}`)
    close()
  }, [router, close, query])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const items = results.length > 0 ? results : []
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (e.metaKey) {
        goToSearchPage(query)
      } else if (items[highlighted]) {
        openResult(items[highlighted])
      } else if (query.trim()) {
        goToSearchPage(query)
      }
    }
  }

  if (!open) return null

  const showRecents = !query.trim() && recents.length > 0
  const showResults = query.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="w-full max-w-xl mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          {loading
            ? <Loader2 className="h-5 w-5 text-brand animate-spin shrink-0" />
            : <Search className="h-5 w-5 text-slate-400 shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search your files with AI…"
            className="flex-1 bg-transparent text-sm font-medium text-slate-100 placeholder-slate-500 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="text-[10px] font-bold bg-white/[0.07] text-slate-500 px-1.5 py-1 rounded-md shrink-0">Esc</kbd>
        </div>

        {/* Recents */}
        {showRecents && (
          <div className="px-2 py-2">
            <p className="px-3 pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Recent searches</p>
            {recents.map((r, i) => (
              <button
                key={r}
                onClick={() => { setQuery(r); inputRef.current?.focus() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/[0.05] transition-colors"
              >
                <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                <span className="flex-1 text-left truncate">{r}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="px-2 py-2 max-h-[50vh] overflow-y-auto">
            {results.length === 0 && !loading && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No results — try different keywords</p>
            )}
            {results.map((result, i) => (
              <button
                key={result.id}
                onClick={() => openResult(result)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                  i === highlighted ? 'bg-brand/10 text-slate-100' : 'text-slate-300 hover:bg-white/[0.04]'
                )}
                onMouseEnter={() => setHighlighted(i)}
              >
                <FileIcon contentType={result.contentType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{result.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{result.parentPath}</p>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">
                  {Math.round(result.score * 100)}%
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {showResults && query.trim() && (
          <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              onClick={() => goToSearchPage(query)}
              className="flex items-center gap-2 text-xs text-brand hover:text-brand/80 transition-colors font-semibold"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              View all results
            </button>
            <div className="flex items-center gap-3 text-[10px] text-slate-600">
              <span><kbd className="font-bold bg-white/[0.07] px-1 rounded">↵</kbd> open</span>
              <span><kbd className="font-bold bg-white/[0.07] px-1 rounded">⌘↵</kbd> full results</span>
              <span><kbd className="font-bold bg-white/[0.07] px-1 rounded">↑↓</kbd> navigate</span>
            </div>
          </div>
        )}

        {!showResults && !showRecents && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            Start typing to search your files with AI
          </div>
        )}
      </div>
    </div>
  )
}
