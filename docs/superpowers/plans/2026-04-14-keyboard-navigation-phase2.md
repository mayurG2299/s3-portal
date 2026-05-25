# Keyboard Navigation Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the remaining Mac Finder-style keybindings: `Escape`, `Delete`, `Cmd+↑`, `Cmd+↓`, `Cmd+A`, `Shift+↑/↓` (extend selection), and type-ahead navigation.

**Architecture:** All new key logic lives in `hooks/use-keyboard-nav.ts`. The hook gains two new callbacks (`onDelete`, `onSelectAll`) and returns `onExtendSelection` is handled internally via `selectedFileIds`/`setSelectedFileIds` — but since selection state lives in `page.tsx`, the hook will accept `selectedFileIds` + `onSetSelectedFileIds` props so it stays the single source of keyboard truth. `page.tsx` wires up the new callbacks with minimal changes.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS. No new dependencies.

**Branch:** `feat/keyboard-navigation-phase1` (continue on this branch)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/use-keyboard-nav.ts` | **Modify** | Add Escape, Delete, Cmd+↑, Cmd+↓, Cmd+A, Shift+Arrow, type-ahead |
| `app/dashboard/files/page.tsx` | **Modify** | Wire new callbacks: `onDelete`, `onSelectAll`, `selectedFileIds`, `onSetSelectedFileIds` |
| `__tests__/hooks/use-keyboard-nav.test.ts` | **Modify** | Add tests for every new keybinding |

---

## Task 1: Update hook interface and add Escape + Cmd+↑ + Cmd+↓

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `__tests__/hooks/use-keyboard-nav.test.ts`

These three are the simplest additions — no selection state needed.

- [ ] **Step 1: Write failing tests first**

Add to `__tests__/hooks/use-keyboard-nav.test.ts` inside the existing `describe('useKeyboardNav')` block:

```ts
  test('Escape clears focusedIndex', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown') // index 0
    expect(result.current.focusedIndex).toBe(0)
    fireKey('Escape')
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Escape calls onClosePreview when preview is open', () => {
    const onClosePreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: true, onClosePreview }))
    fireKey('Escape')
    expect(onClosePreview).toHaveBeenCalled()
  })

  test('Escape does not call onClosePreview when preview is closed', () => {
    const onClosePreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: false, onClosePreview }))
    fireKey('ArrowDown')
    fireKey('Escape')
    expect(onClosePreview).not.toHaveBeenCalled()
  })

  test('Cmd+ArrowUp calls onNavigateUp', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    fireKey('ArrowUp', { metaKey: true })
    expect(onNavigateUp).toHaveBeenCalled()
  })

  test('Cmd+ArrowDown on folder calls onNavigateToFolder', () => {
    const onNavigateToFolder = jest.fn()
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, onNavigateToFolder })
    )
    fireKey('ArrowDown') // focus index 0 = folder-a
    fireKey('ArrowDown', { metaKey: true })
    expect(onNavigateToFolder).toHaveBeenCalledWith(files[0])
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Cmd+ArrowDown on file calls onPreview', () => {
    const onPreview = jest.fn()
    const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('ArrowDown', { metaKey: true })
    expect(onPreview).toHaveBeenCalledWith(files[1])
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

Expected: new tests FAIL

- [ ] **Step 3: Implement in the hook**

First, add `onClosePreview` to `UseKeyboardNavOptions` and destructure it:

```ts
onClosePreview?: () => void
```

In `hooks/use-keyboard-nav.ts`, inside `handleKeyDown`, add the Escape handler as the **very first thing** — before the `if (isPreviewOpen)` block and before `if (isModalOpen)`. This ensures Escape works correctly whether or not the preview is open:

```ts
if (e.key === 'Escape') {
  if (isPreviewOpen) {
    onClosePreview?.()
  }
  setFocusedIndex(null)
  return
}
```

Then inside the `switch (e.key)` block, add:

```ts
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
```

> Note: Replace the existing `case 'ArrowDown':` and `case 'ArrowUp':` blocks with the new ones above. The existing plain-arrow handling is preserved inside each `if (e.metaKey)` else-path.

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 6: Wire `onClosePreview` in `page.tsx`**

Add to the `useKeyboardNav` call in `app/dashboard/files/page.tsx`:
```ts
onClosePreview: () => setIsPreviewOpen(false),
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: add Escape, Cmd+↑, Cmd+↓ keyboard shortcuts"
```

---

## Task 2: Add Delete key to hook

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `app/dashboard/files/page.tsx`

`Delete` on a focused file triggers deletion. The hook receives a new optional `onDelete` callback.

- [ ] **Step 1: Write failing test**

```ts
  test('Delete calls onDelete with focused file', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('ArrowDown') // 0 = folder-a
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('Delete')
    expect(onDelete).toHaveBeenCalledWith(files[1])
  })

  test('Delete does nothing when no file is focused', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('Delete')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('Delete works on folders too', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('ArrowDown') // 0 = folder-a
    fireKey('Delete')
    expect(onDelete).toHaveBeenCalledWith(files[0])
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Add `onDelete` to hook interface and handle key**

In `hooks/use-keyboard-nav.ts`:

Add to `UseKeyboardNavOptions`:
```ts
onDelete?: (file: StoredFile) => void
```

Add to destructuring:
```ts
onDelete,
```

Add to `switch (e.key)` in `handleKeyDown`:
```ts
case 'Delete': {
  if (e.repeat) return
  if (focusedIndex === null) return
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file || !onDelete) return
  onDelete(file)
  break
}
```

- [ ] **Step 4: Wire into `page.tsx`**

In `app/dashboard/files/page.tsx`, update the `useKeyboardNav` call (around line 123):

```ts
const { focusedIndex, itemRefs } = useKeyboardNav({
  files,
  isModalOpen: isAnyModalOpen,
  isPreviewOpen,
  onNavigateToFolder: (file) => navigateToFolder(`${currentPath}${file.name}/`),
  onNavigateUp: navigateUp,
  onPreview: (file) => {
    setPreviewFile(file as StoredFile)
    setIsPreviewOpen(true)
  },
  onDelete: (file) => handleDelete(file as StoredFile),
})
```

- [ ] **Step 5: Run tests — all pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: Delete key removes focused file"
```

---

## Task 3: Add Cmd+A (select all)

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `app/dashboard/files/page.tsx`

`Cmd+A` selects all files. The hook receives a new optional `onSelectAll` callback.

- [ ] **Step 1: Write failing test**

```ts
  test('Cmd+A calls onSelectAll', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).toHaveBeenCalled()
  })

  test('Cmd+A does not fire when modal is open', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isModalOpen: true, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  test('Cmd+A does not fire when preview is open', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: true, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Add `onSelectAll` to hook and handle key**

Add to `UseKeyboardNavOptions`:
```ts
onSelectAll?: () => void
```

Add to destructuring:
```ts
onSelectAll,
```

Add to `switch (e.key)` in `handleKeyDown`:
```ts
case 'a': {
  if (!e.metaKey) break
  e.preventDefault()
  onSelectAll?.()
  break
}
```

- [ ] **Step 4: Wire into `page.tsx`**

Add to the `useKeyboardNav` call:
```ts
onSelectAll: () => setSelectedFileIds(files.map((f) => f.id)),
```

- [ ] **Step 5: Run tests — all pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: Cmd+A selects all files"
```

---

## Task 4: Add Shift+Arrow (extend selection)

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `app/dashboard/files/page.tsx`

`Shift+↓` / `Shift+↑` extends the checkbox selection as focus moves — exactly like Finder. The hook receives `selectedFileIds` (read) and `onSetSelectedFileIds` (write) so it can toggle files into the selection as the focused index moves.

- [ ] **Step 1: Write failing tests**

```ts
  const filesWithIds = [
    makeFile('1', 'folder-a', true),
    makeFile('2', 'file-b.txt'),
    makeFile('3', 'file-c.png'),
  ]

  test('Shift+ArrowDown adds next file to selection', () => {
    const onSetSelectedFileIds = jest.fn()
    renderHook(() =>
      useKeyboardNav({
        ...baseOptions,
        files: filesWithIds,
        selectedFileIds: [],
        onSetSelectedFileIds,
      })
    )
    fireKey('ArrowDown') // focus 0
    fireKey('ArrowDown', { shiftKey: true }) // extend to 1
    expect(onSetSelectedFileIds).toHaveBeenCalled()
    const arg = onSetSelectedFileIds.mock.calls[0][0]
    expect(arg).toContain('2') // file-b.txt id
  })

  test('Shift+ArrowUp adds previous file to selection', () => {
    const onSetSelectedFileIds = jest.fn()
    renderHook(() =>
      useKeyboardNav({
        ...baseOptions,
        files: filesWithIds,
        selectedFileIds: [],
        onSetSelectedFileIds,
      })
    )
    fireKey('ArrowDown') // 0
    fireKey('ArrowDown') // 1
    fireKey('ArrowUp', { shiftKey: true }) // extend up to 0
    expect(onSetSelectedFileIds).toHaveBeenCalled()
    const arg = onSetSelectedFileIds.mock.calls[0][0]
    expect(arg).toContain('1') // folder-a id
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Add props and implement in hook**

Add to `UseKeyboardNavOptions`:
```ts
selectedFileIds?: string[]
onSetSelectedFileIds?: (ids: string[]) => void
```

Add to destructuring:
```ts
selectedFileIds = [],
onSetSelectedFileIds,
```

Inside the `ArrowDown` case (non-metaKey path), replace the plain `moveFocusRef.current('down')` with:
```ts
if (e.shiftKey && onSetSelectedFileIds && focusedIndex !== null) {
  const nextIndex = focusedIndex < files.length - 1 ? focusedIndex + 1 : focusedIndex
  const file = files[nextIndex]
  if (file) {
    const alreadySelected = selectedFileIds.includes(file.id)
    onSetSelectedFileIds(
      alreadySelected
        ? selectedFileIds.filter((id) => id !== file.id)
        : [...selectedFileIds, file.id]
    )
  }
}
moveFocusRef.current('down')
```

Do the same for `ArrowUp` (mirrored):
```ts
if (e.shiftKey && onSetSelectedFileIds && focusedIndex !== null) {
  const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : focusedIndex
  const file = files[prevIndex]
  if (file) {
    const alreadySelected = selectedFileIds.includes(file.id)
    onSetSelectedFileIds(
      alreadySelected
        ? selectedFileIds.filter((id) => id !== file.id)
        : [...selectedFileIds, file.id]
    )
  }
}
moveFocusRef.current('up')
```

- [ ] **Step 4: Wire into `page.tsx`**

Add to the `useKeyboardNav` call:
```ts
selectedFileIds,
onSetSelectedFileIds: setSelectedFileIds,
```

- [ ] **Step 5: Run tests — all pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: Shift+Arrow extends file selection"
```

---

## Task 5: Add type-ahead navigation

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `__tests__/hooks/use-keyboard-nav.test.ts`

Pressing a letter key (a–z, A–Z) jumps focus to the first file whose name starts with that letter, wrapping around if no match is found from the current position. A 500ms reset timer clears the accumulated typed string so subsequent keypresses start fresh — matching Finder's behavior.

- [ ] **Step 1: Write failing tests**

```ts
  test('typing a letter jumps to first file starting with that letter', () => {
    const filesForTypeAhead = [
      makeFile('1', 'alpha.txt'),
      makeFile('2', 'beta.txt'),
      makeFile('3', 'gamma.txt'),
    ]
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, files: filesForTypeAhead })
    )
    fireKey('b')
    expect(result.current.focusedIndex).toBe(1) // beta.txt
  })

  test('pressing the same letter twice cycles to the next match', () => {
    const filesForTypeAhead = [
      makeFile('10', 'apple.txt'),
      makeFile('11', 'avocado.txt'),
      makeFile('12', 'banana.txt'),
    ]
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, files: filesForTypeAhead })
    )
    fireKey('a') // jumps to index 0 (apple)
    expect(result.current.focusedIndex).toBe(0)
    // Advance past the 500ms reset timer so the query clears, then press 'a' again
    act(() => { jest.advanceTimersByTime(600) })
    fireKey('a') // fresh single-char search from position 1 forward — finds avocado
    expect(result.current.focusedIndex).toBe(1)
  })

  test('type-ahead does not fire when modifier key is held', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('f', { metaKey: true }) // Cmd+F should not type-ahead
    expect(result.current.focusedIndex).toBeNull()
  })

  test('type-ahead does not fire when an input is focused', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('f')
    expect(result.current.focusedIndex).toBeNull()
    document.body.removeChild(input)
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Implement type-ahead in hook**

Add a ref for the accumulated query and a reset timer near the other refs at the top of `useKeyboardNav`:

```ts
const typeAheadRef = useRef('')
const typeAheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

At the **bottom** of `handleKeyDown` (after the `switch` block, before the closing `}`), add:

```ts
// Type-ahead: single printable character, no modifier keys
if (
  e.key.length === 1 &&
  !e.metaKey && !e.ctrlKey && !e.altKey &&
  !isEditableElement(document.activeElement)
) {
  e.preventDefault()
  typeAheadRef.current += e.key.toLowerCase()

  if (typeAheadTimerRef.current) clearTimeout(typeAheadTimerRef.current)
  typeAheadTimerRef.current = setTimeout(() => {
    typeAheadRef.current = ''
  }, 500)

  const query = typeAheadRef.current
  const startIndex = focusedIndex === null ? 0 : focusedIndex + 1

  // Search from current position forward, then wrap
  const ordered = [
    ...files.slice(startIndex),
    ...files.slice(0, startIndex),
  ]
  const match = ordered.find((f) => f.name.toLowerCase().startsWith(query))
  if (match) {
    setFocusedIndex(files.indexOf(match))
  }
}
```

Also clean up the timer on unmount — add to the existing cleanup `return` in `useEffect`:
```ts
return () => {
  window.removeEventListener('keydown', handleKeyDown)
  if (typeAheadTimerRef.current) clearTimeout(typeAheadTimerRef.current)
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -20
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add hooks/use-keyboard-nav.ts __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: type-ahead navigation — press letter to jump to matching file"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npm run dev
```

- [ ] **Step 2: Verify all new keybindings in browser**

1. `Escape` — press `↓` to focus a file, press `Escape` — focus ring disappears
2. `Delete` — focus a file, press `Delete` — confirmation dialog appears, confirm — file is deleted
3. `Cmd+↑` — press `Cmd+↑` from any folder — navigates up one level
4. `Cmd+↓` on folder — focus a folder, `Cmd+↓` — enters the folder
5. `Cmd+↓` on file — focus a file, `Cmd+↓` — preview modal opens
6. `Cmd+A` — press `Cmd+A` — all file checkboxes become checked
7. `Shift+↓` — focus item 0, press `Shift+↓` — item 1 checkbox becomes checked, focus moves to 1; press `Shift+↓` again — item 2 also checked
8. `Shift+↑` — from item 2 (both 1+2 selected), press `Shift+↑` — item 2 is deselected (toggled off), focus moves back to 1
9. Type `b` — focus jumps to first file starting with 'b'
10. Type `b` again quickly — jumps to second file starting with 'b' (if one exists); wait 500ms then type `b` — jumps back to first match
11. Open an upload/share modal — verify none of the above fire while modal is open
12. Click into the search input — verify typing letters does not trigger type-ahead

- [ ] **Step 3: Fix any issues found**

```bash
git add hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "fix: keyboard nav phase 2 smoke test fixes"
```

---

## Task 7: Full test suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 3: Confirm on correct branch**

```bash
git branch --show-current
```

Expected: `feat/keyboard-navigation-phase1`
