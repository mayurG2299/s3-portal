# Keyboard Shortcuts — Full App Coverage
**Date:** 2026-05-16
**Status:** Draft
**Scope:** All dashboard pages

---

## Goal

Make the entire S3 Portal operable without a mouse — like macOS Finder. Phase 1 (files page navigation) is already shipped. This spec covers:

1. Global shortcuts (page navigation, search) — active on every page
2. Files page completions (3 advertised-but-missing shortcuts + 2 Phase 4 actions)
3. List navigation on secondary pages (Links, Credentials, Invitations)
4. `?` cheatsheet promoted from files-only to global
5. Shortcuts modal expanded with all sections

---

## Shortcut Map

### Global (active on every dashboard page)

| Shortcut | Action |
|---|---|
| `Cmd+K` | Focus global search |
| `Cmd+,` | Navigate to /dashboard/settings |
| `Cmd+Shift+1` | Navigate to Dashboard |
| `Cmd+Shift+2` | Navigate to Files |
| `Cmd+Shift+3` | Navigate to Links |
| `Cmd+Shift+4` | Navigate to Invitations |
| `Cmd+Shift+5` | Navigate to Teams |
| `Cmd+Shift+6` | Navigate to Settings |
| `Cmd+Shift+7` | Navigate to Permissions (admin only) |
| `Cmd+Shift+8` | Navigate to Audit Logs (admin only) |
| `?` | Open keyboard shortcuts modal |

**Notes:**
- `Cmd+Shift+Number` is used (not `Cmd+Number`) because `Cmd+1`–`Cmd+8` are browser tab-switching shortcuts that cannot be intercepted.
- Numbers are fixed regardless of RBAC. If a user navigates to a restricted page, existing permission-denied handling applies normally.
- `Cmd+,` is the standard macOS convention for preferences/settings.
- All global shortcuts are blocked when an `<input>`, `<textarea>`, or `[contenteditable]` is focused — **except `Cmd+K`**, which must always fire to focus the search input.

### Files Page — New Additions

These shortcuts are already advertised in the shortcuts modal but not yet implemented:

| Shortcut | Action | Status |
|---|---|---|
| `F` | Toggle favorite on focused file | ❌ missing |
| `Cmd+L` | Open direct link modal for focused file | ❌ missing |
| `Cmd+Shift+S` | Open share modal for focused file | ❌ missing |
| `Cmd+U` | Open upload modal | ❌ missing |
| `Cmd+Shift+F` | Open new folder modal | ❌ missing (replaces advertised Cmd+Shift+N — see Browser Conflicts) |

Already built (unchanged):

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move focus |
| `Enter` / `Cmd+↓` | Enter folder |
| `Backspace` / `Cmd+↑` | Go up directory |
| `Space` | Preview focused file |
| `Delete` | Delete focused file |
| `Cmd+A` | Select all |
| `Shift+↑` / `Shift+↓` | Extend selection |
| Type-ahead | Jump to file by name |
| `Esc` | Clear focus / close preview |

### Links Page

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move focus between link cards |
| `C` | Copy URL of focused link |
| `D` | Revoke/delete focused link (with confirm) |
| `Esc` | Clear focus |
| `R` | Refresh list |

### Credentials Page

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move focus between credential cards |
| `D` | Delete focused credential (with confirm) |
| `Esc` | Clear focus |

### Invitations Page

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move focus between invite cards |
| `A` | Accept focused invitation |
| `X` | Decline focused invitation |
| `Esc` | Clear focus |

---

## Browser Conflict Notes

These conflicts were reviewed and resolved before finalising the shortcut map:

| Shortcut | Conflict | Resolution |
|---|---|---|
| `Cmd+1–8` | Chrome/Firefox/Safari switch browser tabs | Replaced with `Cmd+Shift+1–8` |
| `Cmd+Shift+N` | Opens incognito window in Chrome, Firefox, Edge — cannot be intercepted | Replaced with `Cmd+Shift+F` (F = Folder) for new folder |
| `Cmd+L` | Focuses browser address bar in Chrome/Safari — interception inconsistent | Keep for now; must be verified in Chrome macOS during QA. Fallback: `Cmd+Shift+L` |
| `Cmd+U` | Opens View Source in Safari (not Chrome) — `e.preventDefault()` should suppress it | Keep; verify on Safari during QA |

---

## Architecture

### New: `hooks/use-global-shortcuts.ts`

Mounted once in `dashboard-chrome.tsx`. Handles all global shortcuts.

**Props:**
```ts
interface UseGlobalShortcutsOptions {
  onOpenSearch: () => void     // focuses the global search input
  onOpenShortcuts: () => void  // opens the ? modal
}
```

**Logic:**
```ts
function handleKeyDown(e: KeyboardEvent) {
  // Cmd+K — open search (never blocked, even when input focused)
  if (e.key === 'k' && e.metaKey && !e.shiftKey && !e.repeat) {
    e.preventDefault()
    onOpenSearch()
    return
  }

  // Block everything else when typing
  if (isEditableElement(document.activeElement)) return

  // ? — shortcuts modal
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
  if (e.metaKey && e.shiftKey && !e.repeat) {
    const pageMap: Record<string, string> = {
      '1': '/dashboard',
      '2': '/dashboard/files',
      '3': '/dashboard/links',
      '4': '/dashboard/invitations',
      '5': '/dashboard/teams',
      '6': '/dashboard/settings',
      '7': '/dashboard/admin/permissions',
      '8': '/dashboard/admin/audit',
    }
    if (pageMap[e.key]) {
      e.preventDefault()
      router.push(pageMap[e.key])
    }
  }
}
```

The hook attaches to `window` via `useEffect` and tears down on unmount.

### New: `lib/contexts/shortcuts-modal-context.tsx`

A minimal React context that lets any page read `isShortcutsOpen`. This is required so `use-keyboard-nav` on the files page knows to suppress file shortcuts while the global shortcuts modal is visible.

```ts
interface ShortcutsModalContextValue {
  isShortcutsOpen: boolean
}

export const ShortcutsModalContext = createContext<ShortcutsModalContextValue>({ isShortcutsOpen: false })
export const useShortcutsModal = () => useContext(ShortcutsModalContext)
```

`dashboard-chrome.tsx` wraps its children in `<ShortcutsModalContext.Provider value={{ isShortcutsOpen }}>`. The files page reads `const { isShortcutsOpen } = useShortcutsModal()` and adds it to `isAnyModalOpen`.

### Modified: `dashboard-chrome.tsx`

1. Add `const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)`
2. Create `const searchRef = useRef<GlobalSearchHandle>(null)` and wire into `<GlobalSearch ref={searchRef} />`
3. Mount `useGlobalShortcuts({ onOpenSearch: () => searchRef.current?.focus(), onOpenShortcuts: () => setIsShortcutsOpen(true) })`
4. Wrap children in `<ShortcutsModalContext.Provider value={{ isShortcutsOpen }}>`
5. Render `<KeyboardShortcutsModal open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />` at chrome level

### Modified: `GlobalSearch` component

Convert to `forwardRef` and expose a `focus()` method via `useImperativeHandle`:

```ts
export interface GlobalSearchHandle {
  focus: () => void
}

export const GlobalSearch = forwardRef<GlobalSearchHandle, { onFocusChange?: (focused: boolean) => void }>(
  ({ onFocusChange }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus()
    }))

    // ... rest of component unchanged
  }
)
GlobalSearch.displayName = 'GlobalSearch'
```

The internal `inputRef` is already used for focus/blur throughout the component — this change only adds the `useImperativeHandle` binding. No other logic changes.

### Modified: `hooks/use-keyboard-nav.ts` (files page)

**Atomic migration note:** The removal of `onShowShortcuts` and the addition of `use-global-shortcuts` must land in a single commit. During any intermediate state where both handlers exist simultaneously, pressing `?` on the files page would fire both — opening the modal twice. The PR must include both changes together.

**Removals (atomic with dashboard-chrome changes):**
- Remove `onShowShortcuts?: () => void` from `UseKeyboardNavOptions`
- Remove the `?` handler block at lines 133–137
- Remove `onShowShortcuts` from the `useEffect` dependency array

**Additions — five new optional callbacks:**
```ts
onFavorite?: (file: StoredFile) => void
onDirectLink?: (file: StoredFile) => void
onShare?: (file: StoredFile) => void
onUpload?: () => void
onNewFolder?: () => void
```

**New switch cases** — added inside the existing `switch (e.key)` block. All single-letter cases use `return` (not `break`) after calling their handler so control never falls through to the type-ahead block:

```ts
case 'f': {
  if (e.repeat || e.metaKey || e.shiftKey) break  // break = not handled, fall to type-ahead
  if (focusedIndex === null) break
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file || isFolder(file)) break
  onFavorite?.(file)
  return  // ← return, not break: prevents type-ahead from treating 'f' as a jump character
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
case 'f' (Cmd+Shift+F — new folder): {
  // Handled by checking e.metaKey && e.shiftKey at the top of case 'f'
  // The existing case 'f' guard already breaks early for metaKey combinations
  // Add explicit Cmd+Shift+F handling before the plain-F logic:
}
```

**Revised `case 'f'` handling both plain-F (favorite) and Cmd+Shift+F (new folder):**

```ts
case 'f': {
  if (e.repeat) break
  // Cmd+Shift+F = new folder
  if (e.metaKey && e.shiftKey) {
    e.preventDefault()
    onNewFolder?.()
    return
  }
  // Plain F = favorite (no modifier)
  if (e.metaKey || e.shiftKey || e.altKey) break
  if (focusedIndex === null) break
  e.preventDefault()
  const file = files[focusedIndex]
  if (!file || isFolder(file)) break
  onFavorite?.(file)
  return  // prevents type-ahead
}
```

### Modified: `app/dashboard/files/page.tsx`

Wire the five new callbacks:
```ts
onFavorite: (file) => handleToggleFavorite(file.id),
onDirectLink: (file) => { setDirectLinkFile(file); setIsDirectLinkOpen(true) },
onShare: (file) => { setShareFile(file); setIsShareOpen(true) },
onUpload: () => setIsUploadOpen(true),
onNewFolder: () => setIsFolderDialogOpen(true),
```

Remove: floating `?` button JSX, `isShortcutsOpen` state, `onShowShortcuts` prop passed to `useKeyboardNav`.

Add to `isAnyModalOpen`:
```ts
const { isShortcutsOpen } = useShortcutsModal()
const isAnyModalOpen =
  isUploadOpen || isShareOpen || isFolderDialogOpen ||
  !!editingTagsFile || isDirectLinkOpen || isCdnDialogOpen || isShortcutsOpen
```

Remove `<KeyboardShortcutsModal>` from the files page JSX (it now lives in dashboard-chrome).

### New: `hooks/use-list-nav.ts`

Lightweight generic list navigation hook for secondary pages. Uses typed callbacks, not a string-action API.

```ts
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
```

Key bindings inside the hook (hardcoded; only fires the callback if provided):
- `↑/↓` — move focus (throttled 80ms)
- `D` — `keyActions.onDelete?.(focusedItem)`
- `C` — `keyActions.onCopy?.(focusedItem)`
- `A` — `keyActions.onAccept?.(focusedItem)`
- `X` — `keyActions.onDecline?.(focusedItem)`
- `R` — `onRefresh?.()`
- `Esc` — clear focus

All single-letter actions use `return` (not `break`) to prevent any future type-ahead if added. Blocked when `isModalOpen` or `isEditableElement(document.activeElement)`.

Usage on each page:
```ts
// Links page
const { focusedIndex, itemRefs } = useListNav({
  items: links,
  isModalOpen: isDeleteConfirmOpen,
  keyActions: {
    onCopy: (link) => copyToClipboard(link.url),
    onDelete: (link) => setDeleteTarget(link),
  },
  onRefresh: () => router.refresh(),
})

// Invitations page
const { focusedIndex, itemRefs } = useListNav({
  items: invitations,
  isModalOpen: false,
  keyActions: {
    onAccept: (invite) => handleAccept(invite.id),
    onDecline: (invite) => handleDecline(invite.id),
  },
})

// Credentials page
const { focusedIndex, itemRefs } = useListNav({
  items: credentials,
  isModalOpen: isDeleteConfirmOpen,
  keyActions: {
    onDelete: (cred) => setDeleteTarget(cred),
  },
})
```

### Modified: `components/keyboard-shortcuts-modal.tsx`

Move from files page to dashboard-chrome. Expand sections. Admin shortcuts (Cmd+Shift+7/8) are conditionally rendered using the existing `useRBAC()` hook (already available via the RBACProvider wrapping all dashboard content):

```ts
const { isAdmin } = useRBAC()
```

New section structure:

**Global**
| Label | Keys |
|---|---|
| Search | ⌘K |
| Settings | ⌘, |
| Dashboard | ⌘⇧1 |
| Files | ⌘⇧2 |
| Links | ⌘⇧3 |
| Invitations | ⌘⇧4 |
| Teams | ⌘⇧5 |
| Settings | ⌘⇧6 |
| Permissions *(admin)* | ⌘⇧7 |
| Audit Logs *(admin)* | ⌘⇧8 |

Rows for Cmd+Shift+7 and Cmd+Shift+8 render only when `isAdmin` is true.

**Navigation** (files page)
| Label | Keys |
|---|---|
| Move focus | ↑ ↓ |
| Open folder | ↵ ⌘↓ |
| Go up | ⌫ ⌘↑ |
| Jump to name | A–Z |

**File Actions** (files page)
| Label | Keys |
|---|---|
| Preview | Space |
| Favorite | F |
| Direct link | ⌘L |
| Share | ⌘⇧S |
| Delete | Del |
| Upload | ⌘U |
| New folder | ⌘⇧F |

**Selection** (files page)
| Label | Keys |
|---|---|
| Select all | ⌘A |
| Extend selection | ⇧↑ ⇧↓ |
| Clear / close | Esc |

**Links Page**
| Label | Keys |
|---|---|
| Copy URL | C |
| Delete link | D |

**Invitations Page**
| Label | Keys |
|---|---|
| Accept | A |
| Decline | X |

---

## Visual Feedback

List nav on secondary pages follows the same pattern as files page:
- `ref={itemRefs[index]}` and `tabIndex={0}` on each card root div
- `data-keyboard-focused={focusedIndex === index}` attribute
- CSS: `[data-keyboard-focused=true]` → subtle background lift + visible border (same Tailwind utility classes as files page)
- `scrollIntoView({ block: 'nearest' })` called when `focusedIndex` changes

---

## File Map

| File | Change |
|---|---|
| `hooks/use-global-shortcuts.ts` | **Create** — Cmd+K, Cmd+Shift+1–8, Cmd+,, ? |
| `hooks/use-list-nav.ts` | **Create** — typed list nav for secondary pages |
| `lib/contexts/shortcuts-modal-context.tsx` | **Create** — shares isShortcutsOpen across pages |
| `hooks/use-keyboard-nav.ts` | **Modify** — add F/Cmd+L/Cmd+Shift+S/Cmd+U/Cmd+Shift+F; remove ?/onShowShortcuts (atomic) |
| `components/dashboard/dashboard-chrome.tsx` | **Modify** — use-global-shortcuts, isShortcutsOpen, ShortcutsModalContext.Provider, KeyboardShortcutsModal |
| `components/dashboard/global-search.tsx` | **Modify** — forwardRef + useImperativeHandle for focus() |
| `components/keyboard-shortcuts-modal.tsx` | **Modify** — global section, admin rows, per-page sections, move to chrome |
| `app/dashboard/files/page.tsx` | **Modify** — 5 new callbacks, useShortcutsModal, remove local ? state/button/modal |
| `app/dashboard/links/page.tsx` | **Modify** — wire use-list-nav (C/D) |
| `app/dashboard/credentials/page.tsx` | **Modify** — wire use-list-nav (D) |
| `app/dashboard/invitations/page.tsx` | **Modify** — wire use-list-nav (A/X) |

---

## Guard Conditions Summary

| Shortcut group | Blocked when |
|---|---|
| Global navigation (Cmd+Shift+1–8, Cmd+,) | Input/textarea/contenteditable focused |
| Cmd+K | **Never blocked** |
| ? global | Input/textarea/contenteditable focused |
| Files page shortcuts (F, Cmd+L, etc.) | `isAnyModalOpen` (including `isShortcutsOpen` via context) OR input focused |
| List nav ↑/↓ | `isModalOpen` OR input focused |
| Letter actions (C, D, A, X) | `isModalOpen` OR input focused |

---

## Testing

**`use-global-shortcuts`:**
- `Cmd+K` calls `onOpenSearch` when no input is focused
- `Cmd+K` calls `onOpenSearch` even when an input IS focused
- `Cmd+Shift+2` calls `router.push('/dashboard/files')`
- `Cmd+Shift+2` does NOT fire when an input is focused
- `Cmd+Shift+7` calls `router.push('/dashboard/admin/permissions')`
- `?` calls `onOpenShortcuts`
- `?` does NOT fire when an input is focused
- No shortcut fires twice (verify single listener; `?` removed from `use-keyboard-nav` in same commit)

**`use-keyboard-nav` — new additions:**
- `F` on a focused file calls `onFavorite` with that file
- `F` does NOT trigger type-ahead (return vs break verification)
- `F` does nothing when a folder is focused
- `Cmd+Shift+F` calls `onNewFolder` (no file focus required)
- `Cmd+L` on a focused file calls `onDirectLink`
- `Cmd+Shift+S` on a focused file calls `onShare`
- `Cmd+U` calls `onUpload` (no file focus required)
- None fire when `isAnyModalOpen` is true
- `isAnyModalOpen` is true when shortcuts modal is open (via `useShortcutsModal()` context)
- `Delete` does NOT fire when shortcuts modal is open

**`use-list-nav`:**
- `↑/↓` moves focus through items at 80ms throttle
- `↓` on last item does nothing (no wrap)
- `↑` on first item does nothing
- `D` calls `keyActions.onDelete` with the focused item
- `C` calls `keyActions.onCopy` with the focused item
- `A` calls `keyActions.onAccept` with the focused item
- `X` calls `keyActions.onDecline` with the focused item
- `R` calls `onRefresh`
- `Esc` sets focusedIndex to null
- Nothing fires when `isModalOpen` is true
- Nothing fires when an input is focused
- Providing only `onDelete` (no `onCopy`) means `C` silently does nothing

**Shortcuts modal:**
- Global section renders ⌘K, ⌘,, ⌘⇧1–6 always
- Admin rows (⌘⇧7, ⌘⇧8) render only when `isAdmin` is true
- New folder shows ⌘⇧F (not ⌘⇧N)
- All pre-existing sections (Navigation, File Actions, Selection) still render
- Links Page and Invitations Page sections render

**Browser QA (manual, not unit):**
- `Cmd+L` in Chrome macOS: verify address bar is not focused instead
- `Cmd+U` in Safari macOS: verify no View Source tab opens
- `Cmd+Shift+F` in Chrome macOS: verify no browser conflict
- `Cmd+K` in Chrome macOS: verify global search focused, not browser address bar
