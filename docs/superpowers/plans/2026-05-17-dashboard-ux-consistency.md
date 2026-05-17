# Dashboard UX/UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a single coherent visual language across all dashboard screens — header chrome, page headings, empty states, card actions, loading states, form labels, and tabs.

**Architecture:** Four independent work streams executed in order: (1) chrome redesign, (2) page headings, (3) empty states, (4) micro-patterns. All changes are purely presentational — no API, routing, or data model changes. No emojis anywhere; all icons use Lucide.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI DropdownMenu, Lucide icons, shadcn/ui Button/Label.

**Spec:** `docs/superpowers/specs/2026-05-17-dashboard-ux-consistency-design.md`

**Note:** `app/dashboard/recents/page.tsx` and `app/dashboard/favorites/page.tsx` are listed in the spec's affected-files table but do not exist in the codebase yet — omitted from this plan until those pages are built.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `components/dashboard/header-profile-menu.tsx` | **Create** | New profile dropdown component mounted in header (replaces profile-actions.tsx) |
| `components/dashboard/dashboard-chrome.tsx` | **Modify** | Replace ThemeToggle + static avatar with HeaderProfileMenu pill |
| `components/dashboard/sidebar.tsx` | **Modify** | Remove ProfileActions footer; keep storage meter |
| `components/dashboard/profile-actions.tsx` | **Delete** | Replaced by header-profile-menu.tsx |
| `app/dashboard/page.tsx` | **Modify** | h1 + icon heading; empty state standardised |
| `app/dashboard/files/page.tsx` | **Modify** | h1 + icon heading; pill tab style; empty states |
| `app/dashboard/links/page.tsx` | **Modify** | h1 + icon heading; empty state; remove hover-only actions |
| `app/dashboard/invitations/page.tsx` | **Modify** | h1 + icon heading (minor — already close) |
| `app/dashboard/teams/page.tsx` | **Modify** | h1 + icon heading |
| `app/dashboard/settings/page.tsx` | **Modify** | h1 + icon heading |
| `app/dashboard/profile/page.tsx` | **Modify** | h1 + icon heading |
| `app/dashboard/credentials/page.tsx` | **Modify** | h1 + icon heading |
| `app/dashboard/search/page.tsx` | **Modify** | h1 + icon heading above the search bar |
| `app/dashboard/admin/audit/page.tsx` | **Modify** | h1 + icon heading; empty state |
| `app/dashboard/admin/indexing/page.tsx` | **Modify** | h1 + icon heading |
| `app/dashboard/admin/permissions/page.tsx` | **Modify** | Wrap PermissionManagement with h1 + icon heading |

---

## Task 1: Create HeaderProfileMenu component

**Files:**
- Create: `components/dashboard/header-profile-menu.tsx`

This is the profile dropdown that will live in the header. It is adapted from `profile-actions.tsx` but: removes the `isCollapsed` prop, removes the sidebar-style trigger button, adds ThemeToggle as a menu item, and exports a clean `HeaderProfileMenu` component.

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import {
  LogOut,
  Trash2,
  User,
  Database,
  Sun,
  Moon,
  HelpCircle,
  Keyboard,
  ChevronDown,
} from 'lucide-react'

type Member = {
  id: string
  email: string
  name: string | null
}

interface HeaderProfileMenuProps {
  name: string
  email: string
  roleTitle: string
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  href,
  destructive,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  href?: string
  destructive?: boolean
}) {
  const cls = cn(
    'flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer outline-none select-none',
    destructive
      ? 'text-red-400 hover:bg-red-500/10 data-[highlighted]:bg-red-500/10'
      : 'text-slate-300 hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]'
  )
  if (href) {
    return (
      <DropdownMenu.Item asChild>
        <Link href={href} className={cls} onClick={onClick}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      </DropdownMenu.Item>
    )
  }
  return (
    <DropdownMenu.Item className={cls} onSelect={onClick}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </DropdownMenu.Item>
  )
}

function Separator() {
  return <DropdownMenu.Separator className="my-1 border-t border-white/[0.06]" />
}

export function HeaderProfileMenu({ name, email, roleTitle }: HeaderProfileMenuProps) {
  const { selectedTeamId } = useDashboard()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [ownedTeamCount, setOwnedTeamCount] = useState(0)
  const [transferToUserId, setTransferToUserId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    const html = document.documentElement
    html.classList.toggle('dark')
    setIsDark(html.classList.contains('dark'))
  }

  useEffect(() => {
    const url = selectedTeamId
      ? `/api/account/members?teamId=${encodeURIComponent(selectedTeamId)}`
      : '/api/account/members'
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || [])
        setIsOwner(Boolean(data.isOwner))
        setOwnedTeamCount(Number(data.ownedTeamCount || 0))
      })
      .catch(() => {
        setMembers([])
        setIsOwner(false)
        setOwnedTeamCount(0)
      })
  }, [selectedTeamId])

  const canDelete = useMemo(() => {
    if (ownedTeamCount > 1) return false
    if (!isOwner) return true
    if (members.length === 0) return false
    return Boolean(transferToUserId)
  }, [isOwner, transferToUserId, members.length, ownedTeamCount])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferToUserId: transferToUserId || undefined }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }
      await signOut({ callbackUrl: '/login' })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete account' })
    } finally {
      setIsDeleting(false)
    }
  }

  const openKeyboardShortcuts = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true }))
  }

  const initials = name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase()

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border hover:bg-accent transition-colors duration-200 outline-none"
            aria-label="Profile menu"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[80px]">{name}</p>
              <p className="text-[8px] font-bold text-brand uppercase tracking-widest">{roleTitle}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {initials}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-[200] min-w-[220px] bg-slate-900 border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-bold text-slate-200 truncate">{name}</p>
              {email && <p className="text-[10px] text-slate-500 truncate">{email}</p>}
            </div>
            <Separator />

            <MenuItem icon={User} label="Account" href="/dashboard/account" />
            <MenuItem icon={Database} label="AI & Indexing" href="/dashboard/settings?tab=ai" />

            <Separator />

            <DropdownMenu.Item
              className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer outline-none select-none text-slate-300 hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]"
              onSelect={toggleTheme}
            >
              {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </DropdownMenu.Item>

            <Separator />

            <MenuItem icon={Keyboard} label="Keyboard shortcuts" onClick={openKeyboardShortcuts} />
            <MenuItem icon={HelpCircle} label="Help" href="https://docs.s3portal.io" />

            <Separator />

            <MenuItem
              icon={Trash2}
              label="Delete account"
              onClick={() => setDeleteOpen(true)}
              destructive
            />
            <MenuItem
              icon={LogOut}
              label="Sign out"
              onClick={() => signOut({ callbackUrl: '/login' })}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This will soft delete your account. You can contact support to restore it.
            </DialogDescription>
          </DialogHeader>
          {isOwner && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                You are the owner. Transfer ownership before deleting your account.
              </p>
              {ownedTeamCount > 1 && (
                <p className="text-sm text-red-600">
                  You own multiple teams. Transfer or delete those teams before deleting your account.
                </p>
              )}
              {members.length === 0 && (
                <p className="text-sm text-red-600">
                  No other team members available to transfer ownership.
                </p>
              )}
              <Select value={transferToUserId} onValueChange={setTransferToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a new owner" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              type="button"
              disabled={!canDelete || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? 'Deleting...' : 'Delete account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls components/dashboard/header-profile-menu.tsx
```
Expected: file exists.

---

## Task 2: Wire HeaderProfileMenu into dashboard-chrome.tsx

**Files:**
- Modify: `components/dashboard/dashboard-chrome.tsx`

Replace the `ThemeToggle` standalone button + static name/role/avatar block with `HeaderProfileMenu`. The component receives `name`, `email`, and `roleTitle` which are already available as props on `DashboardChrome`.

- [ ] **Step 1: Update imports — add HeaderProfileMenu, remove ThemeToggle**

In `components/dashboard/dashboard-chrome.tsx`, find:
```tsx
import { ThemeToggle } from '@/components/theme-toggle'
```
Replace with:
```tsx
import { HeaderProfileMenu } from './header-profile-menu'
```

- [ ] **Step 2: Replace the right-side header block**

Find this block (lines ~133–151):
```tsx
<div className={cn(
  "flex items-center gap-3",
  "transition-all duration-500 ease-out origin-right",
  isSearchActive ? "opacity-0 w-0 overflow-hidden scale-95" : "opacity-100 scale-100"
)}>
  <ThemeToggle />
  <div className="h-8 w-px bg-border hidden sm:block" />
  <div className="flex items-center gap-3">
    <div className="text-right hidden sm:block">
      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate max-w-[80px]">{name}</p>
      <p className="text-[8px] font-bold text-brand uppercase tracking-widest">{roleTitle}</p>
    </div>
    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark p-[1px] shrink-0">
      <div className="h-full w-full rounded-[10px] bg-card flex items-center justify-center text-[10px] font-black text-brand">
        {name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase()}
      </div>
    </div>
  </div>
</div>
```

Replace with:
```tsx
<div className={cn(
  "flex items-center",
  "transition-all duration-500 ease-out origin-right",
  isSearchActive ? "opacity-0 w-0 overflow-hidden scale-95" : "opacity-100 scale-100"
)}>
  <HeaderProfileMenu name={name} email={email} roleTitle={roleTitle} />
</div>
```

- [ ] **Step 3: Verify the app still compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Start dev server and open http://localhost:3000/dashboard**

Verify: top-right shows the name/role/avatar pill. Clicking it opens the dropdown with Account, AI & Indexing, theme toggle, shortcuts, help, delete, sign out.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/header-profile-menu.tsx components/dashboard/dashboard-chrome.tsx
git commit -m "feat: move profile menu to header pill (Option B chrome redesign)"
```

---

## Task 3: Remove ProfileActions from sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`
- Delete: `components/dashboard/profile-actions.tsx`

- [ ] **Step 1: Remove ProfileActions from sidebar footer**

In `components/dashboard/sidebar.tsx`, find and remove the import:
```tsx
import { ProfileActions } from './profile-actions'
```

Find the footer section at the bottom of the sidebar (around line 431–434):
```tsx
{/* Footer */}
<div className="px-4 py-6 border-t border-slate-200 dark:border-white/5">
  <ProfileActions isCollapsed={!sidebarExpanded} email={email} />
</div>
```

Replace with (keep the storage meter above it untouched, just remove the footer div entirely):
```tsx
{/* Footer removed — profile is now in the header */}
```

- [ ] **Step 2: Delete the old profile-actions.tsx file**

```bash
rm components/dashboard/profile-actions.tsx
```

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "profile-actions\|ProfileActions" --include="*.tsx" --include="*.ts" .
```
Expected: no matches.

- [ ] **Step 4: Verify the app compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Visual check**

Open http://localhost:3000/dashboard. Verify: sidebar bottom no longer has the user profile button — it ends at the storage meter. Profile is accessible only from the header pill.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/sidebar.tsx
git rm components/dashboard/profile-actions.tsx
git commit -m "refactor: remove ProfileActions from sidebar — profile now lives in header"
```

---

## Task 4: Standardise page headings — Dashboard, Links, Teams, Settings

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/links/page.tsx`
- Modify: `app/dashboard/teams/page.tsx`
- Modify: `app/dashboard/settings/page.tsx`

The standard heading block for every page:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <PageIcon size={20} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Page <span className="text-gradient">Word</span>
        </h1>
        <p className="text-sm text-muted-foreground">Short description.</p>
      </div>
    </div>
    {/* optional action button */}
  </div>
</div>
```

- [ ] **Step 1: Update app/dashboard/page.tsx heading**

Find the heading block (around line 191):
```tsx
<h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
  Welcome back, <span className="gradient-text">{session.user.name || 'Admin'}</span>
</h2>
```

Replace the entire heading section (including its wrapper div) with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <LayoutDashboard size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        My <span className="text-gradient">Dashboard</span>
      </h1>
      <p className="text-sm text-muted-foreground">Your storage workspace overview.</p>
    </div>
  </div>
</div>
```

Add `LayoutDashboard` to the Lucide import at the top of the file (it currently imports from `@phosphor-icons` — add a lucide import):
```tsx
import { LayoutDashboard } from 'lucide-react'
```

- [ ] **Step 2: Update app/dashboard/links/page.tsx heading**

Find (around line 169):
```tsx
<div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
  <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
    Shared <span className="gradient-text">Links</span>
  </h2>
  <p className="text-muted-foreground font-medium">
    Manage and monitor your active file sharing endpoints.
  </p>
</div>
```

Replace with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Link2 size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        Shared <span className="text-gradient">Links</span>
      </h1>
      <p className="text-sm text-muted-foreground">Manage and monitor your active file sharing endpoints.</p>
    </div>
  </div>
</div>
```

Add `Link2` to the Lucide imports at the top (the file already imports from lucide-react — add `Link2` to the list). `Link2` is the correct choice; the plain `Link` icon in Lucide is a chain-link variant with slightly different proportions — `Link2` reads more clearly at small sizes. Remove the now-unused `Link as LinkIcon` import if it was only used for the heading (check for other usages first with grep).

- [ ] **Step 3: Update app/dashboard/teams/page.tsx heading**

Find (around line 157):
```tsx
<div className="mb-10 animate-fade-in text-center lg:text-left hidden md:block">
  <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
    Team <span className="gradient-text">Management</span>
  </h2>
```

Replace with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <Users size={20} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Manage <span className="text-gradient">Teams</span>
        </h1>
        <p className="text-sm text-muted-foreground">Organize and manage your workspaces.</p>
      </div>
    </div>
  </div>
</div>
```

`Users` is already imported in this file.

- [ ] **Step 4: Update app/dashboard/settings/page.tsx heading**

Find the heading block (search for `h2` near `Platform Configuration` or `Settings`). Replace with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Settings size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        Platform <span className="text-gradient">Settings</span>
      </h1>
      <p className="text-sm text-muted-foreground">Configure appearance, credentials, and AI integrations.</p>
    </div>
  </div>
</div>
```

Add `Settings` to lucide imports if not already imported (rename if it conflicts with a component named `Settings`):
```tsx
import { Settings as SettingsIcon } from 'lucide-react'
```
Then use `<SettingsIcon size={20} strokeWidth={2.5} />`.

- [ ] **Step 5: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/links/page.tsx app/dashboard/teams/page.tsx app/dashboard/settings/page.tsx
git commit -m "style: standardise page headings — Dashboard, Links, Teams, Settings"
```

---

## Task 5: Standardise page headings — Profile, Credentials, Audit, Indexing, Permissions

**Files:**
- Modify: `app/dashboard/profile/page.tsx`
- Modify: `app/dashboard/credentials/page.tsx`
- Modify: `app/dashboard/admin/audit/page.tsx`
- Modify: `app/dashboard/admin/indexing/page.tsx`
- Modify: `app/dashboard/admin/permissions/page.tsx`

- [ ] **Step 1: Update app/dashboard/profile/page.tsx**

Find (around line 79):
```tsx
<h1 className="text-2xl font-bold text-foreground">Profile</h1>
```

Replace the surrounding heading section with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <User size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        My <span className="text-gradient">Account</span>
      </h1>
      <p className="text-sm text-muted-foreground">Manage your personal details and security.</p>
    </div>
  </div>
</div>
```

Add `User` to lucide imports.

- [ ] **Step 2: Update app/dashboard/credentials/page.tsx**

Find (around line 150):
```tsx
<h1 className="text-2xl font-bold">AWS Credentials</h1>
```

Replace surrounding heading section with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <KeyRound size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        AWS <span className="text-gradient">Credentials</span>
      </h1>
      <p className="text-sm text-muted-foreground">Manage your AWS access keys and storage identities.</p>
    </div>
  </div>
</div>
```

Add `KeyRound` to lucide imports.

- [ ] **Step 3: Update app/dashboard/admin/audit/page.tsx**

Find (around line 49):
```tsx
<h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight tracking-tight mb-2">
  Security <span className="gradient-text">Audit Logs</span>
</h2>
```

Replace the outer wrapper div and its contents with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <ClipboardList size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        Security <span className="text-gradient">Audit Logs</span>
      </h1>
      <p className="text-sm text-muted-foreground">Comprehensive timeline of all team actions.</p>
    </div>
  </div>
</div>
```

`ClipboardList` is already imported in this file.

- [ ] **Step 4: Update app/dashboard/admin/indexing/page.tsx**

Find (around line 140):
```tsx
<h2 className="text-2xl font-black text-foreground tracking-tight">Indexing Pipeline</h2>
```

Replace the surrounding heading block with:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Activity size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        Indexing <span className="text-gradient">Pipeline</span>
      </h1>
      <p className="text-sm text-muted-foreground">Monitor and control the AI indexing queue.</p>
    </div>
  </div>
</div>
```

`Activity` is already imported in this file.

- [ ] **Step 5: Update app/dashboard/admin/permissions/page.tsx**

This page delegates entirely to `<PermissionManagement teamId={teamId} />`. Add the heading above it:

Find the return statement and wrap:
```tsx
return (
  <div>
    <div className="mb-8 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Shield size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Role <span className="text-gradient">Permissions</span>
          </h1>
          <p className="text-sm text-muted-foreground">Configure what each role can access.</p>
        </div>
      </div>
    </div>
    <PermissionManagement teamId={teamId} />
  </div>
)
```

Add `Shield` to lucide imports.

- [ ] **Step 6: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/profile/page.tsx app/dashboard/credentials/page.tsx app/dashboard/admin/audit/page.tsx app/dashboard/admin/indexing/page.tsx app/dashboard/admin/permissions/page.tsx
git commit -m "style: standardise page headings — Profile, Credentials, Audit, Indexing, Permissions"
```

---

## Task 6: Standardise page headings — Invitations, Search

**Files:**
- Modify: `app/dashboard/invitations/page.tsx`
- Modify: `app/dashboard/search/page.tsx`

- [ ] **Step 1: Update app/dashboard/invitations/page.tsx**

The invitations page already has an icon + h1 pattern (it was the reference implementation). Verify it matches the standard exactly. Find the heading block and ensure it reads:
```tsx
<div className="mb-8 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Mail size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        Team <span className="text-gradient">Invitations</span>
      </h1>
      <p className="text-sm text-muted-foreground">Accept or decline pending workspace invitations.</p>
    </div>
  </div>
</div>
```

Adjust the existing heading to match exactly if it differs.

- [ ] **Step 2: Update app/dashboard/search/page.tsx — heading**

The search page currently has no page-level h1 — it goes straight into the search bar. Add the heading above the search bar:

Find the opening of the main content area and prepend:
```tsx
<div className="mb-6 animate-slide-up">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      <Search size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">
        AI <span className="text-gradient">Search</span>
      </h1>
      <p className="text-sm text-muted-foreground">Search your files with natural language.</p>
    </div>
  </div>
</div>
```

`Search` is already imported in this file.

- [ ] **Step 3: Update app/dashboard/search/page.tsx — no-results empty state**

Find the no-results state (rendered when a search query returns zero results — look for a condition like `results.length === 0 && query`). Replace it with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <Search size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Results Found</h2>
  <p className="text-sm text-muted-foreground max-w-xs">
    Try different keywords or a broader natural-language query.
  </p>
</div>
```

- [ ] **Step 4: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/invitations/page.tsx app/dashboard/search/page.tsx
git commit -m "style: standardise page headings and empty state — Invitations, Search"
```

---

## Task 7: Standardise empty states — Links, Invitations, Audit

**Files:**
- Modify: `app/dashboard/links/page.tsx`
- Modify: `app/dashboard/invitations/page.tsx`
- Modify: `app/dashboard/admin/audit/page.tsx`

The standard empty state:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <PageIcon size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No [Items] Yet</h2>
  <p className="text-sm text-muted-foreground max-w-xs mb-6">
    Explanation of what this page shows and how to get started.
  </p>
  {/* CTA only if there is a direct action */}
  <Button asChild className="h-9 px-6 text-xs font-black uppercase tracking-widest">
    <a href="/dashboard/files">Go to Files</a>
  </Button>
</div>
```

- [ ] **Step 1: Update links/page.tsx empty state**

Find the empty state block (when `links.length === 0`). Replace it entirely with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <Link2 size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Active Links</h2>
  <p className="text-sm text-muted-foreground max-w-xs mb-6">
    You haven&apos;t shared any files yet. Go to your Files Explorer to generate secure links.
  </p>
  <Button asChild className="h-9 px-6 text-xs font-black uppercase tracking-widest">
    <a href="/dashboard/files">Go to Files</a>
  </Button>
</div>
```

- [ ] **Step 2: Update invitations/page.tsx empty state**

Find the empty state (when `invites.length === 0`). Replace with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <Mail size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Pending Invitations</h2>
  <p className="text-sm text-muted-foreground max-w-xs">
    You&apos;re all caught up. When someone invites you to their workspace, it will appear here.
  </p>
</div>
```

- [ ] **Step 3: Update audit/page.tsx empty state**

Find the empty state block (when `logs.length === 0` or similar). Replace with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <ClipboardList size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Audit Events</h2>
  <p className="text-sm text-muted-foreground max-w-xs">
    Actions taken by team members will be recorded here for security and compliance.
  </p>
</div>
```

- [ ] **Step 4: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/links/page.tsx app/dashboard/invitations/page.tsx app/dashboard/admin/audit/page.tsx
git commit -m "style: standardise empty states — Links, Invitations, Audit Logs"
```

---

## Task 8: Standardise empty states — Dashboard (no team), Files

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 1: Update dashboard/page.tsx no-team empty state**

Find (around line 119):
```tsx
<h2 className="text-2xl font-black text-foreground mb-2 text-center">No Teams Found</h2>
```

Replace the entire no-team empty state block with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <Users size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Teams Yet</h2>
  <p className="text-sm text-muted-foreground max-w-xs mb-6">
    Create a team to get started with your storage workspace.
  </p>
  <div className="flex gap-3">
    <Button asChild className="h-9 px-6 text-xs font-black uppercase tracking-widest">
      <Link href="/dashboard/teams">Create Team</Link>
    </Button>
  </div>
</div>
```

Add `Users` to lucide imports.

- [ ] **Step 2: Update files/page.tsx empty states**

The files page has two empty states: (a) no bucket selected, (b) empty folder.

Find the no-bucket-selected empty state and replace with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <FolderOpen size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">No Bucket Selected</h2>
  <p className="text-sm text-muted-foreground max-w-xs">
    Select a credential and bucket from the sidebar to browse your files.
  </p>
</div>
```

Find the empty-folder empty state and replace with:
```tsx
<div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in">
  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <FolderOpen size={28} className="text-primary/60" strokeWidth={1.5} />
  </div>
  <h2 className="text-lg font-black text-foreground tracking-tight mb-2">This Folder Is Empty</h2>
  <p className="text-sm text-muted-foreground max-w-xs mb-6">
    Upload files to populate this folder.
  </p>
  <Button onClick={onUpload} className="h-9 px-6 text-xs font-black uppercase tracking-widest">
    Upload Files
  </Button>
</div>
```

(Adjust the `onUpload` prop/callback to match what the files page already uses for triggering upload.)

- [ ] **Step 3: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/files/page.tsx
git commit -m "style: standardise empty states — Dashboard, Files"
```

---

## Task 9: Fix card actions visibility — Links page

**Files:**
- Modify: `app/dashboard/links/page.tsx`

Card action buttons (copy, delete/revoke) are currently hidden behind `opacity-0 group-hover:opacity-100`. This is invisible on mobile and a UX accessibility issue.

- [ ] **Step 1: Remove opacity-0 from card action buttons**

In `app/dashboard/links/page.tsx`, find:
```tsx
<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
```

Replace with:
```tsx
<div className="flex gap-1">
```

- [ ] **Step 2: Verify visually**

Open http://localhost:3000/dashboard/links. If there are links, verify the copy and delete/revoke buttons are always visible on the cards, not just on hover.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/links/page.tsx
git commit -m "fix: make card action buttons always visible on Links page (accessibility)"
```

---

## Task 10: Standardise loading states — async buttons

**Files:**
- Modify: `app/dashboard/invitations/page.tsx`
- Modify: `components/dashboard/DeleteTeamButton.tsx`
- Modify: `app/dashboard/settings/page.tsx`

The standard loading state for any async button:
```tsx
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Button Label
</Button>
```

The label does NOT change while loading — the spinner appears alongside the label.

- [ ] **Step 1: Update invitations/page.tsx — Accept button**

Find the Accept button loading state:
```tsx
{processing === invite.id ? (
  <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
) : (
  <><CheckCircle size={14} className="mr-1.5" /> Accept</>
)}
```

Replace with:
```tsx
{processing === invite.id && <Loader2 size={14} className="mr-1.5 animate-spin" />}
<CheckCircle size={14} className="mr-1.5" />
Accept
```

- [ ] **Step 2: Update invitations/page.tsx — Decline button**

Find the Decline button loading state:
```tsx
{processing === invite.id ? (
  <div className="h-3.5 w-3.5 border-2 border-rose-400/40 border-t-rose-400 rounded-full animate-spin" />
) : (
  <><XCircle size={14} className="mr-1.5" /> Decline</>
)}
```

Replace with:
```tsx
{processing === invite.id && <Loader2 size={14} className="mr-1.5 animate-spin" />}
<XCircle size={14} className="mr-1.5" />
Decline
```

Add `Loader2` to the lucide imports in `invitations/page.tsx`.

- [ ] **Step 3: Update DeleteTeamButton.tsx**

In `components/dashboard/DeleteTeamButton.tsx`, find the submit button label (around line 37):
```tsx
{isPending ? 'Deleting...' : 'Delete Empty Team'}
```

Replace with:
```tsx
{isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
Delete Empty Team
```

Add `Loader2` to the lucide imports (`Trash2` is already imported — add `Loader2` to the same import).

- [ ] **Step 4: Update settings/page.tsx — Save Configuration button**

In `app/dashboard/settings/page.tsx`, find the credential save button (around line 755–761):
```tsx
{isUpdatingCredential ? 'Applying Changes...' : 'Save Configuration'}
```

Replace with:
```tsx
{isUpdatingCredential && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
Save Configuration
```

Add `Loader2` to the lucide imports in `settings/page.tsx`.

- [ ] **Step 5: Verify the app compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/invitations/page.tsx components/dashboard/DeleteTeamButton.tsx app/dashboard/settings/page.tsx
git commit -m "style: standardise async button loading state to Loader2 spinner"
```

---

## Task 11: Standardise Files view mode toggle to pill tab style

**Files:**
- Modify: `app/dashboard/files/page.tsx`

The view mode toggle (All / Recents / Favorites or similar) should use the same pill tab style as Settings:

```tsx
<div className="flex items-center gap-1 p-1 bg-muted/50 rounded-2xl">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
        activeTab === tab.id
          ? "bg-brand text-white shadow-lg shadow-brand/20"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {tab.label}
    </button>
  ))}
</div>
```

- [ ] **Step 1: Find the current view mode toggle in files/page.tsx**

Search for the tab/mode switcher and identify the current class pattern. Replace its container and button classes to match the pill style above.

- [ ] **Step 2: Verify visually**

Open http://localhost:3000/dashboard/files. Verify the view mode switcher looks like the Settings tabs (pill with brand-colored active state).

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "style: apply pill tab style to Files view mode toggle"
```

---

## Task 12: Standardise form labels

**Files:**
- Modify: `app/dashboard/profile/page.tsx`

All form field labels across the dashboard must use `text-[10px] font-black uppercase tracking-widest text-muted-foreground`. The settings, teams, and credentials pages already use this style. The **Profile page** is the outlier — it uses `text-sm` labels. Since Profile is a full-page form with larger inputs, it uses the exception rule: `text-sm font-semibold text-foreground`.

- [ ] **Step 1: Verify profile/page.tsx label style is intentionally larger**

In `app/dashboard/profile/page.tsx`, search for `<label` or `<Label` tags. Confirm they use `text-sm` — this is correct per the spec exception for full-page forms with larger inputs. No change needed there.

- [ ] **Step 2: Audit other pages for non-standard labels**

Run:
```bash
grep -rn "<label\|<Label" app/dashboard --include="*.tsx" | grep -v "text-\[10px\]\|text-sm\|text-xs"
```

If any labels appear without a size class, add `className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"` to them.

- [ ] **Step 3: Commit if any labels were updated**

```bash
git add app/dashboard
git commit -m "style: standardise form label sizing across dashboard pages"
```

---

## Task 13: Final visual QA pass

- [ ] **Step 1: Visit every page and verify**

Start the dev server (`npm run dev`) and check each page:

| Page | Check |
|------|-------|
| `/dashboard` | h1 + LayoutDashboard icon + gradient; no-team empty state matches standard |
| `/dashboard/files` | h1 + FolderOpen icon; empty states match standard; view toggle is pill style |
| `/dashboard/links` | h1 + Link2 icon; empty state matches standard; card buttons always visible |
| `/dashboard/invitations` | h1 + Mail icon; empty state matches standard; Loader2 spinner on buttons |
| `/dashboard/teams` | h1 + Users icon |
| `/dashboard/settings` | h1 + SettingsIcon icon |
| `/dashboard/profile` | h1 + User icon |
| `/dashboard/credentials` | h1 + KeyRound icon |
| `/dashboard/search` | h1 + Search icon above the search bar; no-results empty state matches standard |
| `/dashboard/admin/audit` | h1 + ClipboardList icon; empty state matches standard |
| `/dashboard/admin/indexing` | h1 + Activity icon |
| `/dashboard/admin/permissions` | h1 + Shield icon above PermissionManagement |
| **Header (all pages)** | Profile pill top-right; clicking opens dropdown with all options |
| **Sidebar (all pages)** | No profile button at the bottom; storage meter visible when expanded |

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git add -p
git commit -m "style: final QA tweaks from visual consistency pass"
```
