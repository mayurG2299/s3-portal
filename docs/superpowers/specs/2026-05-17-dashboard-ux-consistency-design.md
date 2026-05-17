# Dashboard UX/UI Consistency Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish and enforce a single, coherent visual language across every dashboard screen — header chrome, page headings, empty states, card actions, loading states, form labels, and tabs.

**Architecture:** All consistency changes are purely presentational. No API changes, no data model changes, no routing changes. The work is split into four areas: (1) chrome/header redesign, (2) per-page heading standardisation, (3) empty state standardisation, (4) micro-pattern standardisation (actions, loading, labels, tabs).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI, Lucide icons, shadcn/ui components.

**No emojis anywhere** — all icons must use Lucide (or the existing icon library). Never use emoji as icon stand-ins in code or UI.

---

## Design Decisions

### 1. Chrome — Profile moves to header (Option B)

**Before:**
- Top-right header: standalone `ThemeToggle` button + static non-clickable name/role/avatar display
- Sidebar bottom: `ProfileActions` component with a clickable avatar button that opens a Radix dropdown
- Result: profile options split across two locations; `ThemeToggle` duplicated (header + dropdown); header avatar looks clickable but is not

**After:**
- Top-right header: global search → clickable profile pill (name + role + avatar + chevron) that opens the full profile dropdown
- `ThemeToggle` removed from header as a standalone button — moved inside the profile dropdown
- Sidebar bottom: storage meter only. `ProfileActions` component removed from sidebar
- Zero duplication: every profile-related action lives in exactly one dropdown

**Profile dropdown contents (in order):**
1. User info header — name (bold) + email (muted), not clickable
2. Separator
3. Account — links to `/dashboard/account`
4. AI & Indexing — links to `/dashboard/settings?tab=ai`
5. Separator
6. Theme toggle — Sun/Moon icon, "Light mode" / "Dark mode" label, toggles on select
7. Separator
8. Keyboard shortcuts — triggers the shortcuts modal
9. Help — links to docs (external)
10. Separator
11. Delete account — destructive (red text)
12. Sign out — standard text

**Profile pill in header (right side of `dashboard-chrome.tsx`):**
```tsx
// Replace the current ThemeToggle + static avatar block with:
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border hover:bg-accent transition-colors">
      <div className="text-right hidden sm:block">
        <p className="text-[10px] font-black uppercase tracking-tight truncate max-w-[80px]">{name}</p>
        <p className="text-[8px] font-bold text-brand uppercase tracking-widest">{roleTitle}</p>
      </div>
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[10px] font-black text-white">
        {initials}
      </div>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content side="bottom" align="end" sideOffset={8}>
    {/* full profile menu — same items as current ProfileActions dropdown */}
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

**Files changed:**
- `components/dashboard/dashboard-chrome.tsx` — replace header right side
- `components/dashboard/sidebar.tsx` — remove `ProfileActions` from footer, keep storage meter
- `components/dashboard/profile-actions.tsx` — repurpose as `HeaderProfileMenu` (header-mounted, no isCollapsed prop needed)

---

### 2. Page headings — Icon + gradient title (Option 3)

**Rule:** Every dashboard page uses exactly this structure:

```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Icon in tinted square */}
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <PageIcon size={20} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Page <span className="text-gradient">Title</span>
        </h1>
        <p className="text-sm text-muted-foreground">One-line description of this page.</p>
      </div>
    </div>
    {/* Optional: primary action button — only if the page has a create/add action */}
    {hasPrimaryAction && (
      <Button className="h-9 px-4 text-xs font-black uppercase tracking-widest">
        <Plus className="mr-2 h-4 w-4" /> ACTION
      </Button>
    )}
  </div>
</div>
```

**Rules:**
- Always `h1`, never `h2`
- `text-2xl font-black tracking-tight` — no exceptions
- Gradient on the most descriptive/unique word (usually the last word): `<span className="text-gradient">Word</span>`
- Icon: Lucide icon, `size={20} strokeWidth={2.5}`, inside a `bg-primary/10` rounded square
- Subtitle: `text-sm text-muted-foreground`, one line
- Primary action button (if any): right side, `h-9` height, uppercase tracking-widest

**Page-by-page heading assignments:**

| Page | Icon (Lucide) | Gradient word | Primary action |
|------|--------------|---------------|----------------|
| Dashboard | `LayoutDashboard` | "Dashboard" | — |
| Files | `FolderOpen` | "Files" | Upload button |
| Shared Links | `Link` | "Links" | — |
| Invitations | `Mail` | "Invitations" | — |
| Teams | `Users` | "Teams" | Create Team |
| Settings | `Settings` | "Settings" | — |
| Profile / Account | `User` | "Account" | — |
| Audit Logs | `ClipboardList` | "Logs" | — |
| Permissions | `Shield` | "Permissions" | — |
| Indexing Pipeline | `Activity` | "Pipeline" | — |
| AI Search | `Search` | "Search" | — |
| Recents | `Clock` | "Recents" | — |
| Favorites | `Star` | "Favorites" | — |

**Files changed:** Every file under `app/dashboard/**/*.tsx` that has a page-level heading.

---

### 3. Empty states — Centered glass-card (Option A)

**Rule:** Every "no data" state uses exactly this structure:

```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  {/* Icon container — 64px, tinted with primary color */}
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <PageIcon size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  {/* Title */}
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">
    No [Items] Yet
  </h2>
  {/* Subtitle */}
  <p className="text-sm text-muted-foreground max-w-xs mb-6">
    One sentence explaining what this page shows and how to add items.
  </p>
  {/* Optional CTA — only if there is a direct action to take */}
  {hasCTA && (
    <Button className="h-9 px-6 text-xs font-black uppercase tracking-widest">
      <Plus className="mr-2 h-4 w-4" /> ADD FIRST ITEM
    </Button>
  )}
</div>
```

**Rules:**
- Container: always `glass-card`, `py-20`, `text-center`, `animate-fade-in`
- Icon: always 64px (`h-16 w-16`), `rounded-2xl`, `bg-primary/10`, icon at `size={28}` `strokeWidth={1.5}`
- Icon: same Lucide icon as the page heading (visual continuity)
- Title: `text-lg font-black`, sentence case: "No Active Links", "No Pending Invitations"
- Subtitle: `text-sm text-muted-foreground max-w-xs` — explains context and next step
- CTA button: only present if there is an action the user can take directly (not on Invitations, Audit Logs)

**Pages with empty states to standardise:**

| Page | Empty state message | Has CTA |
|------|--------------------|-|
| Dashboard (no team) | "No Teams Yet" | Yes — Create Team |
| Files (no bucket) | "No Bucket Selected" — subtitle: "Select a credential and bucket from the sidebar to browse your files." | No |
| Files (empty folder) | "This Folder Is Empty" | Yes — Upload |
| Shared Links | "No Active Links" | Yes — Go to Files |
| Invitations | "No Pending Invitations" | No |
| Audit Logs | "No Audit Events" | No |
| AI Search (no results) | "No Results Found" | No |
| Recents | "No Recent Files" | No |
| Favorites | "No Favorites Yet" | No |

---

### 4. Card item actions — Always visible

**Rule:** Action buttons on list/grid items must always be visible — never hidden behind opacity-0 hover reveals.

**Before (Links page):** copy and delete buttons wrapped in `opacity-0 group-hover:opacity-100`.

**After:** Action buttons always visible at `text-muted-foreground`, transition to `text-foreground` on hover. Remove the `opacity-0` class entirely.

```tsx
{/* Before */}
<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

{/* After */}
<div className="flex gap-1">
```

**Rationale:** Hover-only actions are invisible on touch devices and fail accessibility audits.

---

### 5. Loading states — Spinner in button, label unchanged

**Rule:** One loading pattern for all async button actions:

```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Save Changes
</Button>
```

- `Loader2` from Lucide with `animate-spin`
- Button label does **not** change to "Saving..." or "Deleting..."
- Button is `disabled` while pending
- Do not use `animate-pulse` or opacity changes on buttons

**Files to audit:** `DeleteTeamButton.tsx`, `profile-actions.tsx`, `invitations/page.tsx`, `links/page.tsx`, `settings/page.tsx`.

---

### 6. Form labels — Standardised sizing

**Rule:** All form field labels use:

```tsx
<label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
  Label Text
</label>
```

**Exception — full-page forms** (Profile / Account page): use `text-sm font-semibold text-foreground` since that page has a traditional form layout with larger inputs.

---

### 7. Tabs — Pill tab bar

**Rule:** All tab/toggle navigation uses the Settings page pill style:

```tsx
<div className="flex items-center gap-1 p-1 bg-muted/50 rounded-2xl">
  <button
    className={cn(
      "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
      isActive
        ? "bg-brand text-white shadow-lg shadow-brand/20"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    Tab Name
  </button>
</div>
```

Apply this to: Settings tabs (already done), Files view mode toggle (currently uses a different style).

---

### 8. Heading hierarchy — Always h1

**Rule:** Every page uses `h1` for the page title, never `h2`. The sidebar provides the navigation context — the page heading is always the top-level element on the page.

**Files to fix:** All pages currently using `h2` for the page title (Dashboard, Links, Teams, Settings, Audit Logs).

---

## Affected Files Summary

| File | Changes |
|------|---------|
| `components/dashboard/dashboard-chrome.tsx` | Replace header right-side with profile pill dropdown; remove ThemeToggle import |
| `components/dashboard/sidebar.tsx` | Remove ProfileActions from footer; storage meter stays |
| `components/dashboard/profile-actions.tsx` | Rename file to `header-profile-menu.tsx`, rename export to `HeaderProfileMenu`; remove `isCollapsed` prop; add ThemeToggle menu item; mount from `dashboard-chrome.tsx`; delete `profile-actions.tsx`; remove its import from `sidebar.tsx` |
| `app/dashboard/page.tsx` | Heading → h1 + Option 3 pattern; empty state → Option A |
| `app/dashboard/files/page.tsx` | Heading → h1 + Option 3; empty states → Option A; Files view toggle → pill tab style |
| `app/dashboard/links/page.tsx` | Heading → h1 + Option 3; empty state → Option A; remove hover-only card actions |
| `app/dashboard/invitations/page.tsx` | Heading → h1 + Option 3 (already close); empty state → Option A |
| `app/dashboard/teams/page.tsx` | Heading → h1 + Option 3 |
| `app/dashboard/settings/page.tsx` | Heading → h1 + Option 3 |
| `app/dashboard/profile/page.tsx` | Heading → h1 + Option 3 (keep larger form labels exception) |
| `app/dashboard/admin/audit/page.tsx` | Heading → h1 + Option 3; empty state → Option A |
| `app/dashboard/admin/permissions/page.tsx` | Heading → h1 + Option 3 |
| `app/dashboard/admin/indexing/page.tsx` | Heading → h1 + Option 3 |
| `app/dashboard/search/page.tsx` | Heading → h1 + Option 3; no-results → Option A |
| `app/dashboard/recents/page.tsx` | Heading → h1 + Option 3; empty state → Option A |
| `app/dashboard/favorites/page.tsx` | Heading → h1 + Option 3; empty state → Option A |

---

## Out of Scope

- Any API, database, or routing changes
- Adding new features or pages
- Refactoring business logic
- Changing animation timings or the glass-card/glassmorphism aesthetic
- Changing color palette or brand colors
