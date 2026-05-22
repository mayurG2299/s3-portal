# UI Redesign — AI Screens & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the sidebar redesign, AI Search palette + full results page, Credential Setup wizard, Indexing Pipeline Dashboard, and file indexing status badge as specified in `docs/superpowers/specs/2026-05-16-ui-redesign-ai-screens-design.md`.

**Architecture:** All UI components use CSS variables and existing utility classes (`glass-card`, `btn-primary-gradient`, etc.) — never hardcoded hex — so all 12 theme combinations (6 themes × dark/light) work automatically. Backend additions are three API routes and one SSE event type extension. RBAC is enforced symmetrically: client hides elements, server returns 403.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, shadcn/ui, Lucide icons, Tailwind CSS, next-themes, BullMQ, Prisma, Jest (API route tests only — no component unit tests in this project).

---

## File Map

### New files
- `app/api/admin/ai-credentials/route.ts` — GET (load masked keys) + POST (save encrypted key)
- `app/api/admin/ai-credentials/test/route.ts` — POST (live connection test against OpenAI + Anthropic)
- `app/dashboard/search/page.tsx` — Full AI search results page
- `app/dashboard/admin/indexing/page.tsx` — Indexing Pipeline Dashboard (admin only)
- `components/dashboard/ai-search-palette.tsx` — ⌘K AI search overlay (all roles)
- `components/dashboard/ai-credentials-tab.tsx` — Credential wizard UI (3-step + read view)
- `components/dashboard/indexing-badge.tsx` — Per-file indexing status badge for Explorer
- `__tests__/api/ai-credentials.test.ts` — API route tests for credential endpoints
- `__tests__/api/retry-failed-single.test.ts` — Tests for per-file retry body

### Modified files
- `lib/events/types.ts` — Add `indexing-status-changed` action to `FileChangedPayload`
- `lib/workers/indexing-worker.ts` — Emit `indexing-status-changed` SSE event on DONE/FAILED
- `app/api/admin/indexing/retry-failed/route.ts` — Support optional `{ fileId }` body for single-file retry
- `components/dashboard/sidebar.tsx` — Collapsible group nav + AI Search bar + Indexing Pipeline link
- `components/dashboard/profile-actions.tsx` — Popover-based context menu (Account, AI & Indexing, Appearance, Help, Sign out)
- `components/dashboard/global-search.tsx` — Remove ⌘K handler (delegated to ai-search-palette)
- `components/keyboard-shortcuts-modal.tsx` — Add "Search Palette" section
- `app/dashboard/settings/page.tsx` — Add "AI & Indexing" tab rendered from `ai-credentials-tab.tsx`
- `app/dashboard/files/page.tsx` — Add "AI Index" column (Owner/Admin only) using `indexing-badge.tsx`
- `app/dashboard/admin/layout.tsx` — Ensure Indexing Pipeline route is accessible

---

## Task 1: Extend SSE event type + emit from worker

**Files:**
- Modify: `lib/events/types.ts`
- Modify: `lib/workers/indexing-worker.ts`

- [ ] **Step 1: Add `indexing-status-changed` to the FileChangedPayload action union**

Open `lib/events/types.ts`. The file currently reads:
```typescript
export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated'
  key?: string
}
```

Change to:
```typescript
export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated' | 'indexing-status-changed'
  key?: string
  indexingStatus?: 'DONE' | 'FAILED'
}
```

- [ ] **Step 2: Find the publishFileChanged function**

```bash
grep -r "publishFileChanged\|publish.*file" /Users/mayur/Personal/projects/s3-portal/lib --include="*.ts" -l
```

Note the import path — you'll need it in the next step.

- [ ] **Step 3: Emit indexing-status-changed from the indexing worker**

Open `lib/workers/indexing-worker.ts`. Find the `setDone` and `setFailed` calls inside the worker's `process` callback. After each call, emit the event:

```typescript
// After setDone(...)
try {
  const file = await prisma.file.findUnique({
    where: { id: job.data.fileId },
    select: { bucketId: true, key: true },
  })
  if (file?.bucketId) {
    publishFileChanged(file.bucketId, {
      action: 'indexing-status-changed',
      key: file.key,
      indexingStatus: 'DONE',
    })
  }
} catch { /* non-fatal */ }

// After setFailed(...)
try {
  const file = await prisma.file.findUnique({
    where: { id: job.data.fileId },
    select: { bucketId: true, key: true },
  })
  if (file?.bucketId) {
    publishFileChanged(file.bucketId, {
      action: 'indexing-status-changed',
      key: file.key,
      indexingStatus: 'FAILED',
    })
  }
} catch { /* non-fatal */ }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add lib/events/types.ts lib/workers/indexing-worker.ts
git commit -m "feat: emit indexing-status-changed SSE event from worker on DONE/FAILED"
```

---

## Task 2: Update retry-failed route to support single-file body

**Files:**
- Modify: `app/api/admin/indexing/retry-failed/route.ts`
- Create: `__tests__/api/retry-failed-single.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/retry-failed-single.test.ts`:

```typescript
/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      findMany: jest.fn().mockResolvedValue([{ fileId: 'file-1' }, { fileId: 'file-2' }]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  },
}))
jest.mock('@/lib/indexing/queue', () => ({ enqueueFileIndexing: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/api-utils', () => ({ requireScreenPermission: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1' }),
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/admin/indexing/retry-failed/route'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'
import { NextRequest } from 'next/server'

function makeRequest(body: object = {}) {
  return new NextRequest('http://localhost/api/admin/indexing/retry-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/indexing/retry-failed', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retries all failed when no fileId given', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    expect(prisma.fileEmbedding.updateMany).toHaveBeenCalled()
    expect(enqueueFileIndexing).toHaveBeenCalledTimes(2)
  })

  it('retries only the given fileId when provided', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({ fileId: 'file-1' }))
    expect(res.status).toBe(200)
    expect(prisma.fileEmbedding.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fileId: 'file-1' } })
    )
    expect(enqueueFileIndexing).toHaveBeenCalledWith('file-1', 5)
    expect(prisma.fileEmbedding.updateMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest __tests__/api/retry-failed-single.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL (single-file path not implemented yet).

- [ ] **Step 3: Update the route to support optional fileId**

Replace the body of `app/api/admin/indexing/retry-failed/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')

  const body = await request.json().catch(() => ({}))
  const { fileId } = body as { fileId?: string }

  if (fileId) {
    // Single-file retry
    await prisma.fileEmbedding.update({
      where: { fileId },
      data: { status: 'PENDING', errorMessage: null },
    })
    await enqueueFileIndexing(fileId, 5)
    return NextResponse.json({ ok: true, requeued: 1 })
  }

  // Bulk retry — all FAILED
  const failed = await prisma.fileEmbedding.findMany({
    where: { status: 'FAILED' },
    select: { fileId: true },
  })
  await prisma.fileEmbedding.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', errorMessage: null },
  })
  for (const { fileId: fid } of failed) {
    await enqueueFileIndexing(fid, 5)
  }
  return NextResponse.json({ ok: true, requeued: failed.length })
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest __tests__/api/retry-failed-single.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all previous tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/indexing/retry-failed/route.ts __tests__/api/retry-failed-single.test.ts
git commit -m "feat: retry-failed route supports optional fileId for single-file retry"
```

---

## Task 3: Credential API routes

**Files:**
- Create: `app/api/admin/ai-credentials/route.ts`
- Create: `app/api/admin/ai-credentials/test/route.ts`
- Create: `__tests__/api/ai-credentials.test.ts`

**Background:** The `DEGRADED` flag and key storage need to be persisted somewhere. The simplest MVP approach is to store keys in a team-scoped `TeamSetting` record or as environment variables set at runtime. However, Prisma schema changes need a migration. Instead, for MVP, store OpenAI and Anthropic keys in a `teamSettings` JSON column (if it exists) or in a new `AiCredential` table. Check the schema first:

```bash
grep -n "teamSettings\|AiCredential\|TeamSetting\|json\|Json" /Users/mayur/Personal/projects/s3-portal/prisma/schema.prisma | head -20
```

If no suitable storage exists, use `process.env` values as read-only (keys come from `.env`) and the API routes return configured/unconfigured status based on whether the env vars are set. This avoids a schema migration for MVP. The wizard UI will show a note: "Contact your administrator to set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in the environment." Adjust implementation based on what you find.

- [ ] **Step 1: Check schema for existing key storage**

```bash
grep -n "TeamSetting\|AiCredential\|apiKey\|openai\|anthropic" /Users/mayur/Personal/projects/s3-portal/prisma/schema.prisma
```

- [ ] **Step 2: Write the failing tests**

Create `__tests__/api/ai-credentials.test.ts`:

```typescript
/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/api-utils', () => ({ requireScreenPermission: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1' }),
}))

import { getServerSession } from 'next-auth'
import { GET, POST } from '@/app/api/admin/ai-credentials/route'
import { NextRequest } from 'next/server'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/admin/ai-credentials', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/ai-credentials', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns configured status for each provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('openai')
    expect(body).toHaveProperty('anthropic')
    expect(typeof body.openai.configured).toBe('boolean')
  })
})

describe('POST /api/admin/ai-credentials/test', () => {
  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const { POST: testPOST } = require('@/app/api/admin/ai-credentials/test/route')
    const res = await testPOST(makeRequest('POST'))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run tests — expect failure**

```bash
npx jest __tests__/api/ai-credentials.test.ts --no-coverage 2>&1 | tail -15
```

- [ ] **Step 4: Create the credential GET/POST route**

Create `app/api/admin/ai-credentials/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

function lastFour(key: string | undefined): string | null {
  return key && key.length >= 4 ? key.slice(-4) : null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'VIEW')

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    openai: { configured: Boolean(openaiKey), lastFour: lastFour(openaiKey) },
    anthropic: { configured: Boolean(anthropicKey), lastFour: lastFour(anthropicKey) },
    note: 'Keys are read from server environment variables. Contact your administrator to update them.',
  })
}

// POST is a no-op for env-based keys — UI still calls it but we return a friendly message
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')

  return NextResponse.json({
    ok: true,
    message: 'Keys are managed via environment variables. Restart the server after updating them.',
  })
}
```

- [ ] **Step 5: Create the connection test route**

Create `app/api/admin/ai-credentials/test/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

async function testOpenAI(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { ok: false, latencyMs: 0, error: 'OPENAI_API_KEY not set' }
  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` }
    return { ok: true, latencyMs }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, error: e.message }
  }
}

async function testAnthropic(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false, latencyMs: 0, error: 'ANTHROPIC_API_KEY not set' }
  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` }
    return { ok: true, latencyMs }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, error: e.message }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'VIEW')

  const [openai, anthropic] = await Promise.all([testOpenAI(), testAnthropic()])

  return NextResponse.json({ openai, anthropic })
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npx jest __tests__/api/ai-credentials.test.ts --no-coverage 2>&1 | tail -10
```

- [ ] **Step 7: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/ai-credentials/ __tests__/api/ai-credentials.test.ts
git commit -m "feat: add AI credentials GET/POST and connection test API routes"
```

---

## Task 4: Sidebar redesign — collapsible groups + AI Search bar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

**Context:** The current sidebar has `mainNavItems` (flat array) and `adminNavItems` (flat array) rendered as `<Link>` rows. We're replacing this with three collapsible groups (FILES, WORKSPACE, ADMIN) plus a persistent AI Search bar. The sidebar retains its existing collapse behaviour (icon-only when `!sidebarExpanded`).

- [ ] **Step 1: Add group collapse state with localStorage persistence**

At the top of the `Sidebar` function, after existing hooks, add:

```typescript
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
  if (typeof window === 'undefined') return { files: true, workspace: true, admin: false }
  try {
    const saved = localStorage.getItem(`sidebar-groups-${email}`)
    return saved ? JSON.parse(saved) : { files: true, workspace: true, admin: false }
  } catch { return { files: true, workspace: true, admin: false } }
})

const toggleGroup = useCallback((group: string) => {
  setOpenGroups(prev => {
    const next = { ...prev, [group]: !prev[group] }
    try { localStorage.setItem(`sidebar-groups-${email}`, JSON.stringify(next)) } catch {}
    return next
  })
}, [email])
```

- [ ] **Step 2: Replace the nav section with grouped structure**

Replace the `<nav>` block (everything between `{/* Navigation */}` and `{adminNavItems.length > 0 && ...}`) with:

```tsx
<nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-0.5" aria-label="Main navigation">

  {/* Dashboard — always pinned */}
  <NavItem href="/dashboard" label="Dashboard" icon={Home} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />

  {/* AI Search bar */}
  {sidebarExpanded && (
    <button
      type="button"
      onClick={() => {/* open AI palette — handled in dashboard-chrome via event */
        window.dispatchEvent(new CustomEvent('open-ai-search'))
      }}
      className="w-full mt-2 mb-1 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1 text-left">AI Search files...</span>
      <span className="flex gap-0.5">
        <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[9px] font-mono">⌘</kbd>
        <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[9px] font-mono">K</kbd>
      </span>
    </button>
  )}

  {/* FILES group */}
  <NavGroup
    label="Files"
    isOpen={openGroups.files}
    sidebarExpanded={sidebarExpanded}
    onToggle={() => toggleGroup('files')}
  >
    {canViewScreen(SCREENS.FILES_LIST) && <NavItem href="/dashboard/files" label="Explorer" icon={FolderOpen} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />}
    {canViewScreen(SCREENS.LINKS_LIST) && <NavItem href="/dashboard/links" label="Shared Links" icon={LinkIcon} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />}
    <NavItem href="/dashboard/files?view=recents" label="Recents" icon={Clock} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />
  </NavGroup>

  {/* WORKSPACE group */}
  {(isAdmin || canViewScreen(SCREENS.TEAM_INVITATIONS)) && (
    <NavGroup
      label="Workspace"
      isOpen={openGroups.workspace}
      sidebarExpanded={sidebarExpanded}
      onToggle={() => toggleGroup('workspace')}
      flatWhenSingle
    >
      {isAdmin && <NavItem href="/dashboard/teams" label="Team" icon={Users} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />}
      {canViewScreen(SCREENS.TEAM_INVITATIONS) && (
        <NavItem href="/dashboard/invitations" label="Invitations" icon={Mail} badge={pendingInviteCount} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />
      )}
    </NavGroup>
  )}

  {/* ADMIN group */}
  {isAdmin && (
    <NavGroup
      label="Admin"
      isOpen={openGroups.admin}
      sidebarExpanded={sidebarExpanded}
      onToggle={() => toggleGroup('admin')}
    >
      <NavItem href="/dashboard/admin/permissions" label="Permissions" icon={Shield} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />
      {canViewScreen(SCREENS.ADMIN_AUDIT_LOG) && <NavItem href="/dashboard/admin/audit" label="Audit Logs" icon={ClipboardList} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />}
      <NavItem href="/dashboard/admin/indexing" label="Indexing" icon={Cpu} sidebarExpanded={sidebarExpanded} onClick={handleNavClick} />
    </NavGroup>
  )}
</nav>
```

- [ ] **Step 3: Add the NavItem and NavGroup helper components**

Add these above the `Sidebar` function (not exported):

```tsx
function NavItem({
  href, label, icon: Icon, badge, sidebarExpanded, onClick,
}: {
  href: string; label: string; icon: React.ElementType; badge?: number
  sidebarExpanded: boolean; onClick: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl transition-all duration-200 group relative',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        sidebarExpanded ? 'px-3 py-2' : 'justify-center p-3'
      )}
      aria-label={label}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
      )}
      <div className="relative shrink-0">
        <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : '')} strokeWidth={isActive ? 2.5 : 2} />
        {!sidebarExpanded && badge && badge > 0 ? (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-black flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      {sidebarExpanded && (
        <>
          <span className="text-xs font-semibold flex-1">{label}</span>
          {badge && badge > 0 ? (
            <span className="ml-auto px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive text-[9px] font-black">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  )
}

function NavGroup({
  label, isOpen, sidebarExpanded, onToggle, children, flatWhenSingle = false,
}: {
  label: string; isOpen: boolean; sidebarExpanded: boolean
  onToggle: () => void; children: React.ReactNode; flatWhenSingle?: boolean
}) {
  const validChildren = React.Children.toArray(children).filter(Boolean)
  if (validChildren.length === 0) return null

  // If only one child and flatWhenSingle, skip the group wrapper
  if (flatWhenSingle && validChildren.length === 1) {
    return <div className="mt-1">{validChildren[0]}</div>
  }

  return (
    <div className="mt-2">
      {sidebarExpanded && (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {label}
          <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen ? '' : '-rotate-90')} />
        </button>
      )}
      {(isOpen || !sidebarExpanded) && (
        <div className="mt-0.5 space-y-0.5">{children}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update imports at the top of sidebar.tsx**

Add to the Lucide imports: `Sparkles, Clock, Cpu, ChevronDown`  
Remove: `ChevronLeft, ChevronRight, X` (if no longer used — check first)

- [ ] **Step 5: Verify the sidebar renders without TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "sidebar" | head -10
```

- [ ] **Step 6: Start dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Verify:
- Three collapsible groups appear
- AI Search bar is visible and clickable
- Indexing link appears for admin users
- Groups collapse/expand and state is persisted across refresh
- Icon-only mode still works when sidebar is collapsed

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: sidebar redesign — collapsible groups, AI search bar, Indexing link"
```

---

## Task 5: Profile context menu refactor

**Files:**
- Modify: `components/dashboard/profile-actions.tsx`

**Context:** The current `ProfileActions` is a toggle-open drawer. Replace it with a `Popover` (shadcn/ui) containing: profile header, Account, AI & Indexing, Appearance toggle, Help, Keyboard shortcuts, Sign out. Move delete-account to the Account page — it doesn't belong in a quick-access menu.

- [ ] **Step 1: Check if Popover is available in shadcn/ui**

```bash
ls /Users/mayur/Personal/projects/s3-portal/components/ui/ | grep -i popover
```

If not present, install it:
```bash
npx shadcn-ui@latest add popover
```

- [ ] **Step 2: Rewrite profile-actions.tsx**

Replace the full file content with:

```tsx
'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { useShortcutsModal } from '@/lib/contexts/shortcuts-modal-context'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  MoreHorizontal, User, Settings2, Sun, Moon, HelpCircle,
  Keyboard, LogOut,
} from 'lucide-react'
import { getSavedMode, applyThemeAndMode, getSavedTheme } from '@/lib/theme-store'
import type { ThemeMode } from '@/lib/theme-store'

type ProfileActionsProps = {
  email: string
  name?: string | null
  isCollapsed?: boolean
}

export function ProfileActions({ email, name, isCollapsed = false }: ProfileActionsProps) {
  const { selectedTeamId } = useDashboard()
  const { openModal: openShortcuts } = useShortcutsModal()
  const [mode, setMode] = useState<ThemeMode>(() => getSavedMode())

  const toggleMode = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyThemeAndMode(getSavedTheme(), next)
  }, [mode])

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0].toUpperCase()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted/50',
            isCollapsed && 'justify-center'
          )}
        >
          <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-brand-dark flex items-center justify-center text-[11px] font-black text-primary-foreground">
            {initials}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold truncate text-foreground">{name || email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{email}</p>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-56 p-1" sideOffset={6}>
        {/* Profile header */}
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-foreground truncate">{name || email}</p>
          <p className="text-[10px] text-muted-foreground truncate">{email}</p>
        </div>
        <Separator className="my-1" />

        <MenuItem href="/dashboard/profile" icon={User} label="Account" />
        <MenuItem href="/dashboard/settings?tab=ai" icon={Settings2} label="AI & Indexing" />

        <button
          type="button"
          onClick={toggleMode}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span className="flex-1 text-left">Appearance</span>
          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            {mode === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        <Separator className="my-1" />

        <MenuItem href="https://docs.s3portal.com" icon={HelpCircle} label="Help & Support" external />
        <button
          type="button"
          onClick={openShortcuts}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Keyboard shortcuts</span>
          <kbd className="text-[9px] border border-border rounded px-1 py-0.5 bg-background">?</kbd>
        </button>

        <Separator className="my-1" />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  )
}

function MenuItem({ href, icon: Icon, label, external }: {
  href: string; icon: React.ElementType; label: string; external?: boolean
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
```

- [ ] **Step 3: Update Sidebar to pass email/name to ProfileActions**

In `sidebar.tsx`, the `<ProfileActions>` call at the bottom needs `email` and `name` props. Check what data is available in SidebarProps and pass it through. Add `name?: string` to `SidebarProps` if needed, and pass it from `dashboard-chrome.tsx`.

- [ ] **Step 4: Verify no TypeScript errors and visually test**

```bash
npx tsc --noEmit 2>&1 | grep "profile-actions\|sidebar" | head -10
```

Open dev server. Click the profile footer — the popover should open above the footer with all menu items.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/profile-actions.tsx components/dashboard/sidebar.tsx
git commit -m "feat: profile actions — popover context menu with Account, AI & Indexing, Appearance, Sign out"
```

---

## Task 6: AI Search Palette component

**Files:**
- Create: `components/dashboard/ai-search-palette.tsx`
- Modify: `components/dashboard/dashboard-chrome.tsx` (register ⌘K + open-ai-search event)
- Modify: `components/dashboard/global-search.tsx` (remove ⌘K handler)

**Context:** The existing `GlobalSearch` handles ⌘K for a text-based search. We're adding a separate AI palette that intercepts ⌘K and calls the `/api/ai/agent` endpoint. The existing text search moves to a secondary trigger or stays as-is for non-AI search.

- [ ] **Step 1: Create the AI Search Palette**

Create `components/dashboard/ai-search-palette.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sparkles, Clock, Video, Image, FileText, Music, File, X, ArrowRight } from 'lucide-react'
import { useDashboard } from '@/lib/contexts/dashboard-context'

interface AiResult {
  id: string
  name: string
  contentType: string
  parentPath: string
  semanticScore: number
  reason?: string
}

interface AiResponse {
  files: AiResult[]
  summary: string
}

const EXAMPLE_QUERIES = [
  'Show me product demo videos',
  'Find the latest financial reports',
  'Images with charts or dashboards',
]

const RECENT_KEY = 'ai-search-recents'
const MAX_RECENTS = 5

function getFileIcon(contentType: string) {
  if (contentType.startsWith('video/')) return { Icon: Video, color: 'text-violet-400' }
  if (contentType.startsWith('image/')) return { Icon: Image, color: 'text-green-400' }
  if (contentType.startsWith('audio/')) return { Icon: Music, color: 'text-blue-400' }
  if (contentType.includes('pdf') || contentType.includes('word') || contentType.includes('document'))
    return { Icon: FileText, color: 'text-red-400' }
  return { Icon: File, color: 'text-muted-foreground' }
}

function matchPct(score: number) {
  return Math.round(score * 100)
}

export function AiSearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { selectedTeamId } = useDashboard()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'results' | 'empty'>('idle')
  const [results, setResults] = useState<AiResult[]>([])
  const [summary, setSummary] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY)
      if (saved) setRecents(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setStatus('idle')
      setActiveIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const saveRecent = useCallback((q: string) => {
    setRecents(prev => {
      const next = [q, ...prev.filter(r => r !== q)].slice(0, MAX_RECENTS)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStatus('loading')
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, teamId: selectedTeamId }),
        signal: abortRef.current.signal,
      })
      const data: AiResponse = await res.json()
      saveRecent(q)
      if (!data.files?.length) {
        setStatus('empty')
      } else {
        setResults(data.files)
        setSummary(data.summary || '')
        setStatus('results')
        setActiveIndex(0)
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setStatus('empty')
    }
  }, [selectedTeamId, saveRecent])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      onClose()
      router.push(`/dashboard/files?highlight=${results[activeIndex].id}`)
    }
  }, [results, activeIndex, onClose, router])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Sparkles className={cn('h-4 w-4 shrink-0 text-primary', status === 'loading' && 'animate-pulse')} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') runSearch(query)
              handleKeyDown(e)
            }}
            placeholder="Search files with AI..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setStatus('idle') }}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <kbd className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-background text-muted-foreground">Esc</kbd>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto">

          {/* Idle — recents or examples */}
          {status === 'idle' && (
            <div className="py-2">
              <p className="px-4 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                {recents.length > 0 ? 'Recent searches' : 'Try asking...'}
              </p>
              {(recents.length > 0 ? recents : EXAMPLE_QUERIES).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setQuery(q); runSearch(q) }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{q}</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              AI is searching your files...
            </div>
          )}

          {/* Empty */}
          {status === 'empty' && (
            <div className="px-4 py-5">
              <p className="text-sm text-muted-foreground">No files matched your query. Try rephrasing or using different keywords.</p>
            </div>
          )}

          {/* Results */}
          {status === 'results' && (
            <>
              {summary && (
                <div className="flex items-start gap-2 px-4 py-2.5 border-b border-border/50 bg-primary/5">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-primary/90">{summary}</p>
                </div>
              )}
              {results.slice(0, 8).map((file, i) => {
                const { Icon, color } = getFileIcon(file.contentType)
                const pct = matchPct(file.semanticScore)
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => { onClose(); router.push(`/dashboard/files?highlight=${file.id}`) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 border-l-2 transition-colors text-left',
                      i === activeIndex
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-muted/50'
                    )}
                  >
                    <div className={cn('h-8 w-8 shrink-0 rounded-lg flex items-center justify-center', 'bg-muted/50')}>
                      <Icon className={cn('h-4 w-4', color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{file.parentPath}</p>
                    </div>
                    <span className={cn(
                      'text-[9px] font-bold rounded-full px-2 py-0.5 shrink-0',
                      pct >= 80 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {pct}%
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span><kbd className="border border-border rounded px-1 bg-background">↑↓</kbd> navigate</span>
            <span><kbd className="border border-border rounded px-1 bg-background">↵</kbd> open</span>
            <span><kbd className="border border-border rounded px-1 bg-background">Esc</kbd> close</span>
          </div>
          {status === 'results' && (
            <button
              type="button"
              onClick={() => { onClose(); router.push(`/dashboard/search?q=${encodeURIComponent(query)}`) }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              See all results <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register the palette in dashboard-chrome.tsx**

Open `components/dashboard/dashboard-chrome.tsx`. Add state and effect:

```typescript
const [aiPaletteOpen, setAiPaletteOpen] = useState(false)

useEffect(() => {
  const handler = () => setAiPaletteOpen(true)
  const keyHandler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setAiPaletteOpen(true)
    }
  }
  window.addEventListener('open-ai-search', handler)
  window.addEventListener('keydown', keyHandler)
  return () => {
    window.removeEventListener('open-ai-search', handler)
    window.removeEventListener('keydown', keyHandler)
  }
}, [])
```

Add the palette to the JSX (outside any scroll container):
```tsx
<AiSearchPalette open={aiPaletteOpen} onClose={() => setAiPaletteOpen(false)} />
```

Import it at the top: `import { AiSearchPalette } from './ai-search-palette'`

- [ ] **Step 3: Remove ⌘K handler from global-search.tsx**

In `global-search.tsx`, find the `keydown` event listener that checks for `metaKey + k` and remove it (the new palette owns ⌘K now).

- [ ] **Step 4: Test the palette**

Start dev server. Press ⌘K — palette should open. Type a query, press Enter — AI results should appear. Press Escape — palette closes.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ai-search-palette.tsx components/dashboard/dashboard-chrome.tsx components/dashboard/global-search.tsx
git commit -m "feat: AI search palette (⌘K) with recent searches, AI results, and See all results link"
```

---

## Task 7: AI Search full results page

**Files:**
- Create: `app/dashboard/search/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/dashboard/search/page.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ChevronLeft, Video, Image, FileText, Music, File, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/contexts/dashboard-context'
import { useRBAC } from '@/components/rbac-provider'
import { useKeyboardNav } from '@/hooks/use-keyboard-nav'

interface AiResult {
  id: string; name: string; contentType: string; parentPath: string
  semanticScore: number; reason?: string; size?: number; updatedAt?: string
}

function getFileIcon(ct: string) {
  if (ct.startsWith('video/')) return { Icon: Video, color: 'text-violet-400' }
  if (ct.startsWith('image/')) return { Icon: Image, color: 'text-green-400' }
  if (ct.startsWith('audio/')) return { Icon: Music, color: 'text-blue-400' }
  if (ct.includes('pdf') || ct.includes('word')) return { Icon: FileText, color: 'text-red-400' }
  return { Icon: File, color: 'text-muted-foreground' }
}

const TYPE_LABELS: Record<string, string> = {
  'video/': 'Video', 'image/': 'Image', 'audio/': 'Audio',
}
function typeLabel(ct: string) {
  for (const [prefix, label] of Object.entries(TYPE_LABELS)) {
    if (ct.startsWith(prefix)) return label
  }
  return 'Document'
}

export default function SearchPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { selectedTeamId } = useDashboard()
  const { canEditScreen } = useRBAC()
  const canEdit = canEditScreen?.('FILES_LIST') ?? false

  const initialQuery = params.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [inputValue, setInputValue] = useState(initialQuery)
  const [status, setStatus] = useState<'idle' | 'loading' | 'results' | 'empty'>('idle')
  const [results, setResults] = useState<AiResult[]>([])
  const [summary, setSummary] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [scoreFilter, setScoreFilter] = useState<string[]>(['high', 'medium'])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, teamId: selectedTeamId }),
      })
      const data = await res.json()
      if (!data.files?.length) { setStatus('empty'); return }
      setResults(data.files)
      setSummary(data.summary || '')
      setStatus('results')
      setSelectedId(data.files[0]?.id ?? null)
    } catch { setStatus('empty') }
  }, [selectedTeamId])

  useEffect(() => { if (initialQuery) runSearch(initialQuery) }, [])  // eslint-disable-line

  const filtered = useMemo(() => {
    return results.filter(r => {
      const label = typeLabel(r.contentType)
      if (typeFilter.length > 0 && !typeFilter.includes(label)) return false
      const pct = Math.round(r.semanticScore * 100)
      if (scoreFilter.includes('high') && pct >= 80) return true
      if (scoreFilter.includes('medium') && pct >= 50 && pct < 80) return true
      if (scoreFilter.includes('low') && pct < 50) return true
      return scoreFilter.length === 0
    })
  }, [results, typeFilter, scoreFilter])

  const selectedFile = useMemo(() => filtered.find(r => r.id === selectedId) ?? null, [filtered, selectedId])

  // Keyboard nav — ↑↓ moves selectedId through filtered list
  const selectedIndex = filtered.findIndex(r => r.id === selectedId)
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); const next = filtered[selectedIndex + 1]; if (next) setSelectedId(next.id) }
    if (e.key === 'ArrowUp') { e.preventDefault(); const prev = filtered[selectedIndex - 1]; if (prev) setSelectedId(prev.id) }
    if (e.key === 'Escape') setSelectedId(null)
  }, [filtered, selectedIndex])
  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of results) {
      const label = typeLabel(r.contentType)
      counts[label] = (counts[label] ?? 0) + 1
    }
    return counts
  }, [results])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <Link href="/dashboard/files" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ChevronLeft className="h-4 w-4" /> Files
        </Link>
        <div className="w-px h-4 bg-border" />
        <div className="flex-1 flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setQuery(inputValue); runSearch(inputValue) } }}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {status === 'results' && <span className="text-xs text-muted-foreground shrink-0">{filtered.length} results</span>}
        </div>
        <button type="button" className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground">
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* AI summary */}
      {summary && (
        <div className="flex items-start gap-2 px-6 py-2.5 bg-primary/5 border-b border-primary/10 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-primary/90">{summary}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Filters */}
        <div className="w-44 shrink-0 border-r border-border px-3 py-4 flex flex-col gap-4 overflow-y-auto">
          <FilterSection title="File Type" items={Object.entries(typeCounts).map(([label, count]) => ({ label, count }))}
            selected={typeFilter} onChange={setTypeFilter} />
          <FilterSection title="Match Score"
            items={[{ label: 'high', display: 'High (80%+)' }, { label: 'medium', display: 'Medium (50%+)' }, { label: 'low', display: 'Low (<50%)' }]}
            selected={scoreFilter} onChange={setScoreFilter} />
          {(typeFilter.length > 0 || scoreFilter.length < 3) && (
            <button type="button" onClick={() => { setTypeFilter([]); setScoreFilter(['high', 'medium', 'low']) }}
              className="text-[10px] text-muted-foreground hover:text-foreground text-left">
              Clear filters
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto border-r border-border">
          {status === 'loading' && <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 animate-pulse text-primary" /> Searching...</div>}
          {status === 'empty' && <div className="px-5 py-8 text-sm text-muted-foreground">No results. Try rephrasing your query.</div>}
          {status === 'results' && filtered.map(file => {
            const { Icon, color } = getFileIcon(file.contentType)
            const pct = Math.round(file.semanticScore * 100)
            const isSelected = file.id === selectedId
            return (
              <button key={file.id} type="button" onClick={() => setSelectedId(file.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3 border-l-2 border-b border-border/40 text-left transition-colors',
                  isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/30'
                )}
              >
                <div className="h-9 w-9 shrink-0 rounded-lg bg-muted/60 flex items-center justify-center">
                  <Icon className={cn('h-4.5 w-4.5', color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{file.parentPath}</p>
                  {file.reason && <p className="text-[10px] text-muted-foreground/70 italic truncate mt-0.5">{file.reason}</p>}
                </div>
                <span className={cn('text-[9px] font-bold rounded-full px-2 py-0.5 shrink-0',
                  pct >= 80 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Preview pane */}
        {selectedFile ? (
          <div className="w-56 shrink-0 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
            {(() => {
              const { Icon, color } = getFileIcon(selectedFile.contentType)
              const pct = Math.round(selectedFile.semanticScore * 100)
              return (
                <>
                  <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                    <Icon className={cn('h-5 w-5', color)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-snug">{selectedFile.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{selectedFile.parentPath}</p>
                  </div>
                  {selectedFile.reason && (
                    <div className="border-l-2 border-primary pl-3 py-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Why this matched</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{selectedFile.reason}</p>
                    </div>
                  )}
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{selectedFile.contentType}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Match</span><span className={pct >= 80 ? 'text-primary font-bold' : 'text-foreground'}>{pct}%</span></div>
                  </div>
                  <div className="flex flex-col gap-2 mt-auto">
                    <Link href={`/dashboard/files?highlight=${selectedFile.id}`}
                      className="btn-primary-gradient flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary-foreground">
                      Open file
                    </Link>
                    {canEdit && (
                      <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Share link
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <div className="w-56 shrink-0 flex items-center justify-center text-xs text-muted-foreground/40 p-4 text-center">
            Select a result to see details
          </div>
        )}
      </div>

      {/* Keyboard hint bar */}
      <div className="flex items-center gap-4 px-6 py-2 border-t border-border text-[10px] text-muted-foreground/50 shrink-0">
        {[['↑↓', 'select'], ['↵', 'open'], ['Esc', 'clear']].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <kbd className="border border-border rounded px-1 py-0.5 bg-background text-[9px]">{key}</kbd> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function FilterSection({ title, items, selected, onChange }: {
  title: string
  items: { label: string; display?: string; count?: number }[]
  selected: string[]; onChange: (v: string[]) => void
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map(item => {
          const checked = selected.includes(item.label)
          return (
            <label key={item.label} className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => onChange(checked ? selected.filter(s => s !== item.label) : [...selected, item.label])}
                className={cn('h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center cursor-pointer',
                  checked ? 'bg-primary border-primary' : 'border-border')}
              >
                {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
              <span className="text-[11px] text-muted-foreground flex-1">{item.display ?? item.label}</span>
              {item.count !== undefined && <span className="text-[9px] text-muted-foreground/50">{item.count}</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "search/page" | head -10
```

- [ ] **Step 3: Test the page**

Navigate to `/dashboard/search?q=demo`. Verify results load, filters work, preview pane shows on click, keyboard ↑↓ moves selection.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/search/page.tsx
git commit -m "feat: AI search full results page with three-panel layout, filters, and preview pane"
```

---

## Task 8: Settings → AI & Indexing tab

**Files:**
- Create: `components/dashboard/ai-credentials-tab.tsx`
- Modify: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create the AI credentials tab component**

Create `components/dashboard/ai-credentials-tab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { KeyRound, Check, AlertCircle, RotateCw, Wand2 } from 'lucide-react'

interface CredStatus { configured: boolean; lastFour: string | null }
interface CredState { openai: CredStatus; anthropic: CredStatus; note?: string }
interface TestResult { ok: boolean; latencyMs: number; error?: string }
interface TestState { openai: TestResult | null; anthropic: TestResult | null }

export function AiCredentialsTab() {
  const [state, setState] = useState<CredState | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestState | null>(null)

  const load = () => {
    fetch('/api/admin/ai-credentials')
      .then(r => r.json())
      .then(setState)
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/ai-credentials/test', { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
      load() // refresh configured status
    } catch {}
    setTesting(false)
  }

  if (!state) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>

  const bothConfigured = state.openai.configured && state.anthropic.configured

  if (!bothConfigured) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">AI features not configured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Set <code className="bg-muted rounded px-1">OPENAI_API_KEY</code> and{' '}
            <code className="bg-muted rounded px-1">ANTHROPIC_API_KEY</code> in your environment to enable semantic search, smart indexing, and AI-powered file discovery.
          </p>
        </div>
        <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground max-w-xs">
          {state.note}
        </div>
        <button type="button" onClick={runTest} disabled={testing}
          className="btn-primary-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Wand2 className="h-4 w-4" />
          {testing ? 'Testing...' : 'Test connection'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">AI &amp; Indexing</h3>
          <p className="text-xs text-muted-foreground">API credentials for semantic search and file indexing</p>
        </div>
        <button type="button" onClick={runTest} disabled={testing}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <RotateCw className={cn('h-3.5 w-3.5', testing && 'animate-spin')} />
          Test connection
        </button>
      </div>

      {[
        { key: 'openai', label: 'OpenAI', desc: 'Embeddings + Whisper transcription', status: state.openai },
        { key: 'anthropic', label: 'Anthropic', desc: 'Image captioning + AI ranking', status: state.anthropic },
      ].map(({ key, label, desc, status: s }) => {
        const result = testResult?.[key as keyof TestState]
        return (
          <div key={key} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
            <div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
              {s.lastFour && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">••••{s.lastFour}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {result ? (
                result.ok
                  ? <span className="flex items-center gap-1 text-[9px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5"><Check className="h-2.5 w-2.5" /> {result.latencyMs}ms</span>
                  : <span className="flex items-center gap-1 text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5"><AlertCircle className="h-2.5 w-2.5" /> {result.error}</span>
              ) : (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add AI & Indexing tab to settings page**

In `app/dashboard/settings/page.tsx`, find the tab/section rendering logic and add a new tab. The settings page already has a tab structure — find where other tabs are defined and add:

```tsx
// Add to tab definitions (look for existing tabs array or tab render logic):
{ id: 'ai', label: 'AI & Indexing', icon: Sparkles, adminOnly: true }

// Add to tab content rendering:
{activeTab === 'ai' && isAdmin && <AiCredentialsTab />}
```

Import `AiCredentialsTab` from `@/components/dashboard/ai-credentials-tab` and `Sparkles` from lucide-react.

Also handle the `?tab=ai` query param to auto-activate the tab:
```tsx
const searchParams = useSearchParams()
useEffect(() => {
  const tab = searchParams.get('tab')
  if (tab) setActiveTab(tab)
}, [searchParams])
```

- [ ] **Step 3: Test**

Navigate to `/dashboard/settings?tab=ai`. The AI & Indexing tab should be active and show credential status.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ai-credentials-tab.tsx app/dashboard/settings/page.tsx
git commit -m "feat: Settings AI & Indexing tab — credential status and connection test"
```

---

## Task 9: Indexing Pipeline Dashboard page

**Files:**
- Create: `app/dashboard/admin/indexing/page.tsx`

- [ ] **Step 1: Check admin layout for auth guard**

```bash
cat /Users/mayur/Personal/projects/s3-portal/app/dashboard/admin/layout.tsx
```

Verify it enforces `isAdmin`. If not, add a redirect guard for non-admin users.

- [ ] **Step 2: Create the indexing dashboard page**

Create `app/dashboard/admin/indexing/page.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Cpu, PauseCircle, PlayCircle, RotateCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRBAC } from '@/components/rbac-provider'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type IndexStatus = 'FAILED' | 'PROCESSING' | 'DONE' | 'PENDING'

interface FileRow {
  id: string; fileId: string; status: IndexStatus
  errorMessage: string | null; updatedAt: string
  file: { name: string; contentType: string; key: string; bucket: { bucket: string } | null }
  attemptsMade?: number
}

interface Stats { total: number; indexed: number; pending: number; failed: number; unindexed: number; percentComplete: number }

const TABS: { id: IndexStatus | 'ALL'; label: string }[] = [
  { id: 'FAILED', label: 'Failed' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'DONE', label: 'Done' },
  { id: 'ALL', label: 'All' },
]

export default function IndexingDashboardPage() {
  const { isAdmin } = useRBAC()
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<FileRow[]>([])
  const [activeTab, setActiveTab] = useState<IndexStatus | 'ALL'>('FAILED')
  const [workerPaused, setWorkerPaused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retryAllOpen, setRetryAllOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => { if (!isAdmin) router.replace('/dashboard') }, [isAdmin, router])

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/indexing/status').catch(() => null)
    if (res?.ok) { const d = await res.json(); setStats(d) }
    setLastRefresh(new Date())
  }, [])

  const loadRows = useCallback(async () => {
    // The status route returns aggregate stats; for table rows we'd need a list endpoint.
    // For MVP, derive from stats and show a message when no list endpoint exists.
    // TODO: add GET /api/admin/indexing/files?status=FAILED when ready.
  }, [activeTab])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => {
    const interval = setInterval(loadStats, 30_000)
    return () => clearInterval(interval)
  }, [loadStats])

  const handlePauseResume = async () => {
    const endpoint = workerPaused ? '/api/admin/indexing/resume' : '/api/admin/indexing/pause'
    await fetch(endpoint, { method: 'POST' })
    setWorkerPaused(p => !p)
  }

  const handleRetryAll = async () => {
    await fetch('/api/admin/indexing/retry-failed', { method: 'POST' })
    await loadStats()
  }

  const handleRetryOne = async (fileId: string) => {
    await fetch('/api/admin/indexing/retry-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    })
    await loadStats()
  }

  const secAgo = Math.round((Date.now() - lastRefresh.getTime()) / 1000)

  return (
    <div className="flex flex-col h-full glass-card m-4 !p-0 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm text-foreground">Indexing Pipeline</span>
            <span className={cn(
              'flex items-center gap-1.5 text-[9px] font-bold rounded-full px-2 py-0.5 border',
              workerPaused
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : 'bg-green-500/10 border-green-500/20 text-green-500'
            )}>
              <div className={cn('h-1.5 w-1.5 rounded-full', workerPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse')} />
              {workerPaused ? 'Paused' : 'Live'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">AI indexing worker status and queue management</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePauseResume}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {workerPaused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
            {workerPaused ? 'Resume worker' : 'Pause worker'}
          </button>
          <button type="button" onClick={() => setRetryAllOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
            <RotateCw className="h-3.5 w-3.5" />
            Retry all failed
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 px-6 py-4 shrink-0">
          {[
            { label: 'Total Files', value: stats.total, sub: 'across all buckets', color: '' },
            { label: 'Indexed', value: stats.indexed, sub: `${stats.percentComplete}%`, color: 'text-green-500', progress: stats.percentComplete },
            { label: 'Processing', value: stats.pending, sub: 'in queue', color: 'text-primary' },
            { label: 'Failed', value: stats.failed, sub: 'needs attention', color: 'text-destructive' },
          ].map(({ label, value, sub, color, progress }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
              <p className={cn('text-2xl font-black tracking-tight', color || 'text-foreground')}>{value.toLocaleString()}</p>
              {progress !== undefined ? (
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              ) : <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-border px-6 shrink-0">
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-1 py-2.5 mr-5 text-xs font-semibold border-b-2 transition-colors',
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {tab.label}
            {stats && tab.id === 'FAILED' && stats.failed > 0 && ` (${stats.failed})`}
            {stats && tab.id === 'PROCESSING' && stats.pending > 0 && ` (${stats.pending})`}
          </button>
        ))}
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="ml-auto bg-muted/40 border border-border rounded-lg px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
      </div>

      {/* Table placeholder — list endpoint is a future task */}
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50 p-8 text-center">
        <div>
          <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>File list requires <code className="bg-muted rounded px-1">GET /api/admin/indexing/files</code></p>
          <p className="mt-1">Stats above reflect real data. Per-file table is a follow-up task.</p>
        </div>
      </div>

      {/* Keyboard hint + refresh */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-border shrink-0 text-[10px] text-muted-foreground/50">
        <div className="flex gap-3">
          {[['↑↓', 'select'], ['R', 'retry selected'], ['⌘A', 'select all'], ['Esc', 'clear']].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <kbd className="border border-border rounded px-1 py-0.5 bg-background">{k}</kbd> {l}
            </span>
          ))}
        </div>
        <span>Last refreshed: {secAgo < 5 ? 'just now' : `${secAgo}s ago`} · auto-refreshes every 30s</span>
      </div>

      <ConfirmDialog
        open={retryAllOpen}
        onOpenChange={setRetryAllOpen}
        title={`Retry ${stats?.failed ?? 0} failed files?`}
        description="This will re-queue them for AI processing and consume API credits."
        confirmLabel={`Retry ${stats?.failed ?? 0} files`}
        onConfirm={handleRetryAll}
        variant="destructive"
      />
    </div>
  )
}
```

- [ ] **Step 3: Check ConfirmDialog API**

```bash
grep -n "interface\|type\|export" /Users/mayur/Personal/projects/s3-portal/components/ui/confirm-dialog.tsx | head -20
```

Adjust the `ConfirmDialog` props above to match the actual component interface.

- [ ] **Step 4: Test**

Navigate to `/dashboard/admin/indexing`. Verify stat cards load, pause/resume toggle works, Retry All opens confirm dialog.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/admin/indexing/page.tsx
git commit -m "feat: Indexing Pipeline Dashboard — stat cards, pause/resume, retry all with confirm"
```

---

## Task 10: File indexing status badge in Explorer

**Files:**
- Create: `components/dashboard/indexing-badge.tsx`
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 1: Create the badge component**

Create `components/dashboard/indexing-badge.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check, RotateCw, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type IndexStatus = 'DONE' | 'PROCESSING' | 'FAILED' | 'PENDING'

interface IndexingBadgeProps {
  status: IndexStatus | null
  errorMessage?: string | null
  fileId: string
  onRetry?: (fileId: string) => void
}

const CONFIG = {
  DONE:       { Icon: Check,          label: 'Indexed',  cls: 'bg-green-500/10 border-green-500/20 text-green-500' },
  PROCESSING: { Icon: RotateCw,       label: 'Indexing', cls: 'bg-primary/10 border-primary/20 text-primary',      spin: true },
  FAILED:     { Icon: AlertCircle,    label: 'Failed',   cls: 'bg-destructive/10 border-destructive/20 text-destructive' },
  PENDING:    { Icon: Clock,          label: 'Queued',   cls: 'bg-muted border-border text-muted-foreground' },
} as const

export function IndexingBadge({ status, errorMessage, fileId, onRetry }: IndexingBadgeProps) {
  const [retrying, setRetrying] = useState(false)
  const s = status ?? 'PENDING'
  const { Icon, label, cls } = CONFIG[s]
  const spin = s === 'PROCESSING'

  const badge = (
    <div className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold select-none', cls, s === 'FAILED' && 'cursor-pointer')}>
      <Icon className={cn('h-2.5 w-2.5', spin && 'animate-spin')} />
      {label}
    </div>
  )

  if (s !== 'FAILED') return badge

  const handleRetry = async () => {
    if (!onRetry) return
    setRetrying(true)
    await onRetry(fileId)
    setRetrying(false)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent side="left" align="center" className="w-56 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span className="text-xs font-semibold text-foreground">Indexing failed</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          {errorMessage || 'An error occurred during indexing.'}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold py-1.5 hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <RotateCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
          {retrying ? 'Retrying...' : 'Retry indexing'}
        </button>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Add the badge column to the Explorer file list**

In `app/dashboard/files/page.tsx`:

1. Import `IndexingBadge`: `import { IndexingBadge } from '@/components/dashboard/indexing-badge'`
2. Import `useRBAC` if not already imported
3. Add `indexingStatus?: string | null; indexingError?: string | null` to the `StoredFile` interface
4. Find where file rows are rendered (the main table/list). Add the badge column — only for admin:

```tsx
{/* In the table header row, add this column header (admin only): */}
{isAdmin && <th className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-center">AI Index</th>}

{/* In each file row, add this cell: */}
{isAdmin && (
  <td className="text-center">
    <IndexingBadge
      status={(file.indexingStatus as any) ?? null}
      errorMessage={file.indexingError}
      fileId={file.id}
      onRetry={async (id) => {
        await fetch('/api/admin/indexing/retry-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: id }),
        })
      }}
    />
  </td>
)}
```

5. Ensure the files API response includes `indexingStatus` and `indexingError`. Check what the files list endpoint returns:

```bash
grep -n "indexing\|embedding\|FileEmbedding" /Users/mayur/Personal/projects/s3-portal/app/api/files/route.ts | head -20
```

If the response doesn't include indexing status, the badge will always show "Queued" — which is acceptable for MVP. Add a follow-up task to include indexing status in the files list API if needed.

- [ ] **Step 3: Handle SSE updates for badge**

In the existing SSE subscription in `files/page.tsx` (look for the `EventSource` or SSE listener), add a handler for the new event:

```typescript
case 'indexing-status-changed':
  setFiles(prev => prev.map(f =>
    f.key === payload.key
      ? { ...f, indexingStatus: payload.indexingStatus ?? f.indexingStatus }
      : f
  ))
  break
```

- [ ] **Step 4: Test**

Open the Explorer. Admin users should see the AI Index column with badges. Clicking a Failed badge should show the popover with retry button.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/indexing-badge.tsx app/dashboard/files/page.tsx
git commit -m "feat: indexing status badge in Explorer file list (admin only) with retry popover"
```

---

## Task 11: Update keyboard shortcuts modal

**Files:**
- Modify: `components/keyboard-shortcuts-modal.tsx`

- [ ] **Step 1: Add Search Palette section**

In `components/keyboard-shortcuts-modal.tsx`, find the `sections` array and add:

```typescript
{
  heading: 'Search Palette',
  rows: [
    { label: 'Open AI Search', keys: ['⌘K'] },
    { label: 'Navigate results', keys: ['↑', '↓'] },
    { label: 'Open selected', keys: ['↵'] },
    { label: 'Open in new tab', keys: ['⌘↵'] },
    { label: 'Preview selected', keys: ['Space'] },
    { label: 'Close palette', keys: ['Esc'] },
  ],
},
```

Also add to the Admin section (only shown when `isAdmin`):
```typescript
{ label: 'Retry indexing (dashboard)', keys: ['R'] },
```

- [ ] **Step 2: Verify**

Open the keyboard shortcuts modal (?). Verify "Search Palette" section appears.

- [ ] **Step 3: Commit**

```bash
git add components/keyboard-shortcuts-modal.tsx
git commit -m "docs: add Search Palette section to keyboard shortcuts modal"
```

---

## Task 12: Final integration check

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/mayur/Personal/projects/s3-portal && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 2: TypeScript clean build**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Expected: no errors.

- [ ] **Step 3: Full flow walkthrough**

Start dev server: `npm run dev`

Check each flow:
- [ ] ⌘K opens AI palette → type a query → results appear → "See all results" → search page loads
- [ ] Search page: filters work, selecting a row shows preview pane, ↑↓ navigates, Esc clears
- [ ] Sidebar: three groups collapse/expand, state persists on refresh, AI search bar visible
- [ ] Profile 3-dots: popover opens with Account, AI & Indexing, Appearance toggle, Sign out
- [ ] Settings → AI & Indexing tab auto-activates via `?tab=ai`
- [ ] Admin → Indexing Dashboard: stat cards load, pause/resume works, Retry All opens confirm
- [ ] Explorer: AI Index badge column visible for admin, hidden for viewer
- [ ] All themes work: switch between Nebula, Catppuccin, Dracula — all screens adapt

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: UI redesign complete — AI search palette, results page, sidebar groups, credentials tab, indexing dashboard, status badge"
```
