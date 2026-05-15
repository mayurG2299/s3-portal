# Keyboard Shortcuts Modal — Design Spec

## Goal

Add a floating `?` button to the files page that opens a modal listing all keyboard shortcuts. The `?` key also opens the modal.

---

## Components

### `components/keyboard-shortcuts-modal.tsx` (new)

A self-contained presentational component. No state, no logic.

**Props:**
```ts
interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}
```

Uses the existing `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` components already used throughout `page.tsx`. Renders three grouped sections:

**Navigation**
| Label | Keys |
|-------|------|
| Move focus | ↑ ↓ |
| Open folder | ↵  ⌘↓ |
| Go up | ⌫  ⌘↑ |
| Jump to name | A–Z |

**File Actions**
| Label | Keys |
|-------|------|
| Preview file | Space  ⌘↓ |
| Delete | Del |

**Selection**
| Label | Keys |
|-------|------|
| Select all | ⌘A |
| Extend selection | ⇧↑  ⇧↓ |
| Clear focus / close | Esc |

Each row: label on left, one or two `<kbd>` badges on right.
Section headings: small uppercase indigo label (matching the focus-ring colour `primary/50` already used by the keyboard nav cards).

---

### `hooks/use-keyboard-nav.ts` (modify)

Add optional prop:
```ts
onShowShortcuts?: () => void
```

Handle the `?` key in `handleKeyDown`:
- Guard: `if (isModalOpen) return` (already present before the switch — `?` is blocked when any modal is open)
- `?` is **not** blocked by `isPreviewOpen` — the user can open the cheatsheet from anywhere
- The `?` handler must be placed **before** the `if (isPreviewOpen)` block (which has a hard `return`) so it fires during preview. Add it as a top-level check at the very start of `handleKeyDown`, before the Escape handler:
```ts
if (!e.repeat && e.key === '?' && !isModalOpen && !isEditableElement(document.activeElement)) {
  e.preventDefault()
  onShowShortcuts?.()
  return
}
```
- We use `e.key === '?'` (not `e.code`) deliberately — `e.key` reflects the actual character produced, making this work correctly across non-US keyboard layouts.
- Add `onShowShortcuts` and `isModalOpen` (already present) to the `useEffect` dependency array — add `onShowShortcuts`.

---

### `app/dashboard/files/page.tsx` (modify)

**State:**
```ts
const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
```

**Hook wiring** — add to `useKeyboardNav` call:
```ts
onShowShortcuts: () => setIsShortcutsOpen(true),
```

**`isAnyModalOpen`** — add `isShortcutsOpen` and the previously missing `isCdnDialogOpen` to the derivation:
```ts
const isAnyModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isDirectLinkOpen || isCdnDialogOpen || isShortcutsOpen
```

**Floating button** — rendered inside the outermost page wrapper (the `relative` div), positioned `fixed bottom-6 right-6` so it sits in the bottom-right corner without overlapping the sidebar:
```tsx
<button
  onClick={() => setIsShortcutsOpen(true)}
  title="Keyboard shortcuts"
  className="fixed bottom-6 right-6 z-40 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-sm font-bold hover:bg-primary/90 transition-colors"
  aria-label="Keyboard shortcuts"
>
  ?
</button>
```

**Modal** — add alongside the other dialogs at the bottom of the JSX:
```tsx
<KeyboardShortcutsModal
  open={isShortcutsOpen}
  onClose={() => setIsShortcutsOpen(false)}
/>
```

---

## Behaviour Rules

| Situation | `?` key | Floating button |
|-----------|---------|-----------------|
| Normal browsing | ✅ Opens modal | ✅ Opens modal |
| Upload / share / tag modal open | ❌ Blocked by `isModalOpen` | ✅ Still clickable (but opens on top — acceptable) |
| Preview open | ✅ Opens modal | ✅ Opens modal |
| Shortcuts modal already open | ❌ Blocked | n/a |
| Input focused (search box) | ❌ `isEditableElement` guard | ✅ Still clickable |

---

## File Map

| File | Action |
|------|--------|
| `components/keyboard-shortcuts-modal.tsx` | **Create** |
| `hooks/use-keyboard-nav.ts` | **Modify** — add `onShowShortcuts` prop + `?` key handler |
| `app/dashboard/files/page.tsx` | **Modify** — state, hook wiring, floating button, modal render |
| `__tests__/hooks/use-keyboard-nav.test.ts` | **Modify** — tests for `?` key |

---

## Testing

**Hook unit tests** (`__tests__/hooks/use-keyboard-nav.test.ts`):
- `?` calls `onShowShortcuts`
- `?` does not fire when modal is open
- `?` fires when preview is open (not blocked)
- `?` does not fire when input is focused

**No unit tests for `KeyboardShortcutsModal`** — it is a pure display component with no logic. Visual correctness is verified by the smoke test.
