'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, HardDrive, File, FolderOpen, Users, User, Link as LinkIcon, X, Loader2 } from 'lucide-react'
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
}

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <span>{text}</span>

  // Safe RegExp generation
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? (
            <mark
              key={i}
              className="rounded-sm bg-amber-200/90 px-0.5 text-slate-950 dark:bg-amber-400/40 dark:text-amber-100"
            >
              {part}
            </mark>
          )
          : part
      )}
    </span>
  )
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
  const [inputValue, setInputValue] = useState('') // What's actually in the input box
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Stage 10: Click outside to close without clearing text
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

  // Reset search state on navigation away from files
  useEffect(() => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (!pathname.startsWith('/dashboard/files')) {
      setQuery('')
      setInputValue('')
    }
    onFocusChange?.(false)
  }, [pathname, onFocusChange])

  // Debounced Search (Stage 1, 2, 3)
  useEffect(() => {
    // Stage 1: Reset if empty
    if (!query || query.length === 0) {
      setIsOpen(false)
      setResults([])
      setError(null)
      setIsLoading(false)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    // Stage 2: Threshold < 2 chars
    if (query.trim().length < 2) {
      setIsOpen(false)
      setResults([])
      setError(null)
      setIsLoading(false)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    // Stage 1: 300ms debounce
    const timer = setTimeout(async () => {
      // Cancel previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

    // Stage 3: Loading Indicator
      setIsLoading(true)
      setError(null)

      // Hide old suggestions, keep input interactive
      setResults([])

      if (inputRef.current === document.activeElement) {
        setIsOpen(true)
      }

      try {
        const url = new URL('/api/search', window.location.origin)
        url.searchParams.append('q', query.trim())
        if (selectedTeamId) url.searchParams.append('teamId', selectedTeamId)
        if (selectedIdentityId) url.searchParams.append('identityId', selectedIdentityId)
        if (selectedBucketId) url.searchParams.append('bucketId', selectedBucketId)

        const res = await fetch(url.toString(), {
          signal: abortControllerRef.current.signal
        })

        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setHighlightedIndex(-1)
        } else {
          // Stage 9: Error state
          setError("Something went wrong. Please try again.")
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err)
          setError("Something went wrong. Please try again.")
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, selectedTeamId, selectedIdentityId, selectedBucketId])

  // Stage 5: Handle Selection
  const handleSelect = useCallback((result: SearchResult) => {
    // Close dropdown instantly
    setIsOpen(false)

    // Update input value, but do NOT update `query` state to avoid re-triggering API search
    setInputValue(result.title)

    // Synchronize global context before navigating
    if (result.teamId && result.teamId !== selectedTeamId) {
      setTeam(result.teamId)
    }

    if (result.type === 'file' || result.type === 'bucket') {
      if (result.identityId) setIdentity(result.identityId)
      if (result.bucketId) setBucket(result.bucketId)
    }

    const destination = new URL(result.url, window.location.origin)

    // Preserve local filtering if requested by files page logic previously
    if (result.type === 'file') {
      const trimmedQuery = query.trim()
      if (trimmedQuery && trimmedQuery !== result.title) {
        destination.searchParams.set('q', trimmedQuery)
      }
    }

    router.push(`${destination.pathname}${destination.search}`)
    onFocusChange?.(false)
    inputRef.current?.blur()
  }, [router, selectedTeamId, setTeam, setIdentity, setBucket, onFocusChange, query])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    setQuery(val) // Starts debounce

    if (val.trim().length >= 2) {
      setIsOpen(true)
    }
  }

  // Stage 7: Clear Button
  const handleClear = () => {
    setInputValue('')
    setQuery('')
    setIsOpen(false)
    setIsLoading(false)
    setError(null)
    setResults([])
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    inputRef.current?.focus()
    onFocusChange?.(true)
  }

  // Stage 6: Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inputValue.trim().length >= 2) {
          setIsOpen(true)
        }
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => {
        const next = prev < Math.min(results.length, 8) - 1 ? prev + 1 : prev // Stop at end, don't loop
        scrollToItem(next)
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => {
        const next = prev > 0 ? prev - 1 : 0 // Stop at top, don't loop
        scrollToItem(next)
        return next
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex])
      } else if (results.length > 0) {
        // Fallback to first visible result to prevent Enter-key no-op races.
        handleSelect(results[0])
      }
    }
  }

  const scrollToItem = (index: number) => {
    const el = document.getElementById(`search-result-${index}`)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }

  // Stage 11: Focus Re-show
  const handleFocus = () => {
    onFocusChange?.(true)
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    if (inputValue.trim().length >= 2) {
      setIsOpen(true)
    }
  }

  // Stage 11: Blur 150ms Delay
  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
      onFocusChange?.(false)
    }, 150)
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

  const isSearchActive = isOpen || inputValue.trim() !== ''

  return (
    <div 
      ref={wrapperRef} 
      className={cn(
        "relative z-50",
        isSearchActive ? "flex-1 max-w-none" : "flex-1 max-w-[140px] sm:max-w-md",
        "transition-all duration-500 ease-out"
      )}
    >
      <div className="relative w-full">
        {/* Stage 3 & 12: Loader & Icon with ARIA */}
        <div className={cn(
          "absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none transition-all duration-500",
          isSearchActive ? "text-[#8c2bee]" : "text-slate-500"
        )}>
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" role="status" aria-label="Loading results" />
          ) : (
            <Search className={cn("h-3.5 w-3.5 transition-transform duration-500", isSearchActive && "scale-110")} />
          )}
        </div>

        {/* Stage 12: ARIA inputs */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            isOpen && highlightedIndex >= 0 && results[highlightedIndex]
              ? `search-result-${highlightedIndex}`
              : undefined
          }
          placeholder="Search..."
          value={inputValue}
          autoComplete="off"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "block w-full pl-8 pr-10 py-1.5 md:py-2 bg-slate-100 border-none dark:bg-white/[0.03] dark:border dark:border-white/5 rounded-2xl text-[10px] md:text-xs font-medium text-slate-900 dark:text-slate-300 placeholder-slate-500",
            "focus:outline-none focus:ring-1 focus:ring-[#8c2bee]/50 focus:border-[#8c2bee]/50 focus:bg-white dark:focus:bg-white/[0.05]",
            "transition-all duration-500 ease-out shadow-sm dark:shadow-none",
            isSearchActive && "dark:bg-white/[0.08] dark:border-white/10 shadow-lg shadow-purple-500/30"
          )}
        />

        {/* Stage 7: Clear Button */}
        {inputValue.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          role="listbox"
          className="fixed md:absolute top-16 md:top-full left-4 right-4 md:left-0 md:right-0 mt-2 bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 max-h-[350px] overflow-y-auto no-scrollbar md:w-full"
        >
          {isLoading ? (
            // Stage 3: Skeleton Loader inside dropdown
            <div className="p-2 space-y-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                  <div className="h-6 w-6 rounded bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                    <div className="h-2 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Stage 9: Error State
            <div className="p-4 text-center">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          ) : results.length === 0 ? (
                // Stage 8: Empty State
                <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <div className="relative mb-2">
                    <Search size={24} className="opacity-20" />
                    <X size={12} className="absolute bottom-0 right-0 opacity-40 text-destructive" />
                  </div>
                  <p className="text-xs font-medium">No results found for &ldquo;{inputValue}&rdquo;</p>
            </div>
          ) : (
                  // Stage 4: Results List
            <div className="py-2">
                    <div className="px-3 pb-2 pt-1 flex items-center justify-between">
                      <p className="text-[10px] font-black tracking-widest text-[#8c2bee] uppercase">Results</p>
              </div>
                    {results.slice(0, 8).map((res, i) => {
                      const isHighlighted = highlightedIndex === i
                      return (
                        <div
                          key={`${res.type}-${res.id}-${i}`}
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={isHighlighted}
                          onMouseDown={(e) => {
                            // Prevent blur timeout from hiding dropdown before click registers
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current)
                            }
                            // Prevent default to keep the focus active on the input field
                            e.preventDefault()
                          }}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={cn(
                      "w-full flex text-left items-center gap-3 px-3 py-2 cursor-pointer transition-colors group",
                      isHighlighted ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="shrink-0 p-1.5 rounded-md bg-background border border-border shadow-sm">
                      {getIcon(res.type)}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <p className="text-sm font-semibold text-foreground truncate">
                          <HighlightMatch text={res.title} query={inputValue} />
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                      </div>
                      <div className="shrink-0 text-[10px] font-medium text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                        {getTypeLabel(res.type)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
