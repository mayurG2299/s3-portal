# Keyboard Navigation — Phase 1: Navigation
**Date:** 2026-04-12  
**Status:** Approved  
**Scope:** Files tab only

---

## Overview

Add Mac Finder-inspired keyboard navigation to the S3 portal files tab. Phase 1 covers navigation only — moving through the file list, entering folders, previewing files, and going up a directory level. Future phases (selection, file actions, global shortcuts) are tracked in `docs/superpowers/keyboard-nav-backlog.md`.

---

## Key Bindings

| Key | Behavior |
|-----|----------|
| `↑` | Move focus to previous file in list |
| `↓` | Move focus to next file in list |
| `Enter` | If focused item is a folder: navigate into it. If a file: no-op. |
| `Space` | Open the existing preview modal for the focused file (same behaviour as the eye icon) |
| `Backspace` | Navigate up one folder level (same as clicking the parent in the breadcrumb) |

All handled keys must call `event.preventDefault()` to suppress default browser behaviour (Backspace = browser history navigation, Space = page scroll, Arrow keys = page scroll).

---

## Architecture

### New file: `hooks/use-keyboard-nav.ts`

A single custom hook owns all keyboard logic. It accepts:
- `files` — the current file list
- `onNavigateToFolder(file)` — callback to enter a folder
- `onNavigateUp()` — callback to go up one level
- `onPreview(file)` — callback to open the preview modal (reuses existing handler)
- `isModalOpen` — boolean; listener is disabled while any modal/dialog is open

It returns:
- `focusedIndex` — the currently focused file index (`null` if none)
- `itemRefs` — a stable array of `React.RefObject<HTMLDivElement>`, one per file card

### `isModalOpen` composition

`isModalOpen` must be derived in `page.tsx` from all active modal conditions before being passed to the hook. Adding a future modal requires updating this list:

```ts
const isModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isPreviewOpen || isDirectLinkOpen;
```

Notes:
- `editingTagsFile` is an entity reference (not a boolean) — coerce with `!!` to boolean. Any future modal controlled by a non-boolean state variable must be coerced the same way.
- `isCdnDialogOpen` exists in the file but is currently orphaned (never set to `true`, never passed to a `<Dialog open=...>` prop). It is excluded here. If a CDN dialog is wired up in the future, add it to this expression.

### `itemRefs` stability

`itemRefs` must be stable across renders. The hook holds refs in a `useRef` containing an array, growing or shrinking it only when `files.length` changes. Do not call `useRef()` in a loop per render — this creates new ref objects on every render and breaks DOM focus.

```ts
const refsRef = useRef<React.RefObject<HTMLDivElement>[]>([]);
// Sync length to files.length on each render
while (refsRef.current.length < files.length) refsRef.current.push(createRef());
refsRef.current.length = files.length;
const itemRefs = refsRef.current;
```

### Inline helpers (no external dependency)

Only one utility is needed — `throttle` for arrow keys. Action keys use `event.repeat` guard instead of debounce (see Timing section).

```ts
function throttle<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let last = 0;
  return (...args: T) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}
```

### Timing

- `↑` / `↓` — throttled at **80ms** (prevents flying through list on key-hold)
- `Enter`, `Space`, `Backspace` — guarded with `if (event.repeat) return;` at the top of the handler. This fires immediately on first keydown and ignores held-key repeats with zero latency. No debounce needed.

### Listener guard conditions

The `keydown` listener does nothing if:
- `isModalOpen` is `true`
- `document.activeElement` is an `<input>`, `<textarea>`, or `[contenteditable]`

This ensures the shortcuts don't fire while the user is typing in search, tag filter, folder name dialog, etc.

### DOM focus

When `focusedIndex` changes, the hook calls `.focus()` on the corresponding ref, then calls `ref.current.scrollIntoView({ block: 'nearest' })` as a fallback to ensure the item is visible. The native focus-scroll may not fire reliably if the scroll container has `overflow: hidden` on an ancestor — `scrollIntoView` covers that case.

### `focusedIndex` reset on navigation

When Enter fires on a folder (triggering `onNavigateToFolder`), the hook resets `focusedIndex` to `null`. This matches Finder behaviour — no item is pre-selected when entering a new folder.

---

## Visual Feedback

Focused card uses a **subtle background lift + visible border** (Option C):
- Background: slightly brighter than default card background
- Border: becomes visible (currently invisible on unfocused cards)
- No color change to text or icons
- This is visually distinct from the checkbox "selected" state (blue accent) so the two states don't conflict

Implementation: a `data-keyboard-focused` attribute on the card div, styled via Tailwind.

---

## Integration in `page.tsx`

Minimal changes to the existing page:
1. Derive `isModalOpen` from the six modal state variables (see above)
2. Call `useKeyboardNav({ files, onNavigateToFolder, onNavigateUp, onPreview, isModalOpen })` at the top of the component
3. Spread `ref={itemRefs[index]}` and `tabIndex={0}` onto each file card div
4. Add `data-keyboard-focused={focusedIndex === index}` to each card

No keyboard logic lives in `page.tsx` itself.

---

## Out of Scope (Phase 1)

- Multi-select with Shift+Arrow or Cmd+A
- File action shortcuts (delete, share, favorite)
- Global shortcuts (new folder, upload)
- `?` help overlay
- Any changes to pages other than the files tab

---

## Files Changed

| File | Change |
|------|--------|
| `hooks/use-keyboard-nav.ts` | New file — keyboard hook |
| `app/dashboard/files/page.tsx` | Derive `isModalOpen`, wire up hook, add refs and tabIndex to file cards, add focused card styling |

---

## Testing

- Arrow keys move focus through the list in order
- Pressing `↓` on the last item does nothing (no wrap-around, matching Finder)
- Pressing `↑` on the first item does nothing
- Holding `↓` rapidly does not move focus faster than the 80ms throttle window
- `Enter` on a folder calls `navigateToFolder` and resets `focusedIndex` to `null`
- `Enter` on a file does nothing
- `Space` opens the preview modal for the focused file; fires immediately (no delay)
- `Backspace` calls navigate-up; does nothing at root level
- `Backspace` does not trigger browser back-navigation (`preventDefault` confirmed)
- `Space` does not scroll the page (`preventDefault` confirmed)
- No shortcuts fire when an input/textarea/contenteditable is focused
- No shortcuts fire when any of the six modals is open
- Focused card shows subtle background lift + visible border; unfocused cards are unaffected
- Focused card is distinct from the checkbox-selected state (no blue accent)
- Off-screen focused items scroll into view when focus moves to them
