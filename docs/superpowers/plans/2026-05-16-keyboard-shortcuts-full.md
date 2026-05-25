# Keyboard Shortcuts — Full App Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard page operable without a mouse — global page-jump shortcuts (Cmd+Shift+1–8), Cmd+K search, file action completions (F/Cmd+L/Cmd+Shift+S/Cmd+U/Cmd+Shift+F), and list navigation on Links/Credentials/Invitations pages.

**Architecture:** A new `use-global-shortcuts` hook mounts at the dashboard-chrome level and owns all cross-page shortcuts. A new `use-list-nav` hook provides reusable ↑/↓ + letter-action navigation for secondary list pages. Existing `use-keyboard-nav` is extended with 5 new file-action callbacks and loses the `?` handler (promoted to global). A tiny `ShortcutsModalContext` lets the files page know when the global shortcuts modal is open so it can suppress keyboard shortcuts.

**Tech Stack:** Next.js 16, TypeScript, React 19, `@testing-library/react` (renderHook), Jest with fake timers, Radix UI Dialog, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-16-keyboard-shortcuts-full-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/contexts/shortcuts-modal-context.tsx` | **Create** | Shares `isShortcutsOpen` boolean from chrome to any page |
| `hooks/use-global-shortcuts.ts` | **Create** | Cmd+K, Cmd+Shift+1–8, Cmd+,, ? — mounted at chrome level |
| `hooks/use-list-nav.ts` | **Create** | Generic ↑/↓ + typed letter-action nav for secondary pages |
| `__tests__/hooks/use-global-shortcuts.test.ts` | **Create** | Unit tests for global shortcuts hook |
| `__tests__/hooks/use-list-nav.test.ts` | **Create** | Unit tests for list nav hook |
| `components/dashboard/global-search.tsx` | **Modify** | Add `forwardRef` + `useImperativeHandle` to expose `focus()` |
| `hooks/use-keyboard-nav.ts` | **Modify** | Remove `?`/`onShowShortcuts`; add F, Cmd+L, Cmd+Shift+S, Cmd+U, Cmd+Shift+F |
| `__tests__/hooks/use-keyboard-nav.test.ts` | **Modify** | Remove ? tests; add tests for 5 new shortcuts |
| `components/keyboard-shortcuts-modal.tsx` | **Modify** | Add Global, Links, Invitations sections; admin-conditional rows; update new folder key |
| `components/dashboard/dashboard-chrome.tsx` | **Modify** | Mount use-global-shortcuts, isShortcutsOpen state, provide context, render modal |
| `app/dashboard/files/page.tsx` | **Modify** | Wire 5 new callbacks; consume ShortcutsModalContext; remove local ? state |
| `app/dashboard/links/page.tsx` | **Modify** | Wire use-list-nav with C (copy) and D (delete) |
| `app/dashboard/credentials/page.tsx` | **Modify** | Wire use-list-nav with D (delete) |
| `app/dashboard/invitations/page.tsx` | **Modify** | Wire use-list-nav with A (accept) and X (decline) |

---

## Task 1: ShortcutsModalContext

**Files:**
- Create: `lib/contexts/shortcuts-modal-context.tsx`

- [ ] **Step 1: Create the context file**

```tsx
// lib/contexts/shortcuts-modal-context.tsx
'use client'

import { createContext, useContext } from 'react'

interface ShortcutsModalContextValue {
  isShortcutsOpen: boolean
}

export const ShortcutsModalContext = createContext<ShortcutsModalContextValue>({
  isShortcutsOpen: false,
})

export function useShortcutsModal() {
  return useContext(ShortcutsModalContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/contexts/shortcuts-modal-context.tsx
git commit -m "feat: add ShortcutsModalContext for cross-page modal state"
```

---

## Task 2: `use-global-shortcuts` hook

**Files:**
- Create: `hooks/use-global-shortcuts.ts`
- Create: `__tests__/hooks/use-global-shortcuts.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/hooks/use-global-shortcuts.test.ts
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'

// Mock next/navigation router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

const baseOptions = {
  onOpenSearch: jest.fn(),
  onOpenShortcuts: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('useGlobalShortcuts', () => {
  test('Cmd+K calls onOpenSearch even when no input is focused', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('k', { metaKey: true })
    expect(baseOptions.onOpenSearch).toHaveBeenCalledTimes(1)
  })

  test('Cmd+K calls onOpenSearch even when an input IS focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('k', { metaKey: true })
    expect(baseOptions.onOpenSearch).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  test('? calls onOpenShortcuts', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('?')
    expect(baseOptions.onOpenShortcuts).toHaveBeenCalledTimes(1)
  })

  test('? does NOT fire when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('?')
    expect(baseOptions.onOpenShortcuts).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('Cmd+Shift+2 navigates to /dashboard/files', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('2', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/files')
  })

  test('Cmd+Shift+1 navigates to /dashboard', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('1', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  test('Cmd+Shift+7 navigates to /dashboard/admin/permissions', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('7', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/admin/permissions')
  })

  test('Cmd+Shift+2 does NOT fire when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('2', { metaKey: true, shiftKey: true })
    expect(mockPush).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('Cmd+, navigates to /dashboard/settings', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey(',', { metaKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/settings')
  })

  test('listener is removed on unmount', () => {
    const spy = jest.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useGlobalShortcuts(baseOptions))
    unmount()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npx jest __tests__/hooks/use-global-shortcuts.test.ts --no-coverage
```
Expected: module not found / all tests fail.

- [ ] **Step 3: Implement the hook**

```ts
// hooks/use-global-shortcuts.ts
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UseGlobalShortcutsOptions {
  onOpenSearch: () => void
  onOpenShortcuts: () => void
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

const PAGE_MAP: Record<string, string> = {
  '1': '/dashboard',
  '2': '/dashboard/files',
  '3': '/dashboard/links',
  '4': '/dashboard/invitations',
  '5': '/dashboard/teams',
  '6': '/dashboard/settings',
  '7': '/dashboard/admin/permissions',
  '8': '/dashboard/admin/audit',
}

export function useGlobalShortcuts({ onOpenSearch, onOpenShortcuts }: UseGlobalShortcutsOptions) {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K — focus search (never blocked)
      if (e.key === 'k' && e.metaKey && !e.shiftKey && !e.repeat) {
        e.preventDefault()
        onOpenSearch()
        return
      }

      // All other shortcuts blocked when typing
      if (isEditableElement(document.activeElement)) return

      // ? — open shortcuts modal
      if (e.key === '?' && !e.repeat) {
        e.preventDefault()
        onOpenShortcuts()
        return
      }

      // Cmd+, — settings
      if (e.key === ',' && e.metaKey && !e.repeat) {
        e.preventDefault()
        router.push('/dashboard/settings')
        return
      }

      // Cmd+Shift+Number — page navigation
      if (e.metaKey && e.shiftKey && !e.repeat && PAGE_MAP[e.key]) {
        e.preventDefault()
        router.push(PAGE_MAP[e.key])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenSearch, onOpenShortcuts, router])
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npx jest __tests__/hooks/use-global-shortcuts.test.ts --no-coverage
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-global-shortcuts.ts __tests__/hooks/use-global-shortcuts.test.ts
git commit -m "feat: add use-global-shortcuts hook (Cmd+K, Cmd+Shift+1-8, Cmd+,, ?)"
```

---

## Task 3: `use-list-nav` hook

**Files:**
- Create: `hooks/use-list-nav.ts`
- Create: `__tests__/hooks/use-list-nav.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/hooks/use-list-nav.test.ts
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useListNav } from '@/hooks/use-list-nav'

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

function advanceThrottle() {
  act(() => { jest.advanceTimersByTime(100) })
}

const items = [{ id: '1' }, { id: '2' }, { id: '3' }]

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

describe('useListNav', () => {
  test('ArrowDown moves focusedIndex from null to 0', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    expect(result.current.focusedIndex).toBeNull()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowDown does not go past last item', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(2)
  })

  test('ArrowUp does not go below 0', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown')
    fireKey('ArrowUp')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('Escape clears focusedIndex', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown')
    fireKey('Escape')
    expect(result.current.focusedIndex).toBeNull()
  })

  test('D calls onDelete with the focused item', () => {
    const onDelete = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
    fireKey('d')
    expect(onDelete).toHaveBeenCalledWith(items[0])
  })

  test('C calls onCopy with the focused item', () => {
    const onCopy = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onCopy } })
    )
    fireKey('ArrowDown')
    fireKey('c')
    expect(onCopy).toHaveBeenCalledWith(items[0])
  })

  test('A calls onAccept with the focused item', () => {
    const onAccept = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onAccept } })
    )
    fireKey('ArrowDown')
    fireKey('a')
    expect(onAccept).toHaveBeenCalledWith(items[0])
  })

  test('X calls onDecline with the focused item', () => {
    const onDecline = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDecline } })
    )
    fireKey('ArrowDown')
    fireKey('x')
    expect(onDecline).toHaveBeenCalledWith(items[0])
  })

  test('R calls onRefresh', () => {
    const onRefresh = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, onRefresh })
    )
    fireKey('r')
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  test('D does nothing when no item is focused', () => {
    const onDelete = jest.fn()
    renderHook(() => useListNav({ items, isModalOpen: false, keyActions: { onDelete } }))
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('nothing fires when isModalOpen is true', () => {
    const onDelete = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: true, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBeNull()
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('nothing fires when an input is focused', () => {
    const onDelete = jest.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBeNull()
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('itemRefs length matches items length', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    expect(result.current.itemRefs).toHaveLength(3)
  })

  test('providing onDelete but not onCopy means C silently does nothing', () => {
    const onDelete = jest.fn()
    renderHook(() => useListNav({ items, isModalOpen: false, keyActions: { onDelete } }))
    fireKey('ArrowDown')
    fireKey('c')  // no onCopy provided — should not throw
    expect(onDelete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npx jest __tests__/hooks/use-list-nav.test.ts --no-coverage
```

- [ ] **Step 3: Implement the hook**

```ts
// hooks/use-list-nav.ts
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
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npx jest __tests__/hooks/use-list-nav.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add hooks/use-list-nav.ts __tests__/hooks/use-list-nav.test.ts
git commit -m "feat: add use-list-nav hook for secondary page keyboard navigation"
```

---

## Task 4: GlobalSearch — expose `focus()` via forwardRef

**Files:**
- Modify: `components/dashboard/global-search.tsx`

- [ ] **Step 1: Add the forwardRef interface and handle**

At the top of `global-search.tsx`, add the handle interface and convert the component to `forwardRef`. The change is surgical — only the export signature and a `useImperativeHandle` call change; all internal logic stays identical.

Find this export line:
```ts
export function GlobalSearch({ onFocusChange }: { onFocusChange?: (focused: boolean) => void }) {
```

Replace with:
```ts
export interface GlobalSearchHandle {
  focus: () => void
}

export const GlobalSearch = forwardRef<GlobalSearchHandle, { onFocusChange?: (focused: boolean) => void }>(
  function GlobalSearch({ onFocusChange }, ref) {
```

Update the React import at the top (current file uses `import React, { useState, useEffect, useRef, useCallback } from 'react'`). Add `forwardRef` and `useImperativeHandle` to the named imports — keep `React` default import if it's already there:
```ts
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
```

Inside the function body, immediately after the `inputRef` is declared, add:
```ts
useImperativeHandle(ref, () => ({
  focus: () => inputRef.current?.focus(),
}))
```

Close the component with an extra `)` (the `forwardRef` wrapper):
```ts
  // ... existing return JSX ...
  }
)
GlobalSearch.displayName = 'GlobalSearch'
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to GlobalSearch.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/global-search.tsx
git commit -m "refactor: expose focus() on GlobalSearch via forwardRef for Cmd+K wiring"
```

---

## Task 5: `use-keyboard-nav` — atomic ? removal + 5 new shortcuts

**ATOMIC REQUIREMENT:** This task modifies both `use-keyboard-nav.ts` and its test file. Both changes must be committed together — if only one lands, the ? shortcut fires twice on the files page (once from the old hook, once from use-global-shortcuts).

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `__tests__/hooks/use-keyboard-nav.test.ts`

- [ ] **Step 1: Write failing tests for the 5 new shortcuts** (add to existing test file)

Append these tests inside the existing `describe('useKeyboardNav', () => {` block in `__tests__/hooks/use-keyboard-nav.test.ts`:

```ts
// --- New shortcuts ---

test('F on a focused file calls onFavorite', () => {
  const onFavorite = jest.fn()
  const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
  fireKey('ArrowDown')       // index 0: folder-a
  advanceThrottle()          // must advance throttle before next arrow
  fireKey('ArrowDown')       // index 1: file-b.txt
  advanceThrottle()
  fireKey('f')
  expect(onFavorite).toHaveBeenCalledWith(files[1])
})

test('F on a focused folder does NOT call onFavorite', () => {
  const onFavorite = jest.fn()
  renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
  fireKey('ArrowDown')       // focus index 0: folder-a
  fireKey('f')
  expect(onFavorite).not.toHaveBeenCalled()
})

test('F does NOT trigger type-ahead (return not break)', () => {
  const onFavorite = jest.fn()
  const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
  // Put focus on a file first
  fireKey('ArrowDown'); advanceThrottle()
  fireKey('ArrowDown'); advanceThrottle() // index 1: file-b.txt
  const indexBefore = result.current.focusedIndex
  fireKey('f')
  // Type-ahead would jump focus to a file starting with 'f'
  // focusedIndex should NOT have changed (still index 1)
  expect(result.current.focusedIndex).toBe(indexBefore)
  expect(onFavorite).toHaveBeenCalledTimes(1)
})

test('Cmd+Shift+F calls onNewFolder', () => {
  const onNewFolder = jest.fn()
  renderHook(() => useKeyboardNav({ ...baseOptions, onNewFolder }))
  fireKey('f', { metaKey: true, shiftKey: true })
  expect(onNewFolder).toHaveBeenCalledTimes(1)
})

test('Cmd+Shift+F does not call onFavorite', () => {
  const onFavorite = jest.fn()
  const onNewFolder = jest.fn()
  renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite, onNewFolder }))
  fireKey('ArrowDown'); advanceThrottle()
  fireKey('ArrowDown'); advanceThrottle()
  fireKey('f', { metaKey: true, shiftKey: true })
  expect(onFavorite).not.toHaveBeenCalled()
  expect(onNewFolder).toHaveBeenCalledTimes(1)
})

test('Cmd+L on a focused file calls onDirectLink', () => {
  const onDirectLink = jest.fn()
  const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onDirectLink }))
  fireKey('ArrowDown'); advanceThrottle()
  fireKey('ArrowDown'); advanceThrottle() // index 1: file-b.txt
  fireKey('l', { metaKey: true })
  expect(onDirectLink).toHaveBeenCalledWith(files[1])
})

test('Cmd+Shift+S on a focused file calls onShare', () => {
  const onShare = jest.fn()
  renderHook(() => useKeyboardNav({ ...baseOptions, onShare }))
  fireKey('ArrowDown')
  fireKey('s', { metaKey: true, shiftKey: true })
  expect(onShare).toHaveBeenCalledWith(files[0])
})

test('Cmd+U calls onUpload regardless of focus', () => {
  const onUpload = jest.fn()
  renderHook(() => useKeyboardNav({ ...baseOptions, onUpload }))
  fireKey('u', { metaKey: true })
  expect(onUpload).toHaveBeenCalledTimes(1)
})

test('none of the new shortcuts fire when isModalOpen is true', () => {
  const onFavorite = jest.fn()
  const onDirectLink = jest.fn()
  const onShare = jest.fn()
  const onUpload = jest.fn()
  const onNewFolder = jest.fn()
  renderHook(() => useKeyboardNav({
    ...baseOptions,
    isModalOpen: true,
    onFavorite, onDirectLink, onShare, onUpload, onNewFolder,
  }))
  fireKey('f')
  fireKey('l', { metaKey: true })
  fireKey('s', { metaKey: true, shiftKey: true })
  fireKey('u', { metaKey: true })
  fireKey('f', { metaKey: true, shiftKey: true })
  expect(onFavorite).not.toHaveBeenCalled()
  expect(onDirectLink).not.toHaveBeenCalled()
  expect(onShare).not.toHaveBeenCalled()
  expect(onUpload).not.toHaveBeenCalled()
  expect(onNewFolder).not.toHaveBeenCalled()
})
```

Also **replace** the existing `?` tests (lines ~394–425 in the test file) with a single comment:

```ts
// ? shortcut moved to use-global-shortcuts — tested in use-global-shortcuts.test.ts
```

- [ ] **Step 2: Run the new tests — verify they FAIL**

```bash
npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```
Expected: the new test blocks fail (callbacks not implemented); existing tests still pass.

- [ ] **Step 3: Modify `use-keyboard-nav.ts`**

**3a — Remove `onShowShortcuts`:**
- Remove `onShowShortcuts?: () => void` from `UseKeyboardNavOptions`
- Remove the entire `?` handler block (currently lines 133–137):
  ```ts
  // DELETE THIS BLOCK:
  if (!e.repeat && e.key === '?' && !isModalOpen && !isEditableElement(document.activeElement)) {
    e.preventDefault()
    onShowShortcuts?.()
    return
  }
  ```
- Remove `onShowShortcuts` from the `useEffect` dependency array (last line of the effect)

**3b — Add 5 new optional callbacks to `UseKeyboardNavOptions`:**
```ts
onFavorite?: (file: StoredFile) => void
onDirectLink?: (file: StoredFile) => void
onShare?: (file: StoredFile) => void
onUpload?: () => void
onNewFolder?: () => void
```

**3c — Add new switch cases** inside `switch (e.key)`, before the closing `}`:

```ts
case 'f': {
  if (e.repeat) break
  // Cmd+Shift+F = new folder (no file focus needed)
  if (e.metaKey && e.shiftKey) {
    e.preventDefault()
    onNewFolder?.()
    return   // return, not break — prevents type-ahead
  }
  // Plain F = favorite (no modifier allowed)
  if (e.metaKey || e.shiftKey || e.altKey) break
  if (focusedIndex === null) break
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file || isFolder(file)) break
  onFavorite?.(file)
  return   // return, not break — prevents type-ahead
}
case 'l': {
  if (!e.metaKey || e.shiftKey || e.repeat) break
  if (focusedIndex === null) break
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file || isFolder(file)) break
  onDirectLink?.(file)
  return
}
case 's': {
  if (!e.metaKey || !e.shiftKey || e.repeat) break
  if (focusedIndex === null) break
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file) break
  onShare?.(file)
  return
}
case 'u': {
  if (!e.metaKey || e.shiftKey || e.repeat) break
  e.preventDefault()
  onUpload?.()
  return
}
```

**3d — Update `useEffect` dependency array** — add the 5 new callbacks, remove `onShowShortcuts`:
```ts
  }, [files, focusedIndex, isModalOpen, isPreviewOpen, onNavigateToFolder, onNavigateUp,
      onPreview, onClosePreview, onDelete, onSelectAll, selectedFileIds, onSetSelectedFileIds,
      onFavorite, onDirectLink, onShare, onUpload, onNewFolder])
```

- [ ] **Step 4: Run ALL keyboard nav tests — verify they PASS**

```bash
npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage
```
Expected: all tests pass (old ones and new ones).

- [ ] **Step 5: Commit (atomic)**

```bash
git add hooks/use-keyboard-nav.ts __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: add F/Cmd+L/Cmd+Shift+S/Cmd+U/Cmd+Shift+F shortcuts; remove ? (now global)"
```

---

## Task 6: Expand `KeyboardShortcutsModal`

**Files:**
- Modify: `components/keyboard-shortcuts-modal.tsx`

- [ ] **Step 1: Read the full current file**

```bash
cat components/keyboard-shortcuts-modal.tsx
```

- [ ] **Step 2: Replace the SECTIONS constant and add RBAC import**

Add `useRBAC` import:
```ts
import { useRBAC } from '@/components/rbac-provider'
```

Replace the static `SECTIONS` constant with a component-level variable inside `KeyboardShortcutsModal` that uses `isAdmin`. The component becomes:

```tsx
export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const { isAdmin } = useRBAC()

  const globalRows: ShortcutRow[] = [
    { label: 'Search', keys: ['⌘K'] },
    { label: 'Settings', keys: ['⌘,'] },
    { label: 'Dashboard', keys: ['⌘⇧1'] },
    { label: 'Files', keys: ['⌘⇧2'] },
    { label: 'Links', keys: ['⌘⇧3'] },
    { label: 'Invitations', keys: ['⌘⇧4'] },
    { label: 'Teams', keys: ['⌘⇧5'] },
    { label: 'Settings', keys: ['⌘⇧6'] },
    ...(isAdmin ? [
      { label: 'Permissions (admin)', keys: ['⌘⇧7'] },
      { label: 'Audit Logs (admin)', keys: ['⌘⇧8'] },
    ] : []),
  ]

  const sections: ShortcutSection[] = [
    {
      heading: 'Global',
      rows: globalRows,
    },
    {
      heading: 'Navigation',
      rows: [
        { label: 'Move focus', keys: ['↑', '↓'] },
        { label: 'Open folder', keys: ['↵', '⌘↓'] },
        { label: 'Go up', keys: ['⌫', '⌘↑'] },
        { label: 'Jump to name', keys: ['A–Z'] },
      ],
    },
    {
      heading: 'File Actions',
      rows: [
        { label: 'Preview', keys: ['Space'] },
        { label: 'Favorite', keys: ['F'] },
        { label: 'Direct link', keys: ['⌘L'] },
        { label: 'Share', keys: ['⌘⇧S'] },
        { label: 'Delete', keys: ['Del'] },
        { label: 'Upload', keys: ['⌘U'] },
        { label: 'New folder', keys: ['⌘⇧F'] },
      ],
    },
    {
      heading: 'Selection',
      rows: [
        { label: 'Select all', keys: ['⌘A'] },
        { label: 'Extend selection', keys: ['⇧↑', '⇧↓'] },
        { label: 'Clear / close', keys: ['Esc'] },
      ],
    },
    {
      heading: 'Links Page',
      rows: [
        { label: 'Copy URL', keys: ['C'] },
        { label: 'Delete link', keys: ['D'] },
      ],
    },
    {
      heading: 'Invitations Page',
      rows: [
        { label: 'Accept', keys: ['A'] },
        { label: 'Decline', keys: ['X'] },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex gap-1">
                      {row.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Remove the top-level `SECTIONS` constant — it's now built inside the component.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "keyboard-shortcuts" | head -10
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/keyboard-shortcuts-modal.tsx
git commit -m "feat: expand shortcuts modal with global, links, invitations sections and admin rows"
```

---

## Task 7: Wire everything in `dashboard-chrome.tsx`

**Files:**
- Modify: `components/dashboard/dashboard-chrome.tsx`

- [ ] **Step 1: Add imports**

The existing React import is `import { useCallback, useEffect, useState } from 'react'`. Add only `useRef` (useState is already present):
```ts
import { useCallback, useEffect, useState, useRef } from 'react'
```

Then add three new imports below the existing import block:
```ts
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal'
import { ShortcutsModalContext } from '@/lib/contexts/shortcuts-modal-context'
import type { GlobalSearchHandle } from '@/components/dashboard/global-search'
```

- [ ] **Step 2: Add state and refs** inside `DashboardChrome`, after existing state:

```ts
const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
const searchRef = useRef<GlobalSearchHandle>(null)
```

- [ ] **Step 3: Mount the global shortcuts hook** after the existing `useEffect` hooks:

```ts
useGlobalShortcuts({
  onOpenSearch: () => searchRef.current?.focus(),
  onOpenShortcuts: () => setIsShortcutsOpen(true),
})
```

- [ ] **Step 4: Pass `ref` to `GlobalSearch`**

Find:
```tsx
<GlobalSearch onFocusChange={(focused: boolean) => {
```
Replace with:
```tsx
<GlobalSearch ref={searchRef} onFocusChange={(focused: boolean) => {
```

- [ ] **Step 5: Wrap the `RBACProvider` content with context and add modal**

Find the `<RBACProvider>` opening tag and wrap its content:

```tsx
<RBACProvider>
  <ShortcutsModalContext.Provider value={{ isShortcutsOpen }}>
    <div className="flex overflow-hidden min-h-screen">
      {/* ... existing sidebar and main content ... */}
    </div>
    <KeyboardShortcutsModal
      open={isShortcutsOpen}
      onClose={() => setIsShortcutsOpen(false)}
    />
  </ShortcutsModalContext.Provider>
</RBACProvider>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/dashboard-chrome.tsx
git commit -m "feat: wire global shortcuts, Cmd+K search focus, and ? modal in dashboard chrome"
```

---

## Task 8: Update `files/page.tsx`

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 1: Add `useShortcutsModal` import and consume context**

Add import:
```ts
import { useShortcutsModal } from '@/lib/contexts/shortcuts-modal-context'
```

Inside the component, add after the existing state declarations:
```ts
const { isShortcutsOpen } = useShortcutsModal()
```

- [ ] **Step 2: Update `isAnyModalOpen`**

Find the existing `isAnyModalOpen` expression (around line 145) — it currently includes `isShortcutsOpen` as local state. It now reads from context:
```ts
const isAnyModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isDirectLinkOpen || isCdnDialogOpen || isShortcutsOpen
```
This line stays identical — `isShortcutsOpen` now just comes from context instead of local state.

- [ ] **Step 3: Remove local `isShortcutsOpen` state**

Delete:
```ts
const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
```

- [ ] **Step 4: Wire 5 new callbacks into `useKeyboardNav`**

Find the existing `useKeyboardNav({...})` call (around line 149). Add the 5 new callbacks and remove `onShowShortcuts`:

```ts
const { focusedIndex, itemRefs } = useKeyboardNav({
  files: displayedFiles,
  isModalOpen: isAnyModalOpen,
  isPreviewOpen,
  onNavigateToFolder: ...,  // unchanged
  onNavigateUp: ...,        // unchanged
  onPreview: ...,           // unchanged
  onClosePreview: ...,      // unchanged
  onDelete: ...,            // unchanged
  onSelectAll: ...,         // unchanged
  selectedFileIds,          // unchanged
  onSetSelectedFileIds: ...,// unchanged
  // NEW:
  onFavorite: (file) => handleToggleFavorite(file),
  onDirectLink: (file) => { setDirectLinkFile(file); setIsDirectLinkOpen(true) },
  onShare: (file) => { setShareTargets([file]); setIsShareOpen(true) },
  onUpload: () => setIsUploadOpen(true),
  onNewFolder: () => setIsFolderDialogOpen(true),
  // REMOVED: onShowShortcuts
})
```

- [ ] **Step 5: Remove the floating `?` button and local modal**

Find the floating `?` button JSX (near bottom of the component):
```tsx
<button
  onClick={() => setIsShortcutsOpen(true)}
  ...
>
  ?
</button>
```
Delete it entirely.

Find the `<KeyboardShortcutsModal .../>` render (last line before closing tag):
```tsx
<KeyboardShortcutsModal open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
```
Delete it — the modal now lives in `dashboard-chrome`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: wire F/Cmd+L/Cmd+Shift+S/Cmd+U/Cmd+Shift+F shortcuts on files page"
```

---

## Task 9: Wire `links/page.tsx`

**Files:**
- Modify: `app/dashboard/links/page.tsx`

- [ ] **Step 1: Add import and state**

```ts
import { useListNav } from '@/hooks/use-list-nav'
```

Find where `links` state is set and `isLoading` is declared. Add a delete-confirmation state:
```ts
const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
```

- [ ] **Step 2: Add `useListNav` call** after the existing state, before the `useEffect`:

```ts
const { focusedIndex, itemRefs } = useListNav({
  items: links,
  isModalOpen: !!deleteTargetId,
  keyActions: {
    onCopy: (link) => {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/share/${link.hash}`
      navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'URL copied to clipboard' })
    },
    onDelete: (link) => setDeleteTargetId(link.id),
  },
  onRefresh: () => router.refresh(),
})
```

- [ ] **Step 3: Wire `ref` and `tabIndex` onto each link card**

Find the outermost div of each link card in the JSX (the one rendered per link in the map). Add:
```tsx
ref={itemRefs[index] as React.RefObject<HTMLDivElement>}
tabIndex={0}
data-keyboard-focused={focusedIndex === index}
className={cn(
  existingClasses,
  'outline-none focus:ring-0 data-[keyboard-focused=true]:ring-2 data-[keyboard-focused=true]:ring-primary/50 data-[keyboard-focused=true]:bg-white/[0.04]'
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/links/page.tsx
git commit -m "feat: add keyboard navigation (↑↓ C D) to links page"
```

---

## Task 10: Wire `credentials/page.tsx`

**Files:**
- Modify: `app/dashboard/credentials/page.tsx`

- [ ] **Step 1: Add import**

```ts
import { useListNav } from '@/hooks/use-list-nav'
```

- [ ] **Step 2: Add `useListNav` call** — find existing `credentials` state and add after it:

```ts
const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

const { focusedIndex, itemRefs } = useListNav({
  items: credentials,
  isModalOpen: !!deleteTargetId,
  keyActions: {
    onDelete: (cred) => setDeleteTargetId(cred.id),
  },
})
```

- [ ] **Step 3: Wire `ref`, `tabIndex`, `data-keyboard-focused` onto each credential card** (same pattern as links page)

- [ ] **Step 4: Verify TypeScript and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add app/dashboard/credentials/page.tsx
git commit -m "feat: add keyboard navigation (↑↓ D) to credentials page"
```

---

## Task 11: Wire `invitations/page.tsx`

**Files:**
- Modify: `app/dashboard/invitations/page.tsx`

- [ ] **Step 1: Add import**

```ts
import { useListNav } from '@/hooks/use-list-nav'
```

- [ ] **Step 2: Note the real handler function**

The invitations page uses a single `handleAction(inviteId: string, action: 'accept' | 'decline')` function (not separate accept/decline functions). The `invitations` array comes from `useDashboard()`.

- [ ] **Step 3: Add `useListNav` call**

```ts
const { focusedIndex, itemRefs } = useListNav({
  items: invitations,
  isModalOpen: false,
  keyActions: {
    onAccept: (invite) => handleAction(invite.id, 'accept'),
    onDecline: (invite) => handleAction(invite.id, 'decline'),
  },
})
```

- [ ] **Step 4: Wire `ref`, `tabIndex`, `data-keyboard-focused` onto each invite card** (same pattern as links page)

- [ ] **Step 5: Verify TypeScript and run full test suite**

```bash
npx tsc --noEmit 2>&1 | head -10
npx jest --no-coverage 2>&1 | tail -10
```
Expected: TypeScript clean, all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add app/dashboard/invitations/page.tsx
git commit -m "feat: add keyboard navigation (↑↓ A X) to invitations page"
```

---

## Final QA Checklist (manual, in browser)

- [ ] `?` opens shortcuts modal from any page (Dashboard, Files, Links, Settings)
- [ ] `Cmd+K` focuses search bar from any page, including while typing in an unrelated input
- [ ] `Cmd+Shift+2` navigates to Files page; `Cmd+Shift+3` to Links; etc.
- [ ] `Cmd+,` navigates to Settings
- [ ] On Files page: `F` favorites focused file; `Cmd+Shift+F` opens new folder modal; `Cmd+L` opens direct link; `Cmd+Shift+S` opens share modal; `Cmd+U` opens upload modal
- [ ] Shortcuts modal shows Global section with ⌘⇧1–6; admin rows (⌘⇧7, ⌘⇧8) visible only when logged in as admin
- [ ] Shortcuts modal shows new folder as ⌘⇧F (not ⌘⇧N)
- [ ] `Delete` key does NOT fire while shortcuts modal is open
- [ ] On Links page: `↑/↓` moves focus; `C` copies link URL; `D` triggers delete confirmation
- [ ] On Invitations page: `↑/↓` moves focus; `A` accepts; `X` declines
- [ ] On Credentials page: `↑/↓` moves focus; `D` triggers delete confirmation
- [ ] **Browser conflict QA:** test `Cmd+L` in Chrome macOS (verify address bar not stolen); `Cmd+U` in Safari (verify no View Source); `Cmd+K` in Chrome (verify search focused, not address bar)
