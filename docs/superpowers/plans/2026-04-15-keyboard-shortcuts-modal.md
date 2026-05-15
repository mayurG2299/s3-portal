# Keyboard Shortcuts Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating `?` button and a `?` key shortcut to the files page that open a modal listing all keyboard shortcuts, grouped into Navigation / File Actions / Selection.

**Architecture:** A new self-contained `KeyboardShortcutsModal` component handles all display. The hook gains one new optional `onShowShortcuts` callback, with the `?` handler placed before the `isPreviewOpen` guard so it fires during preview. `page.tsx` wires state, the floating button, and the modal render.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, shadcn/ui Dialog. No new dependencies.

**Branch:** `master`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/keyboard-shortcuts-modal.tsx` | **Create** | Pure display — dialog with grouped shortcut rows |
| `hooks/use-keyboard-nav.ts` | **Modify** | Add `onShowShortcuts` prop + `?` key handler before `isPreviewOpen` block |
| `app/dashboard/files/page.tsx` | **Modify** | `isShortcutsOpen` state, hook wiring, floating button, modal render, fix `isAnyModalOpen` |
| `__tests__/hooks/use-keyboard-nav.test.ts` | **Modify** | 4 tests for `?` key behaviour |

---

## Task 1: Add `onShowShortcuts` to the hook + tests

**Files:**
- Modify: `hooks/use-keyboard-nav.ts`
- Modify: `__tests__/hooks/use-keyboard-nav.test.ts`

**Step 1: Write failing tests**

Add inside the existing `describe('useKeyboardNav')` block in `__tests__/hooks/use-keyboard-nav.test.ts`:

```ts
  test('? calls onShowShortcuts', () => {
    const onShowShortcuts = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onShowShortcuts }))
    fireKey('?')
    expect(onShowShortcuts).toHaveBeenCalled()
  })

  test('? does not fire when modal is open', () => {
    const onShowShortcuts = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isModalOpen: true, onShowShortcuts }))
    fireKey('?')
    expect(onShowShortcuts).not.toHaveBeenCalled()
  })

  test('? fires when preview is open', () => {
    const onShowShortcuts = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: true, onShowShortcuts }))
    fireKey('?')
    expect(onShowShortcuts).toHaveBeenCalled()
  })

  test('? does not fire when an input is focused', () => {
    const onShowShortcuts = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onShowShortcuts }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('?')
    expect(onShowShortcuts).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -10
```

Expected: 4 new tests FAIL

- [ ] **Step 3: Add `onShowShortcuts` to the hook interface**

In `hooks/use-keyboard-nav.ts`, add to `UseKeyboardNavOptions`:

```ts
onShowShortcuts?: () => void
```

Add to the destructuring inside `useKeyboardNav`:

```ts
onShowShortcuts,
```

- [ ] **Step 4: Add the `?` handler at the very top of `handleKeyDown`**

The `?` handler must be the **first** thing inside `handleKeyDown` — before the existing Escape handler and before the `if (isPreviewOpen)` block. This is essential because `isPreviewOpen` has a hard `return` that would otherwise swallow the `?` key during preview.

Find the start of `handleKeyDown` and add this block first:

```ts
function handleKeyDown(e: KeyboardEvent) {
  // ? opens shortcuts modal — fires even during preview
  if (!e.repeat && e.key === '?' && !isModalOpen && !isEditableElement(document.activeElement)) {
    e.preventDefault()
    onShowShortcuts?.()
    return
  }

  // ... rest of existing handleKeyDown (Escape, isPreviewOpen block, etc.)
```

- [ ] **Step 5: Add `onShowShortcuts` to the `useEffect` dependency array**

Find the `useEffect` that registers the `keydown` listener. Its dependency array currently includes `files`, `focusedIndex`, `isModalOpen`, `isPreviewOpen`, and the callback props. Add `onShowShortcuts` to that array.

- [ ] **Step 6: Run tests — all pass**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/hooks/use-keyboard-nav.test.ts --no-coverage 2>&1 | tail -10
```

Expected: all tests PASS

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `hooks/use-keyboard-nav.ts`

- [ ] **Step 8: Commit**

```bash
git add hooks/use-keyboard-nav.ts __tests__/hooks/use-keyboard-nav.test.ts
git commit -m "feat: add ? key to open keyboard shortcuts modal"
```

---

## Task 2: Create `KeyboardShortcutsModal` component

**Files:**
- Create: `components/keyboard-shortcuts-modal.tsx`

No tests — this is a pure display component with no logic.

- [ ] **Step 1: Check the Dialog import path used in `page.tsx`**

```bash
grep "from.*dialog" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx | head -3
```

Use the same import path in the new component.

- [ ] **Step 2: Create the component**

Create `/Users/mayur/Personal/projects/s3-portal/components/keyboard-shortcuts-modal.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

interface ShortcutRow {
  label: string
  keys: string[]
}

interface ShortcutSection {
  heading: string
  rows: ShortcutRow[]
}

const SECTIONS: ShortcutSection[] = [
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
      { label: 'Preview file', keys: ['Space', '⌘↓'] },
      { label: 'Delete', keys: ['Del'] },
    ],
  },
  {
    heading: 'Selection',
    rows: [
      { label: 'Select all', keys: ['⌘A'] },
      { label: 'Extend selection', keys: ['⇧↑', '⇧↓'] },
      { label: 'Clear focus / close', keys: ['Esc'] },
    ],
  },
]

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <div className="flex gap-1">
                      {row.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground"
                        >
                          {key}
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

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `components/keyboard-shortcuts-modal.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/keyboard-shortcuts-modal.tsx
git commit -m "feat: add KeyboardShortcutsModal component"
```

---

## Task 3: Wire everything into `page.tsx`

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 1: Read the current `isAnyModalOpen` derivation**

```bash
grep -n "isAnyModalOpen" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx
```

Note the exact current line so you can replace it precisely.

- [ ] **Step 2: Add `isShortcutsOpen` state**

Near the other `useState` declarations (around line 63–96), add:

```ts
const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
```

- [ ] **Step 3: Move `isCdnDialogOpen` state above the early `return null` guard**

In `app/dashboard/files/page.tsx` there is an early return guard around line 107:
```ts
if (loading || loadingScreenPermissions || !canAccessFiles) {
  return null
}
```

React's Rules of Hooks forbid `useState` after a conditional `return`. Check where `isCdnDialogOpen` is declared — if it is declared **after** this guard, move it to join the other `useState` declarations above it. The TypeScript check in Step 8 will fail with a "used before declaration" error if you skip this.

- [ ] **Step 4: Fix `isAnyModalOpen`**

Replace the current `isAnyModalOpen` derivation with:

```ts
const isAnyModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isDirectLinkOpen || isCdnDialogOpen || isShortcutsOpen
```

Note: `isCdnDialogOpen` was previously missing — this also fixes that pre-existing gap.
The `?` key handler has its own inline `!isModalOpen` guard (inside the handler itself), so it does not rely on the existing `if (isModalOpen) return` at line 147 of the hook — that line is placed after the `isPreviewOpen` block and would be bypassed by the early-return placement of the `?` handler.

- [ ] **Step 5: Add `onShowShortcuts` to the `useKeyboardNav` call**

Find the `useKeyboardNav({ ... })` call and add:

```ts
onShowShortcuts: () => setIsShortcutsOpen(true),
```

- [ ] **Step 6: Add the import for `KeyboardShortcutsModal`**

Near the top of the file with the other component imports:

```ts
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal'
```

- [ ] **Step 7: Add the floating `?` button**

Find the closing `</div>` of the outermost page content wrapper (just before the first `<Dialog` or `<FilePreviewModal`). Add the button immediately before the modals section:

```tsx
{/* Floating keyboard shortcuts button */}
<button
  onClick={() => setIsShortcutsOpen(true)}
  title="Keyboard shortcuts"
  className="fixed bottom-6 right-6 z-40 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-sm font-bold hover:bg-primary/90 transition-colors"
  aria-label="Keyboard shortcuts"
>
  ?
</button>
```

- [ ] **Step 8: Add `<KeyboardShortcutsModal>` alongside the other dialogs**

Near the bottom of the JSX, after `<FilePreviewModal ... />`:

```tsx
<KeyboardShortcutsModal
  open={isShortcutsOpen}
  onClose={() => setIsShortcutsOpen(false)}
/>
```

- [ ] **Step 9: TypeScript check**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `app/dashboard/files/page.tsx`

- [ ] **Step 10: Run full test suite**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 11: Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: wire keyboard shortcuts modal into files page"
```

---

## Task 4: Smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npm run dev
```

- [ ] **Step 2: Verify in browser**

1. Navigate to the files tab — a small circular `?` button appears fixed in the bottom-right corner
2. Click it — the shortcuts modal opens with three sections (Navigation / File Actions / Selection)
3. Each row shows the label on the left and `<kbd>` badges on the right
4. Close the modal with the `×` button or clicking outside
5. Press `?` on the keyboard — modal opens again
6. With the modal open, press any shortcut key (e.g. `↓`) — nothing happens (modal blocks shortcuts)
7. Open a file preview, then press `?` — modal opens on top of the preview
8. Open the upload dialog, press `?` — nothing (modal blocked by `isModalOpen`)
9. Click in the search input, press `?` — nothing (blocked by `isEditableElement`)

- [ ] **Step 3: Fix any issues**

```bash
git add components/keyboard-shortcuts-modal.tsx hooks/use-keyboard-nav.ts app/dashboard/files/page.tsx
git commit -m "fix: keyboard shortcuts modal smoke test fixes"
```
