'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { cn } from '@/lib/utils'
import {
  Search,
  FileText,
  Film,
  Music,
  Image,
  File,
  Loader2,
  X,
  Filter,
  ChevronRight,
  Eye,
  ExternalLink,
  Download,
} from 'lucide-react'

interface SearchResult {
  id: string
  name: string
  key: string
  contentType: string | null
  parentPath: string
  semanticScore: number
}

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'document', label: 'Documents' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
]

function matchesType(ct: string | null, filter: string): boolean {
  if (filter === 'all') return true
  const c = (ct || '').toLowerCase()
  if (filter === 'document') return c.startsWith('text/') || c.includes('pdf') || c.includes('document')
  if (filter === 'image') return c.startsWith('image/')
  if (filter === 'video') return c.startsWith('video/')
  if (filter === 'audio') return c.startsWith('audio/')
  return true
}

function FileIcon({ contentType, size = 'md' }: { contentType: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const ct = (contentType || '').toLowerCase()
  const cls = cn(size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5', 'shrink-0')
  if (ct.startsWith('video/')) return <Film className={cn(cls, 'text-purple-400')} />
  if (ct.startsWith('audio/')) return <Music className={cn(cls, 'text-pink-400')} />
  if (ct.startsWith('image/')) return <Image className={cn(cls, 'text-green-400')} />
  if (ct === 'application/pdf') return <FileText className={cn(cls, 'text-red-400')} />
  if (ct.startsWith('text/') || ct.includes('document')) return <FileText className={cn(cls, 'text-blue-400')} />
  return <File className={cn(cls, 'text-slate-400')} />
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : pct >= 60 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', color)}>
      {pct}%
    </span>
  )
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { selectedTeamId } = useDashboard()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [inputValue, setInputValue] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredResults = results.filter((r) => matchesType(r.contentType, typeFilter))
  const selectedResult = filteredResults.find((r) => r.id === selectedId) || null
  const selectedIndex = filteredResults.findIndex((r) => r.id === selectedId)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const url = new URL('/api/ai/search', window.location.origin)
      url.searchParams.set('q', q.trim())
      if (selectedTeamId) url.searchParams.set('teamId', selectedTeamId)
      url.searchParams.set('limit', '30')
      const res = await fetch(url)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.results || [])
      if (data.results?.length > 0) setSelectedId(data.results[0].id)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [selectedTeamId])

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setQuery(q)
    setInputValue(q)
    if (q) doSearch(q)
  }, [searchParams.get('q')])  // eslint-disable-line react-hooks/exhaustive-deps

  function submitSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`)
  }

  // Keyboard navigation on results list
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (document.activeElement === inputRef.current) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(selectedIndex + 1, filteredResults.length - 1)
        setSelectedId(filteredResults[next]?.id || null)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(selectedIndex - 1, 0)
        setSelectedId(filteredResults[prev]?.id || null)
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, filteredResults])

  return (
    <div className="flex flex-col h-full -m-6 lg:-m-8">
      {/* Page heading */}
      <div className="px-6 lg:px-8 pt-6 pb-0 shrink-0">
        <div className="mb-6 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Search size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                AI <span className="text-gradient">Search</span>
              </h1>
              <p className="text-sm text-muted-foreground">Search your files with natural language.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search header */}
      <div className="px-6 lg:px-8 py-5 border-b border-border bg-card/40 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 max-w-2xl">
          <div className="flex-1 flex items-center gap-3 bg-background/60 border border-border rounded-xl px-4 py-2.5 focus-within:border-brand/50 transition-colors">
            {loading
              ? <Loader2 className="h-4 w-4 text-brand animate-spin shrink-0" />
              : <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(inputValue) }}
              placeholder="Search your files with AI…"
              className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder-muted-foreground outline-none"
              autoComplete="off"
            />
            {inputValue && (
              <button onClick={() => { setInputValue(''); inputRef.current?.focus() }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => submitSearch(inputValue)}
            className="btn-primary-gradient px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0"
          >
            Search
          </button>
        </div>

        {results.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for <span className="text-foreground font-semibold">"{query}"</span>
          </p>
        )}
      </div>

      {/* 3-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: filters */}
        <div className="w-48 shrink-0 border-r border-border px-3 py-4 space-y-1 hidden md:block">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2 pb-2 flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> Filters
          </p>
          {TYPE_FILTERS.map((f) => {
            const count = f.id === 'all' ? results.length : results.filter((r) => matchesType(r.contentType, f.id)).length
            return (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
                  typeFilter === f.id
                    ? 'bg-brand/10 text-brand border border-brand/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card'
                )}
              >
                {f.label}
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', typeFilter === f.id ? 'bg-brand/20' : 'bg-muted')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Center: results list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-w-0 border-r border-border">
          {!query && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm font-semibold text-foreground">Search your files</p>
              <p className="text-xs text-muted-foreground mt-1">Use natural language to find anything across your storage</p>
            </div>
          )}

          {query && !loading && filteredResults.length === 0 && (
            <div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Search size={28} className="text-primary/60" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Results Found</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Try different keywords or a broader natural-language query.
              </p>
            </div>
          )}

          {filteredResults.map((result) => (
            <button
              key={result.id}
              onClick={() => setSelectedId(result.id === selectedId ? null : result.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-border/50 transition-colors',
                result.id === selectedId
                  ? 'bg-brand/[0.07] border-l-2 border-l-brand'
                  : 'hover:bg-card/60'
              )}
            >
              <FileIcon contentType={result.contentType} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{result.name}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{result.parentPath}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadge score={result.semanticScore} />
                <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', result.id === selectedId && 'rotate-90')} />
              </div>
            </button>
          ))}
        </div>

        {/* Right: preview pane */}
        <div className="w-96 shrink-0 hidden lg:flex flex-col">
          {!selectedResult ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <Eye className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Select a result to preview</p>
              <p className="text-[10px] mt-1 opacity-60">↑↓ to navigate · Space to preview</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Preview header */}
              <div className="px-5 py-4 border-b border-border bg-card/30 shrink-0">
                <div className="flex items-start gap-3">
                  <FileIcon contentType={selectedResult.contentType} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground break-words">{selectedResult.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{selectedResult.parentPath}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <ScoreBadge score={selectedResult.semanticScore} />
                  {selectedResult.contentType && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                      {selectedResult.contentType.split('/')[1]?.toUpperCase() || selectedResult.contentType}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview body — link to files page with preview open */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                <div className="w-full max-w-xs space-y-3">
                  <button
                    onClick={() => router.push(`/dashboard/files?preview=${encodeURIComponent(selectedResult.id)}`)}
                    className="btn-primary-gradient w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
                  >
                    <Eye className="h-4 w-4" />
                    Open preview
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/files?highlight=${encodeURIComponent(selectedResult.id)}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-card/80 transition-colors text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to file
                  </button>
                </div>
              </div>

              {/* Nav hint */}
              <div className="px-5 py-3 border-t border-border bg-card/20 shrink-0">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{selectedIndex + 1} / {filteredResults.length}</span>
                  <span className="flex items-center gap-2">
                    <kbd className="font-bold bg-muted px-1 rounded">↑↓</kbd> navigate
                    <kbd className="font-bold bg-muted px-1 rounded">Esc</kbd> close
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
