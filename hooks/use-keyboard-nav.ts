// hooks/use-keyboard-nav.ts
import { useState, useEffect, useRef, createRef } from 'react'

interface StoredFile {
  id: string
  name: string
  key: string
  contentType?: string
}

interface UseKeyboardNavOptions {
  files: StoredFile[]
  isModalOpen: boolean
  isPreviewOpen: boolean
  onNavigateToFolder: (file: StoredFile) => void
  onNavigateUp: () => void
  onPreview: (file: StoredFile) => void
  onClosePreview?: () => void
  onDelete?: (file: StoredFile) => void
}

interface UseKeyboardNavReturn {
  focusedIndex: number | null
  itemRefs: React.RefObject<HTMLDivElement>[]
}

function throttle<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let last = 0
  return (...args: T) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }
}

function isFolder(file: StoredFile): boolean {
  return file.key.endsWith('/') || file.contentType === 'application/x-directory'
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useKeyboardNav({
  files,
  isModalOpen,
  isPreviewOpen,
  onNavigateToFolder,
  onNavigateUp,
  onPreview,
  onClosePreview,
  onDelete,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Stable refs array — grows/shrinks with files.length, never recreated per render
  const refsRef = useRef<React.RefObject<HTMLDivElement>[]>([])
  while (refsRef.current.length < files.length) refsRef.current.push(createRef<HTMLDivElement>())
  refsRef.current.length = files.length
  // Reset focus when file list changes (folder navigation reloads files)
  useEffect(() => {
    setFocusedIndex(null)
  }, [files])

  // Move real DOM focus whenever focusedIndex changes
  useEffect(() => {
    if (focusedIndex === null) return
    const ref = refsRef.current[focusedIndex]
    if (!ref?.current) return
    ref.current.focus()
    ref.current.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  // Stable ref to files.length so the throttled function never closes over stale values
  const filesLengthRef = useRef(files.length)
  filesLengthRef.current = files.length

  // Single throttled moveFocus instance — created once, reads filesLengthRef for current length
  const moveFocusRef = useRef(
    throttle((direction: 'up' | 'down') => {
      setFocusedIndex((prev) => {
        const len = filesLengthRef.current
        if (len === 0) return null
        if (prev === null) return direction === 'down' ? 0 : len - 1
        if (direction === 'down') return prev < len - 1 ? prev + 1 : prev
        return prev > 0 ? prev - 1 : prev
      })
    }, 80)
  )

  // Stable ref to onPreview so the preview-navigation effect never closes over stale callbacks
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview

  // When preview is open and focusedIndex changes, preview the newly focused file (if not a folder)
  const prevFocusedIndexRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isPreviewOpen) {
      prevFocusedIndexRef.current = focusedIndex
      return
    }
    if (focusedIndex === null) return
    if (focusedIndex === prevFocusedIndexRef.current) return
    prevFocusedIndexRef.current = focusedIndex
    const file = files[focusedIndex]
    if (file && !isFolder(file)) onPreviewRef.current(file)
  }, [files, focusedIndex, isPreviewOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isModalOpen) return
        if (isPreviewOpen) {
          onClosePreview?.()
        }
        setFocusedIndex(null)
        return
      }

      // While preview is open: only allow arrow keys to navigate between files
      if (isPreviewOpen) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveFocusRef.current('down') }
        if (e.key === 'ArrowUp') { e.preventDefault(); moveFocusRef.current('up') }
        return
      }

      if (isModalOpen) return
      if (isEditableElement(document.activeElement)) return

      switch (e.key) {
        case 'ArrowUp': {
          if (e.metaKey) {
            if (e.repeat) return
            e.preventDefault()
            onNavigateUp()
            return
          }
          e.preventDefault()
          moveFocusRef.current('up')
          break
        }
        case 'ArrowDown': {
          if (e.metaKey) {
            if (e.repeat) return
            if (focusedIndex === null) return
            e.preventDefault()
            const file = files[focusedIndex]
            if (!file) return
            if (isFolder(file)) {
              onNavigateToFolder(file)
              setFocusedIndex(null)
            } else {
              onPreview(file)
            }
            return
          }
          e.preventDefault()
          moveFocusRef.current('down')
          break
        }
        case 'Enter': {
          if (e.repeat) return
          if (focusedIndex === null) return
          e.preventDefault()
          const file = files[focusedIndex]
          if (!file) return
          if (isFolder(file)) {
            onNavigateToFolder(file)
            setFocusedIndex(null)
          }
          break
        }
        case ' ': {
          if (e.repeat) return
          if (focusedIndex === null) return
          e.preventDefault()
          const file = files[focusedIndex]
          if (!file || isFolder(file)) return
          onPreview(file)
          break
        }
        case 'Backspace': {
          if (e.repeat) return
          e.preventDefault()
          onNavigateUp()
          break
        }
        case 'Delete': {
          if (e.repeat) return
          if (focusedIndex === null) return
          e.preventDefault()
          const file = files[focusedIndex]
          if (!file || !onDelete) return
          onDelete(file)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [files, focusedIndex, isModalOpen, isPreviewOpen, onNavigateToFolder, onNavigateUp, onPreview, onClosePreview, onDelete])

  return { focusedIndex, itemRefs: refsRef.current }
}
