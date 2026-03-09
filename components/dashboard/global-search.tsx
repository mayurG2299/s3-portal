'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, HardDrive, File, FolderOpen, Users, User, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

import { useDashboard } from '@/lib/contexts/dashboard-context'

interface SearchResult {
  type: 'file' | 'link' | 'bucket' | 'team' | 'member'
  id: string
  title: string
  subtitle: string
  tags?: string[]
  description?: string | null
  url: string
  hash?: string
  teamId?: string
  identityId?: string
  bucketId?: string
  _searchMeta?: {
    score: number
    matchedField: string
    query: string
  }
}

export function GlobalSearch({ onFocusChange }: { onFocusChange?: (focused: boolean) => void }) {
  const {
    selectedTeamId,
    selectedIdentityId,
    selectedBucketId,
    setTeam,
    setIdentity,
    setBucket
  } = useDashboard()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchMeta, setSearchMeta] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  
  // Track if search is active (focused or has query)
  const isSearchActive = isFocused || query.trim() !== ''

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        onFocusChange?.(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onFocusChange])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const url = new URL('/api/search', window.location.origin)
        url.searchParams.append('q', query)
        if (selectedTeamId) url.searchParams.append('teamId', selectedTeamId)
        if (selectedIdentityId) url.searchParams.append('identityId', selectedIdentityId)
        if (selectedBucketId) url.searchParams.append('bucketId', selectedBucketId)

        const res = await fetch(url.toString())
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setSearchMeta(data.meta || null)
          setIsOpen(true)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query, selectedTeamId, selectedIdentityId, selectedBucketId])

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false)
    onFocusChange?.(false)

    // Synchronize global context before navigating
    if (result.teamId && result.teamId !== selectedTeamId) {
      setTeam(result.teamId)
    }

    // For files and buckets, we also sync Identity and Bucket
    if (result.type === 'file' || result.type === 'bucket') {
      if (result.identityId) setIdentity(result.identityId)
      if (result.bucketId) setBucket(result.bucketId)
    }

    // Pass the search query to the Files page for consistent local filtering
    const url = result.type === 'file'
      ? `${result.url}?q=${encodeURIComponent(query)}`
      : result.url

    router.push(url)
    setQuery('')
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'file': return <File size={14} className="text-emerald-500" />
      case 'link': return <LinkIcon size={14} className="text-blue-500" />
      case 'bucket': return <HardDrive size={14} className="text-indigo-500" />
      case 'team': return <Users size={14} className="text-amber-500" />
      case 'member': return <User size={14} className="text-violet-500" />
      default: return <Search size={14} className="text-muted-foreground" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'file': return 'File or Folder'
      case 'link': return 'Shared Link'
      case 'bucket': return 'Bucket'
      case 'team': return 'Team'
      case 'member': return 'Team Member'
      default: return 'Result'
    }
  }

  return (
    <div 
      ref={wrapperRef} 
      className={cn(
        "relative z-50",
        isSearchActive 
          ? "flex-1 max-w-none"  // Expand fully when active
          : "flex-1 max-w-[140px] sm:max-w-md",
        "transition-all duration-500 ease-out"  // Smooth expansion with ease-out
      )}
    >
      <div className={cn(
        "absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none transition-all duration-500",
        isSearchActive ? "text-[#8c2bee]" : "text-slate-500"
      )}>
        <svg className={cn(
          "h-3.5 w-3.5 transition-transform duration-500",
          isSearchActive && "scale-110"
        )} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value)
          if (!isOpen && e.target.value.trim() !== '') setIsOpen(true)
        }}
        onFocus={() => {
          setIsFocused(true)
          if (query.trim() !== '') setIsOpen(true)
          onFocusChange?.(true)
        }}
        onBlur={() => {
          setIsFocused(false)
          onFocusChange?.(false)
        }}
        className={cn(
          "block w-full pl-8 pr-3 py-1.5 md:py-2 bg-slate-100 border-none dark:bg-white/[0.03] dark:border dark:border-white/5 rounded-2xl text-[10px] md:text-xs font-medium text-slate-900 dark:text-slate-300 placeholder-slate-500",
          "focus:outline-none focus:ring-1 focus:ring-[#8c2bee]/50 focus:border-[#8c2bee]/50 focus:bg-white dark:focus:bg-white/[0.05]",
          "transition-all duration-500 ease-out shadow-sm dark:shadow-none",
          isSearchActive && "dark:bg-white/[0.08] dark:border-white/10 shadow-lg shadow-purple-500/30"
        )}
      />

      {/* Dropdown Results */}
      {isOpen && (query.trim() !== '') && (
        <div className="fixed md:absolute top-16 md:top-full left-4 right-4 md:left-0 md:right-0 mt-2 bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 max-h-[400px] overflow-y-auto no-scrollbar md:w-full">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
              Searching globally...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-[10px] text-muted-foreground/70">Try a different search term or check your filters.</p>
                {searchMeta && (
                  <p className="text-[9px] text-muted-foreground/50 mt-2">
                    Searched: {searchMeta.scopes?.files || 0} files, {searchMeta.scopes?.links || 0} links, {searchMeta.scopes?.buckets || 0} buckets
                  </p>
                )}
            </div>
          ) : (
            <div className="py-2">
                  <div className="px-3 pb-2 pt-1 flex items-center justify-between">
                <p className="text-[10px] font-black tracking-widest text-[#8c2bee] uppercase">Results</p>
                    {searchMeta && searchMeta.totalResults > 0 && (
                      <p className="text-[9px] text-muted-foreground">{searchMeta.totalResults} found</p>
                    )}
              </div>
              {results.map((res, i) => (
                <button
                  key={`${res.type}-${res.id}-${i}`}
                  onClick={() => handleSelect(res)}
                  className="w-full flex text-left items-start gap-3 px-3 py-2 hover:bg-accent/50 transition-colors group cursor-pointer"
                >
                  <div className="mt-0.5 p-1.5 rounded-md bg-background border border-border shadow-sm group-hover:bg-accent group-hover:border-accent-foreground/10 transition-colors">
                    {getIcon(res.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{res.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{res.subtitle}</p>
                    
                    {res.tags && res.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {res.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[8px] font-black bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-1">
                    {getTypeLabel(res.type)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
