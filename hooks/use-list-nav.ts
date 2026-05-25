'use client'

import { useState, useEffect, useRef, createRef } from 'react'

interface UseListNavOptions<T> {
  items: T[]
  isModalOpen: boolean
  keyActions?: {
    onDelete?: (item: T) => void
    onCopy?: (item: T) => void
    onAccept?: (item: T) => void
    onDecline?: (item: T) => void
  }
  onRefresh?: () => void
}

interface UseListNavReturn<T> {
  focusedIndex: number | null
  itemRefs: React.RefObject<HTMLDivElement>[]
}

function throttle<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let last = 0
  return (...args: T) => {
    const now = Date.now()
    if (now - last >= ms) { last = now; fn(...args) }
  }
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useListNav<T>({
  items,
  isModalOpen,
  keyActions,
  onRefresh,
}: UseListNavOptions<T>): UseListNavReturn<T> {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const refsRef = useRef<React.RefObject<HTMLDivElement>[]>([])
  while (refsRef.current.length < items.length) refsRef.current.push(createRef<HTMLDivElement>())
  refsRef.current.length = items.length

  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length

  useEffect(() => { setFocusedIndex(null) }, [items])

  useEffect(() => {
    if (focusedIndex === null) return
    const ref = refsRef.current[focusedIndex]
    if (!ref?.current) return
    ref.current.focus()
    ref.current.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  const moveFocusRef = useRef(
    throttle((dir: 'up' | 'down') => {
      setFocusedIndex((prev) => {
        const len = itemsLengthRef.current
        if (len === 0) return null
        if (prev === null) return dir === 'down' ? 0 : len - 1
        if (dir === 'down') return prev < len - 1 ? prev + 1 : prev
        return prev > 0 ? prev - 1 : prev
      })
    }, 80)
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isModalOpen || isEditableElement(document.activeElement)) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveFocusRef.current('down')
          return
        case 'ArrowUp':
          e.preventDefault()
          moveFocusRef.current('up')
          return
        case 'Escape':
          setFocusedIndex(null)
          return
        case 'r':
          if (e.repeat || e.metaKey || e.shiftKey) return
          e.preventDefault()
          onRefresh?.()
          return
        case 'd': {
          if (e.repeat || e.metaKey || e.shiftKey || focusedIndex === null) return
          e.preventDefault()
          keyActions?.onDelete?.(items[focusedIndex])
          return
        }
        case 'c': {
          if (e.repeat || e.metaKey || e.shiftKey || focusedIndex === null) return
          e.preventDefault()
          keyActions?.onCopy?.(items[focusedIndex])
          return
        }
        case 'a': {
          if (e.repeat || e.metaKey || e.shiftKey || focusedIndex === null) return
          e.preventDefault()
          keyActions?.onAccept?.(items[focusedIndex])
          return
        }
        case 'x': {
          if (e.repeat || e.metaKey || e.shiftKey || focusedIndex === null) return
          e.preventDefault()
          keyActions?.onDecline?.(items[focusedIndex])
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, focusedIndex, isModalOpen, keyActions, onRefresh])

  return { focusedIndex, itemRefs: refsRef.current }
}
