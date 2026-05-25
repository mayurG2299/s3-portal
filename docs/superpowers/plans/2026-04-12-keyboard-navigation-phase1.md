# Keyboard Navigation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mac Finder-style keyboard navigation (↑↓ arrow keys, Enter to open folder, Space to preview, Backspace to go up) to the S3 portal files tab.

**Architecture:** A new custom hook `hooks/use-keyboard-nav.ts` owns all keyboard logic and returns `focusedIndex` + stable `itemRefs`. The files page wires up the hook with minimal changes — refs on each card, a focused-card style, and deriving `isModalOpen` from its existing modal state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS. No new dependencies.

---

## Branch Setup — Do this before anything else

```bash
cd /Users/mayur/Personal/projects/s3-portal
git checkout master
git pull
git checkout -b feat/keyboard-navigation-phase1
```

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/use-keyboard-nav.ts` | **Create** | All keyboard event logic, throttle helper, ref management |
| `components/ui/card.tsx` | **Maybe modify** | Add `forwardRef` if not already present (check in Task 1) |
| `app/dashboard/files/page.tsx` | **Modify** | Wire hook, add refs + tabIndex to cards, derive `isModalOpen`, add focused-card Tailwind class |
| `__tests__/hooks/use-keyboard-nav.test.ts` | **Create** | Unit tests for the hook |

---

## Task 1: Check and fix Card ref forwarding

**Files:**
- Read/maybe modify: `components/ui/card.tsx`

This must be done before wiring the hook into `page.tsx` — if `Card` doesn't forward refs, TypeScript will error when we add `ref={itemRefs[index]}` to it.

- [ ] **Step 1: Read the Card component**

```bash
cat /Users/mayur/Personal/projects/s3-portal/components/ui/card.tsx
```

- [ ] **Step 2: If Card does NOT use `React.forwardRef` — update it**

If the current Card looks like:
```tsx
const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('...', className)} {...props} />
)
```

Replace with:
```tsx
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('...', className)} {...props} />
  )
)
Card.displayName = 'Card'
```

- [ ] **Step 3: If Card already uses `forwardRef` — no change needed, proceed to Task 2**

- [ ] **Step 4: Commit if card.tsx was changed**

```bash
git add components/ui/card.tsx
git commit -m "fix: forward ref in Card component for keyboard nav support"
```

---

## Task 2: Create the `useKeyboardNav` hook

**Files:**
- Create: `hooks/use-keyboard-nav.ts`

- [ ] **Step 1: Create the hook file**

```ts
// hooks/use-keyboard-nav.ts
import { useState, useEffect, useRef, createRef, useCallback } from 'react'

interface StoredFile {
  id: string
  name: string
  key: string
  contentType?: string
}

interface UseKeyboardNavOptions {
  files: StoredFile[]
  isModalOpen: boolean
  onNavigateToFolder: (file: StoredFile) => void
  onNavigateUp: () => void
  onPreview: (file: StoredFile) => void
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
  onNavigateToFolder,
  onNavigateUp,
  onPreview,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Stable refs array — grows/shrinks with files.length, never recreated per render
  const refsRef = useRef<React.RefObject<HTMLDivElement>[]>([])
  while (refsRef.current.length < files.length) refsRef.current.push(createRef<HTMLDivElement>())
  refsRef.current.length = files.length
  const itemRefs = refsRef.current

  // Reset focus when file list changes (folder navigation reloads files)
  useEffect(() => {
    setFocusedIndex(null)
  }, [files])

  // Move real DOM focus whenever focusedIndex changes
  useEffect(() => {
    if (focusedIndex === null) return
    const ref = itemRefs[focusedIndex]
    if (!ref?.current) return
    ref.current.focus()
    ref.current.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, itemRefs])

  const moveFocus = useCallback(
    throttle((direction: 'up' | 'down') => {
      setFocusedIndex((prev) => {
        if (files.length === 0) return null
        if (prev === null) return direction === 'down' ? 0 : files.length - 1
        if (direction === 'down') return prev < files.length - 1 ? prev + 1 : prev
        return prev > 0 ? prev - 1 : prev
      })
    }, 80),
    [files.length]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isModalOpen) return
      if (isEditableElement(document.activeElement)) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveFocus('down')
          break
        case 'ArrowUp':
          e.preventDefault()
          moveFocus('up')
          break
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [files, focusedIndex, isModalOpen, moveFocus, onNavigateToFolder, onNavigateUp, onPreview])

  return { focusedIndex, itemRefs }
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `hooks/use-keyboard-nav.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/use-keyboard-nav.ts
git commit -m "feat: add useKeyboardNav hook with throttle and ref management"
```

---

## Task 3: Write unit tests for the hook

**Files:**
- Create: `__tests__/hooks/use-keyboard-nav.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// __tests__/hooks/use-keyboard-nav.test.ts
import { renderHook, act } from '@testing-library/react'
import { useKeyboardNav } from '@/hooks/use-keyboard-nav'

const makeFile = (id: string, name: string, isDir = false) => ({
  id,
  name,
  key: isDir ? `${name}/` : name,
  contentType: isDir ? 'application/x-directory' : 'text/plain',
})

const files = [
  makeFile('1', 'folder-a', true),
  makeFile('2', 'file-b.txt'),
  makeFile('3', 'file-c.png'),
]

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

const baseOptions = {
  files,
  isModalOpen: false,
  onNavigateToFolder: jest.fn(),
  onNavigateUp: jest.fn(),
  onPreview: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('useKeyboardNav', () => {
  test('ArrowDown moves focusedIndex from null to 0', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    expect(result.current.focusedIndex).toBeNull()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowDown moves focus forward through the list', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown')
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(1)
  })

  test('ArrowDown does not go past the last item', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown')
    fireKey('ArrowDown')
    fireKey('ArrowDown')
    fireKey('ArrowDown') // already at last
    expect(result.current.focusedIndex).toBe(2)
  })

  test('ArrowUp does not go below 0', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown') // index 0
    fireKey('ArrowUp')   // still 0
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowUp from null jumps to last item', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowUp')
    expect(result.current.focusedIndex).toBe(files.length - 1)
  })

  test('Enter on folder calls onNavigateToFolder and resets index', () => {
    const onNavigateToFolder = jest.fn()
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, onNavigateToFolder })
    )
    fireKey('ArrowDown') // focus index 0 = folder-a
    fireKey('Enter')
    expect(onNavigateToFolder).toHaveBeenCalledWith(files[0])
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Enter on a file does nothing', () => {
    const onNavigateToFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateToFolder }))
    fireKey('ArrowDown') // 0 = folder
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('Enter')
    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  test('Space calls onPreview for a file', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey(' ')
    expect(onPreview).toHaveBeenCalledWith(files[1])
  })

  test('Space on a folder does nothing', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder-a
    fireKey(' ')
    expect(onPreview).not.toHaveBeenCalled()
  })

  test('Backspace calls onNavigateUp', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    fireKey('Backspace')
    expect(onNavigateUp).toHaveBeenCalled()
  })

  test('no shortcuts fire when isModalOpen is true', () => {
    const onNavigateUp = jest.fn()
    renderHook(() =>
      useKeyboardNav({ ...baseOptions, isModalOpen: true, onNavigateUp })
    )
    fireKey('Backspace')
    expect(onNavigateUp).not.toHaveBeenCalled()
  })

  test('no shortcuts fire when an input is focused', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('Backspace')
    expect(onNavigateUp).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('event.repeat is ignored for Enter', () => {
    const onNavigateToFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateToFolder }))
    fireKey('ArrowDown') // focus folder
    fireKey('Enter', { repeat: true })
    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  test('itemRefs length matches files length', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    expect(result.current.itemRefs).toHaveLength(files.length)
  })
})
```

- [ ] **Step 2: Run the tests — expect all to pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1
```

Expected: all 13 tests pass

- [ ] **Step 3: Commit**

```bash
git add __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "test: add unit tests for useKeyboardNav hook"
```

---

## Task 4: Wire the hook into `page.tsx`

**Files:**
- Modify: `app/dashboard/files/page.tsx`

Key context:
- `navigateToFolder(folderPath: string)` at line 718 — takes a path string. Build it as `` `${currentPath}${file.name}/` ``
- `navigateUp()` at line 722 — existing function, pass directly
- Preview: `setPreviewFile(file)` + `setIsPreviewOpen(true)` (lines 1064–1065 pattern)
- File cards at line 980: `{files.map((file) => (` — needs `index` added
- Card at line 981: `<Card key={file.id} className="p-4 hover:bg-accent/50 transition-colors">`

- [ ] **Step 1: Add the import**

After the existing hook imports (around line 26), add:

```ts
import { useKeyboardNav } from '@/hooks/use-keyboard-nav'
```

- [ ] **Step 2: Derive `isAnyModalOpen` and call the hook**

Add inside `FilesPage()` right after the state declarations block (after `isCdnDialogOpen` around line 101), before the first `useEffect`:

```ts
const isAnyModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isPreviewOpen || isDirectLinkOpen

const { focusedIndex, itemRefs } = useKeyboardNav({
  files,
  isModalOpen: isAnyModalOpen,
  onNavigateToFolder: (file) => navigateToFolder(`${currentPath}${file.name}/`),
  onNavigateUp: navigateUp,
  onPreview: (file) => {
    setPreviewFile(file)
    setIsPreviewOpen(true)
  },
})
```

- [ ] **Step 3: Update the file card map to add index, ref, tabIndex, and focused styling**

Find line 980:
```tsx
{files.map((file) => (
  <Card key={file.id} className="p-4 hover:bg-accent/50 transition-colors">
```

Replace with:
```tsx
{files.map((file, index) => (
  <Card
    key={file.id}
    ref={itemRefs[index] as React.RefObject<HTMLDivElement>}
    tabIndex={0}
    data-keyboard-focused={focusedIndex === index}
    className={cn(
      'p-4 hover:bg-accent/50 transition-colors outline-none',
      'data-[keyboard-focused=true]:bg-accent/30 data-[keyboard-focused=true]:border-border'
    )}
  >
```

`cn` is already imported in `page.tsx` (`import { cn, ... } from '@/lib/utils'`). No additional import needed.

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If you see a ref-related error on `<Card>`, check Task 1 was completed.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: wire useKeyboardNav into files page with focused card styling"
```

---

## Task 5: Manual smoke test in the browser

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npm run dev
```

- [ ] **Step 2: Open the files tab and verify all behaviours**

1. Press `↓` — first file card gets subtle background lift + visible border
2. Press `↓` again — focus moves to second file
3. Press `↑` — focus moves back up
4. Press `↑` at the first item — nothing happens (no wrap-around)
5. Press `↓` to reach a folder, press `Enter` — navigates into folder, focus resets to none
6. Press `Backspace` — goes up one folder level
7. Press `↓` to a file, press `Space` — existing preview modal opens (same as clicking the eye icon)
8. While a modal is open, press `↓` or `Backspace` — nothing happens in the background
9. Click the search/tag filter input, press `↓` — nothing fires
10. Checkbox-select a file and verify the focused-card highlight looks different from the blue checkbox-selected state

- [ ] **Step 3: Fix any visual or behavioural issues found**

```bash
git add -p
git commit -m "fix: keyboard nav smoke test fixes"
```

---

## Task 6: Final checks

- [ ] **Step 1: Confirm on feature branch**

```bash
git branch --show-current
```

Expected: `feat/keyboard-navigation-phase1`

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 3: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors
