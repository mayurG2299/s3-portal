# S3 Portal — Security, Bugs & UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 21 flagged issues across security, critical bugs, broken features, UX weirdness, and architecture — grouped into four independently shippable phases.

**Architecture:** Issues are fixed in place following existing patterns (Prisma, NextAuth JWT, Next.js App Router server actions, Shadcn/ui). No new frameworks. The only structural change is the `files/route.ts` split in Phase 4, which is purely extractive — logic does not change.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth JWT, AWS S3 SDK v3, Shadcn/ui + Tailwind, Jest/Testing Library.

---

## Phase Overview

| Phase | Focus | Tasks |
|---|---|---|
| **Phase 1** | Security | Tasks 1–6 |
| **Phase 2** | Critical Bugs | Tasks 7–8 |
| **Phase 3** | Feature Completeness & UX | Tasks 9–14 |
| **Phase 4** | Architecture & Performance | Tasks 15–19 |

**Important:** Complete Phase 1 before Phase 4. Tasks 1–8 touch `app/api/files/route.ts` and `app/api/roles/` — Task 19 (the monolith split) must happen after to avoid merge conflicts.

---

## Key conventions used throughout this codebase

- DB client: `prisma` (not `db`) — imported as `import { prisma } from '@/lib/db'`
- `getResolvedUserTeamScope` takes an object: `{ userId, requestedTeamId, cookieTeamId, sessionTeamId }` — never a raw `NextRequest`
- Rate limiting: `allowRequest(key, limit, windowSeconds)` from `@/lib/rate-limiter` — returns `true` if allowed
- `StorageQuota.usedBytes` = quota-accounting (incremented by upload/delete handlers). `file.aggregate._sum.size` = actual S3 file sizes. They are different. Layout uses `file.aggregate` for the display bar — keep it.
- Route context: `async function GET(request: NextRequest, context: RouteContext<{ id: string }>)` with `const { id } = await context.params`

---

## File Map

### Phase 1 — Files Modified
- `app/api/roles/route.ts` — add `canManageTeam` guard to GET handler
- `app/api/roles/[id]/route.ts` — add `canManageTeam` guard to GET; cap computed level at 49
- `middleware.ts` — treat null `roleLevel` as unauthorized on protected routes
- `app/api/files/route.ts` — always verify team membership in `updateTags` and `toggleFavorite`
- `app/api/auth/register/route.ts` — add `allowRequest` rate limit at route entry
- `__tests__/api/roles-auth.test.ts` — new
- `__tests__/api/roles-level.test.ts` — new
- `__tests__/middleware.test.ts` — new

### Phase 2 — Files Modified
- `lib/storage-quota.ts` — change `DEFAULT_LIMIT_BYTES` to 1 TB to match layout
- `app/api/files/route.ts` — fix `parentPath` derivation in S3 auto-sync block
- `__tests__/lib/storage-quota-default.test.ts` — new
- `__tests__/api/files-parentpath.test.ts` — new

### Phase 3 — Files Modified/Created
- `app/dashboard/files/page.tsx` — custom expiry picker, abort wiring, URL nav, share title fix, replace `window.confirm`
- `app/dashboard/teams/page.tsx` — extract delete form to client component
- `components/dashboard/DeleteTeamButton.tsx` — new client component
- `components/ui/confirm-dialog.tsx` — new reusable confirm dialog

### Phase 4 — Files Modified/Created
- `lib/permissions.ts` — remove dead `ScreenPermission` read paths
- `app/dashboard/page.tsx` — add `unstable_cache` with team-scoped cache keys
- `app/api/files/route.ts` → split into:
  - `app/api/files/upload/route.ts` — upload + multipart
  - `app/api/files/folder/route.ts` — createFolder + updateTags
  - `app/api/files/favorites/route.ts` — toggleFavorite + list favorites
  - `app/api/files/recents/route.ts` — recents (lazy, no S3 pre-fetch)
- `app/dashboard/files/page.tsx` — fix double `isRefreshing`; update API call paths

---

# PHASE 1: Security

---

## Task 1: Lock down GET /api/roles — require admin to list roles

**Problem:** `GET /api/roles` returns all roles in the DB to any authenticated user including VIEWERs, leaking role configurations across teams.

**Files:**
- Modify: `app/api/roles/route.ts:9-42`
- Test: `__tests__/api/roles-auth.test.ts` (create)

**Existing imports in `app/api/roles/route.ts`:** `prisma`, `canManageTeam`, `getResolvedUserTeamScope` are already imported. The GET handler currently has no `canManageTeam` check.

**Response shape:** Keep the existing flat array response (`return NextResponse.json(roles)`) — do NOT change to `{ roles }` wrapper. Changing the shape would break all consumers.

- [ ] **Step 1.1 — Write failing test**

Create `__tests__/api/roles-auth.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/permissions', () => ({ canManageTeam: jest.fn() }))
jest.mock('@/lib/team-selection', () => ({ getResolvedUserTeamScope: jest.fn() }))
jest.mock('@/lib/db', () => ({ prisma: { role: { findMany: jest.fn() } } }))
jest.mock('@/lib/audit', () => ({ logUserAction: jest.fn() }))

import { GET } from '@/app/api/roles/route'
import { getServerSession } from 'next-auth'
import { canManageTeam } from '@/lib/permissions'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { prisma } from '@/lib/db'

describe('GET /api/roles auth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 for a user who cannot manage the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(false)

    const req = new NextRequest('http://localhost/api/roles')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 and roles array for an admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.role.findMany as jest.Mock).mockResolvedValue([{ id: 'r1', name: 'ADMIN', level: 50 }])

    const req = new NextRequest('http://localhost/api/roles')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
```

- [ ] **Step 1.2 — Run test to confirm it fails**

```bash
cd /Users/mayur/Personal/projects/s3-portal
npx jest __tests__/api/roles-auth.test.ts --no-coverage
```

Expected: FAIL — GET currently returns 200 for the VIEWER case.

- [ ] **Step 1.3 — Add `canManageTeam` guard to GET handler in `app/api/roles/route.ts`**

The current GET handler (lines 9–42) authenticates but does not check team management rights. After the session check and before the `prisma.role.findMany` call, insert:

```typescript
const { teamId } = await getResolvedUserTeamScope({
  userId: session.user.id,
  requestedTeamId: request.nextUrl.searchParams.get('teamId')?.trim() ?? undefined,
  cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
  sessionTeamId: session.user.teamId,
})

if (!teamId) {
  return NextResponse.json({ error: 'No active team' }, { status: 400 })
}

const allowed = await canManageTeam(session.user.id, teamId)
if (!allowed) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

Keep the existing `prisma.role.findMany` call and response shape unchanged.

- [ ] **Step 1.4 — Run test**

```bash
npx jest __tests__/api/roles-auth.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 1.5 — Commit**

```bash
git add app/api/roles/route.ts __tests__/api/roles-auth.test.ts
git commit -m "fix: require canManageTeam on GET /api/roles to prevent role enumeration by non-admins"
```

---

## Task 2: Lock down GET /api/roles/[id] — require admin

**Problem:** Any authenticated user can call `GET /api/roles/[id]` for any role ID with no team or admin check.

**Files:**
- Modify: `app/api/roles/[id]/route.ts:32-61`
- Test: `__tests__/api/roles-auth.test.ts` (extend)

**Existing imports:** `prisma`, `canManageTeam`, `getResolvedUserTeamScope` are already imported. Route signature: `GET(request: NextRequest, context: RouteContext<{ id: string }>)`.

- [ ] **Step 2.1 — Add test case to `__tests__/api/roles-auth.test.ts`**

```typescript
// Add this import at top (after existing imports):
// import { GET as getById } from '@/app/api/roles/[id]/route'
// Note: Jest module mocks are already set up from Task 1 test file

describe('GET /api/roles/[id] auth', () => {
  it('returns 403 for non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(canManageTeam as jest.Mock).mockResolvedValue(false)

    const { GET: getById } = await import('@/app/api/roles/[id]/route')
    const req = new NextRequest('http://localhost/api/roles/r1')
    const res = await getById(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2.2 — Run test to confirm it fails**

```bash
npx jest __tests__/api/roles-auth.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 2.3 — Add guard to GET handler in `app/api/roles/[id]/route.ts`**

After the session check (around line 36) and before the `prisma.role.findUnique` call, insert:

```typescript
const { teamId } = await getResolvedUserTeamScope({
  userId: session.user.id,
  requestedTeamId: request.nextUrl.searchParams.get('teamId')?.trim() ?? undefined,
  cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
  sessionTeamId: session.user.teamId,
})

const allowed = await canManageTeam(session.user.id, teamId ?? '')
if (!allowed) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

- [ ] **Step 2.4 — Run test**

```bash
npx jest __tests__/api/roles-auth.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 2.5 — Commit**

```bash
git add "app/api/roles/[id]/route.ts" __tests__/api/roles-auth.test.ts
git commit -m "fix: require canManageTeam on GET /api/roles/[id]"
```

---

## Task 3: Cap custom role level at 49 to prevent privilege escalation

**Problem:** `getRoleLevel` computes `20 + editCount * 3` capped at 80. With enough EDIT permissions a custom role reaches level 80 — above ADMIN (50). This lets a custom role effectively outrank ADMIN.

**Files:**
- Modify: `app/api/roles/[id]/route.ts` — `getRoleLevel` function (~line 23)
- Modify: `app/api/roles/route.ts` — POST level validation
- Test: `__tests__/api/roles-level.test.ts` (create)

- [ ] **Step 3.1 — Write a test against the current broken behaviour**

Create `__tests__/api/roles-level.test.ts`:

```typescript
// Replicate the current formula to confirm the bug, then test the fix.

describe('custom role level cap', () => {
  function brokenGetRoleLevel(editCount: number): number {
    return Math.max(20, Math.min(80, 20 + editCount * 3))
  }

  it('CONFIRMS BUG: current formula allows level > 49 (above ADMIN)', () => {
    // 20 EDIT permissions → level 80. This should NOT be >= 50.
    expect(brokenGetRoleLevel(20)).toBeGreaterThanOrEqual(50) // bug: 80 >= 50
  })
})
```

- [ ] **Step 3.2 — Run to confirm the bug is real**

```bash
npx jest __tests__/api/roles-level.test.ts --no-coverage
```

Expected: PASS (confirms the bug exists — 80 ≥ 50).

- [ ] **Step 3.3 — Fix `getRoleLevel` in `app/api/roles/[id]/route.ts`**

Find the function (around line 23). Change:

```typescript
// Before
return Math.max(20, Math.min(80, 20 + editCount * 3))

// After — cap at 49, one below ADMIN (50)
return Math.max(20, Math.min(49, 20 + editCount * 3))
```

Also fix the level validation in `app/api/roles/route.ts` POST handler. Find the check (`level < 10 || level > 90`) and tighten:

```typescript
// Before
if (level < 10 || level > 90) { ... }

// After
if (level < 10 || level > 49) {
  return NextResponse.json(
    { error: 'Custom role level must be between 10 and 49' },
    { status: 400 }
  )
}
```

- [ ] **Step 3.4 — Update test to assert the fix**

Replace the test body:

```typescript
function fixedGetRoleLevel(editCount: number): number {
  return Math.max(20, Math.min(49, 20 + editCount * 3))
}

it('fixed formula never exceeds 49 (below ADMIN=50)', () => {
  expect(fixedGetRoleLevel(0)).toBe(20)
  expect(fixedGetRoleLevel(5)).toBe(35)
  expect(fixedGetRoleLevel(10)).toBe(49) // hits the cap
  expect(fixedGetRoleLevel(20)).toBe(49) // still 49, not 80
  expect(fixedGetRoleLevel(20)).toBeLessThan(50)
})
```

- [ ] **Step 3.5 — Run test**

```bash
npx jest __tests__/api/roles-level.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3.6 — Commit**

```bash
git add "app/api/roles/[id]/route.ts" app/api/roles/route.ts __tests__/api/roles-level.test.ts
git commit -m "fix: cap custom role level at 49 to prevent privilege escalation above ADMIN"
```

---

## Task 4: Fix middleware — stale JWT (null roleLevel) must not bypass admin routes

**Problem:** `middleware.ts` currently passes requests through when `roleLevel` is null, with the comment "page-level auth will re-hydrate and decide." But `requireUser()` only checks session existence, not role level. A user with a stale token can access `/dashboard/admin/` routes freely.

**Files:**
- Modify: `middleware.ts:62-86`
- Test: `__tests__/middleware.test.ts` (create)

**Current logic (lines 62–86):**
```typescript
const roleLevel = token.roleLevel != null ? (token.roleLevel as number) : null;
for (const route of PROTECTED_ROUTES) {
  if (route.pattern.test(pathname)) {
    if (route.requiredLevel && roleLevel !== null && roleLevel < route.requiredLevel) {
      // redirect to /dashboard
    }
    // If roleLevel is null (stale token), allow through — page-level auth handles it
    break;
  }
}
```

The `roleLevel !== null` condition is the bug. Null means "we don't know the role" — that must be treated as unauthorized, not as pass-through.

- [ ] **Step 4.1 — Write failing test**

Create `__tests__/middleware.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }))

import { getToken } from 'next-auth/jwt'

// Import middleware — adjust path if it's at root or src/
const { middleware } = await import('@/middleware')

describe('middleware stale token handling', () => {
  it('redirects to /dashboard when roleLevel is null on an admin-only route', async () => {
    ;(getToken as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      roleLevel: null,
      teamId: 't1',
    })
    const req = new NextRequest('http://localhost/dashboard/admin/audit')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('allows through when roleLevel meets requirement', async () => {
    ;(getToken as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      roleLevel: 100,
      teamId: 't1',
    })
    const req = new NextRequest('http://localhost/dashboard/admin/audit')
    const res = await middleware(req)
    expect(res.status).not.toBe(307)
  })
})
```

- [ ] **Step 4.2 — Run test to confirm it fails**

```bash
npx jest __tests__/middleware.test.ts --no-coverage
```

Expected: FAIL — null roleLevel currently passes through.

- [ ] **Step 4.3 — Fix the null check in `middleware.ts`**

In the route enforcement loop (around lines 70–83), change the condition so null is treated as level 0:

```typescript
// Before
if (route.requiredLevel && roleLevel !== null && roleLevel < route.requiredLevel) {

// After — null means unknown role, treated as 0 (no access)
const effectiveLevel = roleLevel ?? 0
if (route.requiredLevel && effectiveLevel < route.requiredLevel) {
```

Also update the comment directly above the `break` statement:

```typescript
// Before
// If roleLevel is null (stale token), allow through — page-level auth handles it

// After
// roleLevel null (stale JWT) is treated as level 0 — no access to protected routes.
// Page-level requireUser() will redirect to login if the session is fully expired.
```

- [ ] **Step 4.4 — Run test**

```bash
npx jest __tests__/middleware.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 4.5 — Commit**

```bash
git add middleware.ts __tests__/middleware.test.ts
git commit -m "fix: treat null roleLevel as level 0 in middleware — stale JWTs cannot access protected admin routes"
```

---

## Task 5: Fix file ownership bypass — removed members must not edit team files

**Problem:** `updateTags` and `toggleFavorite` in `app/api/files/route.ts` skip team membership verification when `file.userId === session.user.id`. A user who has been removed from a team retains metadata edit rights on any file they originally created.

**Decision:** Replace the per-file-owner shortcut with `canAccessTeam` (any current team member). This means any team member (including VIEWERs) can toggle favorites and update tags on any team file. This is intentional — favorites are personal, tags are collaborative. If owner-only semantics were intended for `updateTags`, a follow-up task should add a separate `canManageTeam` check for that action specifically.

**Files:**
- Modify: `app/api/files/route.ts` — two blocks in `updateTags` and `toggleFavorite`
- Test: `__tests__/api/files-ownership.test.ts` (create)

- [ ] **Step 5.1 — Write failing tests**

Create `__tests__/api/files-ownership.test.ts`. Model it on existing test patterns in `__tests__/api/`. The key mocks needed: `getServerSession`, `prisma.file.findUnique`, `canAccessTeam`.

```typescript
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    file: { findUnique: jest.fn(), update: jest.fn() },
    fileFavorite: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  }
}))
jest.mock('@/lib/permissions', () => ({ canAccessTeam: jest.fn() }))
jest.mock('@/lib/team-selection', () => ({ getResolvedUserTeamScope: jest.fn() }))
jest.mock('@/lib/audit', () => ({ logUserAction: jest.fn() }))

import { POST } from '@/app/api/files/route'
import { getServerSession } from 'next-auth'
import { canAccessTeam } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { NextRequest } from 'next/server'

describe('updateTags ownership bypass', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 403 when file.userId matches session but user is no longer in the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    // File owned by the same user
    ;(prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1', userId: 'u1', teamId: 't1', key: 'test.txt'
    })
    // But user is NOT in the team anymore
    ;(canAccessTeam as jest.Mock).mockResolvedValue(false)

    const req = new NextRequest('http://localhost/api/files', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateTags', fileId: 'f1', tags: ['a'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('allows updateTags when user is a current team member', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', teamId: 't1' } })
    ;(getResolvedUserTeamScope as jest.Mock).mockResolvedValue({ teamId: 't1', teams: [] })
    ;(prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1', userId: 'u2', teamId: 't1', key: 'test.txt' // different owner
    })
    ;(canAccessTeam as jest.Mock).mockResolvedValue(true)
    ;(prisma.file.update as jest.Mock).mockResolvedValue({ id: 'f1' })

    const req = new NextRequest('http://localhost/api/files', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateTags', fileId: 'f1', tags: ['a'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 5.2 — Run to confirm it fails**

```bash
npx jest __tests__/api/files-ownership.test.ts --no-coverage
```

Expected: FAIL — first case returns 200 (shortcut allows through).

- [ ] **Step 5.3 — Find and fix both ownership shortcuts in `app/api/files/route.ts`**

Search for the pattern (two occurrences):

```bash
grep -n "file.userId !== session.user.id" /Users/mayur/Personal/projects/s3-portal/app/api/files/route.ts
```

For each occurrence, replace:

```typescript
// Before — skips team check for file owners
if (file.userId !== session.user.id) {
  const membership = await canAccessTeam(session.user.id, file.teamId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// After — always verify current team membership
const membership = await canAccessTeam(session.user.id, file.teamId)
if (!membership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

- [ ] **Step 5.4 — Run tests**

```bash
npx jest __tests__/api/files-ownership.test.ts --no-coverage
npx jest --no-coverage --passWithNoTests
```

Expected: all pass

- [ ] **Step 5.5 — Commit**

```bash
git add app/api/files/route.ts __tests__/api/files-ownership.test.ts
git commit -m "fix: always verify team membership for file metadata ops — ownership no longer bypasses team check"
```

---

## Task 6: Rate limit the registration endpoint

**Problem:** `POST /api/auth/register` is open to all with no rate limit — anyone can spam-create accounts.

**Rate limiter API:** `allowRequest(key, limit, windowSeconds): Promise<boolean>` — returns `true` if request is allowed, `false` if over limit.

**Files:**
- Modify: `app/api/auth/register/route.ts` — top of POST handler

- [ ] **Step 6.1 — Add rate limit at entry of POST handler**

In `app/api/auth/register/route.ts`, add the import:

```typescript
import { allowRequest } from '@/lib/rate-limiter'
```

Then at the very top of the `POST` function body, before any DB operations:

```typescript
const ip =
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  req.headers.get('x-real-ip') ??
  '127.0.0.1'

const allowed = await allowRequest(`register:${ip}`, 5, 3600) // 5 per IP per hour
if (!allowed) {
  return NextResponse.json(
    { error: 'Too many registration attempts. Please try again later.' },
    { status: 429 }
  )
}
```

- [ ] **Step 6.2 — Run existing register tests**

```bash
npx jest __tests__/api/register-route.test.ts --no-coverage
```

Expected: existing tests still pass (they mock the rate limiter path or don't hit it).

- [ ] **Step 6.3 — Commit**

```bash
git add app/api/auth/register/route.ts
git commit -m "fix: rate limit registration to 5 attempts per IP per hour"
```

---

# PHASE 2: Critical Bugs

---

## Task 7: Align quota default to 1 TB in `storage-quota.ts`

**Problem:** `lib/storage-quota.ts` defaults to 100 GB; `app/dashboard/layout.tsx` hardcodes 1 TB. The server blocks uploads after 100 GB while the UI shows 1 TB available. Layout also has its own `file.aggregate` query for display — this stays unchanged (it measures actual file sizes; `StorageQuota.usedBytes` is separate quota accounting).

**Files:**
- Modify: `lib/storage-quota.ts:3`
- Test: `__tests__/lib/storage-quota-default.test.ts` (create)

- [ ] **Step 7.1 — Write failing test**

Create `__tests__/lib/storage-quota-default.test.ts`:

```typescript
jest.mock('@/lib/db', () => ({
  prisma: { storageQuota: { findUnique: jest.fn() } }
}))

import { getQuotaForTeam } from '@/lib/storage-quota'
import { prisma } from '@/lib/db'

describe('getQuotaForTeam default limit', () => {
  it('returns 1 TB as default when no StorageQuota row exists', async () => {
    ;(prisma.storageQuota.findUnique as jest.Mock).mockResolvedValue(null)
    const quota = await getQuotaForTeam('team-1')
    const ONE_TB = BigInt(1099511627776)
    expect(quota.limitBytes).toBe(ONE_TB)
  })
})
```

- [ ] **Step 7.2 — Run to confirm it fails**

```bash
npx jest __tests__/lib/storage-quota-default.test.ts --no-coverage
```

Expected: FAIL — currently returns 100 GB default (107374182400n).

- [ ] **Step 7.3 — Fix `lib/storage-quota.ts` line 3**

```typescript
// Before
const DEFAULT_LIMIT_BYTES = BigInt(107374182400) // 100 GB

// After
const DEFAULT_LIMIT_BYTES = BigInt(1099511627776) // 1 TB — matches layout.tsx default
```

- [ ] **Step 7.4 — Run test**

```bash
npx jest __tests__/lib/storage-quota-default.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 7.5 — Commit**

```bash
git add lib/storage-quota.ts __tests__/lib/storage-quota-default.test.ts
git commit -m "fix: align DEFAULT_LIMIT_BYTES in storage-quota.ts to 1 TB matching layout.tsx"
```

---

## Task 8: Fix wrong `parentPath` written during S3 auto-sync

**Problem:** When S3 objects are auto-created in the DB during listing, `parentPath` is set to the current browsing path, not the file's actual parent path derived from its S3 key. A file at `a/b/c.txt` browsed from `/a/` gets `parentPath: '/a/'` instead of `/a/b/`. This corrupts Favorites and Recents which filter by `parentPath`.

**Files:**
- Modify: `app/api/files/route.ts` — `createMany` block in the list action (~lines 888–910)
- Test: `__tests__/api/files-parentpath.test.ts` (create)

- [ ] **Step 8.1 — Write a test that confirms the current broken behaviour**

Create `__tests__/api/files-parentpath.test.ts`:

```typescript
// Test the parentPath derivation logic in isolation.
// Current (broken) behaviour: uses the browse path, not the key.
// Correct behaviour: derives from the S3 key.

function brokenDeriveParentPath(s3Key: string, browsePath: string): string {
  return browsePath // current implementation just uses the passed-in path
}

function correctDeriveParentPath(s3Key: string): string {
  const parts = s3Key.split('/')
  if (parts.length <= 1) return '/'
  return '/' + parts.slice(0, -1).join('/') + '/'
}

describe('S3 auto-sync parentPath derivation', () => {
  describe('broken implementation', () => {
    it('incorrectly assigns browse path as parentPath', () => {
      // browsing /a/, file is at a/b/c.txt → wrong: /a/
      expect(brokenDeriveParentPath('a/b/c.txt', '/a/')).toBe('/a/')
      // should be /a/b/ but isn't
      expect(brokenDeriveParentPath('a/b/c.txt', '/a/')).not.toBe('/a/b/')
    })
  })

  describe('correct implementation', () => {
    it('derives parentPath from S3 key for nested file', () => {
      expect(correctDeriveParentPath('marketing/images/logo.png')).toBe('/marketing/images/')
    })
    it('returns root for top-level file', () => {
      expect(correctDeriveParentPath('logo.png')).toBe('/')
    })
    it('handles one-level nesting', () => {
      expect(correctDeriveParentPath('docs/brief.pdf')).toBe('/docs/')
    })
  })
})
```

- [ ] **Step 8.2 — Run to confirm both sets pass (they test different functions)**

```bash
npx jest __tests__/api/files-parentpath.test.ts --no-coverage
```

Expected: all 4 assertions pass — confirms the bug exists and the correct logic works.

- [ ] **Step 8.3 — Apply the fix in `app/api/files/route.ts`**

Find the S3 auto-sync `createMany` block (the one using `skipDuplicates: true` for missing S3 objects, around lines 888–910). Find the line that sets `parentPath` and change it:

```typescript
// Before — uses browsing path
parentPath: ensuredPath,

// After — derive actual parent from the object's S3 key
// (variable name may be obj.Key, item.key, record.key — match the existing code shape)
parentPath: (() => {
  const keyParts = objectKey.split('/')  // replace objectKey with the actual variable name
  if (keyParts.length <= 1) return '/'
  return '/' + keyParts.slice(0, -1).join('/') + '/'
})(),
```

Run `grep -n "parentPath.*ensuredPath\|parentPath.*currentPath" app/api/files/route.ts` to find the exact line.

- [ ] **Step 8.4 — Run all tests**

```bash
npx jest --no-coverage --passWithNoTests
```

Expected: all pass

- [ ] **Step 8.5 — Commit**

```bash
git add app/api/files/route.ts __tests__/api/files-parentpath.test.ts
git commit -m "fix: derive parentPath from S3 object key in auto-sync, not from current browse path"
```

---

# PHASE 3: Feature Completeness & UX

---

## Task 9: Add custom expiry date picker to the share dialog

**Problem:** `expiryMode: 'custom'` and `customExpiry` state exist; `resolveExpirySeconds` handles the custom branch; but no date picker UI is rendered. Users hit an error with no way to comply.

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 9.1 — Find the preset buttons and the `resolveExpirySeconds` function**

```bash
grep -n "expiryMode\|customExpiry\|resolveExpiry\|preset" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx | head -20
```

- [ ] **Step 9.2 — Add a "Custom" button to the preset row**

In the section rendering the 4 preset buttons (1h, 1d, 1w, 30d), add a fifth:

```tsx
<Button
  variant={expiryMode === 'custom' ? 'default' : 'outline'}
  size="sm"
  onClick={() => setExpiryMode('custom')}
>
  Custom
</Button>
```

- [ ] **Step 9.3 — Render a datetime input below the presets when custom is selected**

```tsx
{expiryMode === 'custom' && (
  <div className="mt-2">
    <label className="text-xs text-muted-foreground mb-1 block">
      Pick expiry date and time
    </label>
    <input
      type="datetime-local"
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
      value={customExpiry}
      onChange={(e) => setCustomExpiry(e.target.value)}
    />
  </div>
)}
```

- [ ] **Step 9.4 — Fix `resolveExpirySeconds` for the custom branch**

Find `resolveExpirySeconds` in the file. The `'custom'` case should be:

```typescript
case 'custom': {
  if (!customExpiry) return null
  const expiryDate = new Date(customExpiry)
  if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) return null
  return Math.floor((expiryDate.getTime() - Date.now()) / 1000)
}
```

Make sure the share handler that calls `resolveExpirySeconds` shows a clear error when it returns null:

```typescript
const expirySeconds = resolveExpirySeconds()
if (expirySeconds === null) {
  toast.error(
    expiryMode === 'custom'
      ? 'Please pick a future date and time for the custom expiry.'
      : 'Please choose an expiry preset.'
  )
  return
}
```

- [ ] **Step 9.5 — Manual test**
1. `npm run dev` — open Files, select a file, open Share dialog
2. Click "Custom" — confirm datetime input appears
3. Pick a future time — confirm share link is created successfully
4. Click "Custom" but leave date empty, submit — confirm the specific error message

- [ ] **Step 9.6 — Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: add working custom expiry date picker to share dialog"
```

---

## Task 10: Wire real AbortController to upload cancellation

**Problem:** `handleAbort` is a stub that only `console.log`s. In-flight uploads cannot be cancelled.

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 10.1 — Check current upload abort setup**

```bash
grep -n "AbortController\|uploadAbortControllers\|handleAbort\|progressKey" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx | head -15
```

- [ ] **Step 10.2 — Ensure `uploadAbortControllers` is a `useRef<Map>`**

Find the declaration. If it is a `let` or `useState`, change it to:

```typescript
const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map())
```

A `useRef` persists across renders without causing re-renders.

- [ ] **Step 10.3 — Create and store `AbortController` per upload in `handleUpload`**

At the start of each file's upload block inside `handleUpload`:

```typescript
const progressKey = `${file.name}-${fileIndex}`
const controller = new AbortController()
uploadAbortControllers.current.set(progressKey, controller)

try {
  // pass signal to every fetch call:
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    signal: controller.signal,
    // ...other headers
  })
  // for multipart: pass signal to each part fetch too
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    return // cancelled — no error toast
  }
  throw err
} finally {
  uploadAbortControllers.current.delete(progressKey)
}
```

- [ ] **Step 10.4 — Implement real `handleAbort`**

Replace the stub:

```typescript
const handleAbort = useCallback((file: File, fileIndex: number) => {
  const progressKey = `${file.name}-${fileIndex}`
  const controller = uploadAbortControllers.current.get(progressKey)
  if (controller) {
    controller.abort()
    uploadAbortControllers.current.delete(progressKey)
  }
  setUploadProgress(prev => {
    const next = { ...prev }
    delete next[progressKey]
    return next
  })
}, [])
```

- [ ] **Step 10.5 — Manual test**
1. Upload a large file (>10 MB to trigger multipart)
2. Click cancel before it finishes — upload stops, no error toast
3. Confirm file is absent from the file list after cancellation

- [ ] **Step 10.6 — Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: wire AbortController to file uploads for real in-flight cancellation"
```

---

## Task 11: Sync folder navigation to `?path=` URL param

**Problem:** `navigateToFolder` only updates React state. Browser back/forward breaks, refreshing loses folder position, deep links are impossible.

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 11.1 — Check current path state init and `navigateToFolder`**

```bash
grep -n "currentPath\|navigateToFolder\|useSearchParams\|useRouter" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx | head -15
```

- [ ] **Step 11.2 — Import navigation hooks (if not already present)**

```typescript
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
```

Add inside the component:

```typescript
const router = useRouter()
const pathname = usePathname()
const searchParams = useSearchParams()
```

- [ ] **Step 11.3 — Initialise `currentPath` from the URL**

Change `useState('/')` to:

```typescript
const [currentPath, setCurrentPath] = useState(() => searchParams.get('path') ?? '/')
```

- [ ] **Step 11.4 — Update `navigateToFolder` to push URL**

```typescript
const navigateToFolder = useCallback((path: string) => {
  setCurrentPath(path)
  const params = new URLSearchParams(searchParams.toString())
  if (path === '/') {
    params.delete('path')
  } else {
    params.set('path', path)
  }
  router.push(`${pathname}?${params.toString()}`, { scroll: false })
}, [router, pathname, searchParams])
```

- [ ] **Step 11.5 — Sync state when URL changes (back/forward support)**

```typescript
useEffect(() => {
  const urlPath = searchParams.get('path') ?? '/'
  setCurrentPath(urlPath)
}, [searchParams])
```

- [ ] **Step 11.6 — Manual test**
1. Navigate into a folder — URL shows `?path=/foldername/`
2. Navigate deeper — URL updates
3. Press browser back — returns to previous folder and URL
4. Refresh the page — stays in the same folder

- [ ] **Step 11.7 — Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat: sync folder navigation to ?path= URL param for browser back/forward and deep-link support"
```

---

## Task 12: Show error when team deletion is blocked

**Problem:** `deleteTeamAction` silently returns when preconditions aren't met (members, credentials, files still exist). Users see zero feedback.

**Solution:** Extract the delete form into a client component (`DeleteTeamButton`) that uses `useActionState` to surface error messages.

**Files:**
- Modify: `app/dashboard/teams/page.tsx`
- Create: `components/dashboard/DeleteTeamButton.tsx`

- [ ] **Step 12.1 — Change `deleteTeamAction` to return a typed result**

In `app/dashboard/teams/page.tsx`, change the `deleteTeamAction` signature and return type:

```typescript
async function deleteTeamAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  // ... existing auth/scope checks ...

  const [memberCount, credentialCount, fileCount] = await Promise.all([
    prisma.teamMember.count({ where: { teamId } }),
    prisma.aWSCredential.count({ where: { teamId } }),
    prisma.file.count({ where: { teamId } }),
  ])

  if (memberCount > 1 || credentialCount > 0 || fileCount > 0) {
    const reasons = [
      memberCount > 1 && `${memberCount} active members`,
      credentialCount > 0 && `${credentialCount} credentials`,
      fileCount > 0 && `${fileCount} files`,
    ].filter(Boolean).join(', ')
    return { error: `Cannot delete: team still has ${reasons}. Remove these first.` }
  }

  await prisma.team.delete({ where: { id: teamId } })
  redirect('/dashboard/teams')
}
```

- [ ] **Step 12.2 — Create `components/dashboard/DeleteTeamButton.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'

interface DeleteTeamButtonProps {
  action: (prevState: { error?: string }, formData: FormData) => Promise<{ error?: string }>
}

export function DeleteTeamButton({ action }: DeleteTeamButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction}>
      {state?.error && (
        <p className="text-sm text-destructive mb-2">{state.error}</p>
      )}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? 'Deleting...' : 'Delete Team'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 12.3 — Replace the delete form in `app/dashboard/teams/page.tsx`**

Find the existing delete `<form>` or `<Button>` (around lines 280–310). Replace it with:

```tsx
import { DeleteTeamButton } from '@/components/dashboard/DeleteTeamButton'

// In JSX:
<DeleteTeamButton action={deleteTeamAction} />
```

- [ ] **Step 12.4 — Manual test**
1. Create a team with members
2. Try to delete it — error message appears: "Cannot delete: team still has 2 active members. Remove these first."
3. Remove all members/credentials/files, try again — deletion succeeds, redirect to `/dashboard/teams`

- [ ] **Step 12.5 — Commit**

```bash
git add app/dashboard/teams/page.tsx components/dashboard/DeleteTeamButton.tsx
git commit -m "fix: show error message when team deletion is blocked, extract DeleteTeamButton client component"
```

---

## Task 13: Replace `window.confirm` with a reusable `ConfirmDialog`

**Problem:** File deletion uses `window.confirm` — browser-native, inconsistent, blocked by some browsers, breaks keyboard-only nav when Delete key pops a blocking dialog unexpectedly.

**Files:**
- Create: `components/ui/confirm-dialog.tsx`
- Modify: `app/dashboard/files/page.tsx:600-625`

- [ ] **Step 13.1 — Create `components/ui/confirm-dialog.tsx`**

Verify `AlertDialog` components exist in `components/ui/`:

```bash
ls /Users/mayur/Personal/projects/s3-portal/components/ui/ | grep alert
```

If not, run: `npx shadcn@latest add alert-dialog`

Then create `components/ui/confirm-dialog.tsx`:

```tsx
'use client'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : ''}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 13.2 — Add confirm state to files page**

```typescript
const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; file: FileItem | null }>(
  { open: false, file: null }
)
```

Replace the type `FileItem` with whatever the actual file type is in the codebase (`grep -n "type.*File\|interface.*File" app/dashboard/files/page.tsx | head -5`).

- [ ] **Step 13.3 — Replace `window.confirm` in `handleDelete`**

```typescript
// Before
const handleDelete = async (file: FileItem) => {
  if (!confirm(`Delete ${file.name}?`)) return
  // ...delete API call
}

// After — opens dialog; separate confirm handler does the actual delete
const handleDelete = useCallback((file: FileItem) => {
  setConfirmDelete({ open: true, file })
}, [])

const handleConfirmDelete = useCallback(async () => {
  const file = confirmDelete.file
  if (!file) return
  setConfirmDelete({ open: false, file: null })
  // ...move the existing delete API call logic here
}, [confirmDelete.file])
```

- [ ] **Step 13.4 — Render `ConfirmDialog` in JSX**

```tsx
<ConfirmDialog
  open={confirmDelete.open}
  title="Delete file"
  description={`"${confirmDelete.file?.name}" will be permanently deleted from S3. This cannot be undone.`}
  confirmLabel="Delete"
  cancelLabel="Cancel"
  destructive
  onConfirm={handleConfirmDelete}
  onCancel={() => setConfirmDelete({ open: false, file: null })}
/>
```

- [ ] **Step 13.5 — Update keyboard Delete handler**

Find the keyboard nav handler that triggers deletion (around line 244). It should call `handleDelete(selectedFile)` (opens the dialog), not skip straight to `handleConfirmDelete`.

- [ ] **Step 13.6 — Manual test**
1. Select file → press Delete key → ConfirmDialog appears (not browser popup)
2. Click Cancel → file not deleted
3. Click trash icon → same dialog
4. Confirm → file deleted

- [ ] **Step 13.7 — Commit**

```bash
git add components/ui/confirm-dialog.tsx app/dashboard/files/page.tsx
git commit -m "feat: replace window.confirm with ConfirmDialog for file deletion"
```

---

## Task 14: Fix share dialog title for multi-file selection

**Problem:** `<DialogTitle>Share File</DialogTitle>` is hardcoded singular regardless of how many files are selected.

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 14.1 — Find and fix the title**

```bash
grep -n "Share File\|DialogTitle" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx
```

Change:

```tsx
// Before
<DialogTitle>Share File</DialogTitle>

// After
<DialogTitle>
  {selectedFileIds.size === 1 ? 'Share File' : `Share ${selectedFileIds.size} Files`}
</DialogTitle>
```

- [ ] **Step 14.2 — Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "fix: share dialog title reflects count when sharing multiple files"
```

---

# PHASE 4: Architecture & Performance

---

## Task 15: Remove dead `ScreenPermission` read paths from `lib/permissions.ts`

**Problem:** `grantScreenPermission` / `revokeScreenPermission` write to a legacy table that nothing reads. `getUserScreenPermission` (the main permission check) only reads `RolePermission`. The dead code causes confusion about which system is authoritative.

**Note:** Do NOT drop the `ScreenPermission` table from `schema.prisma` in this task — that requires a separate migration with a rollback plan.

**Files:**
- Modify: `lib/permissions.ts`

- [ ] **Step 15.1 — Audit all call sites of legacy functions**

```bash
grep -rn "grantScreenPermission\|revokeScreenPermission\|setUserScreenPermissions" \
  /Users/mayur/Personal/projects/s3-portal/app/ \
  /Users/mayur/Personal/projects/s3-portal/lib/ \
  --include="*.ts" --include="*.tsx"
```

If there are active callers, note them — they'll need to be removed or redirected before the function can be deleted.

- [ ] **Step 15.2 — Remove or no-op the legacy write functions**

In `lib/permissions.ts`, find `grantScreenPermission`, `revokeScreenPermission`, and `setUserScreenPermissions`. If they have no active callers (confirmed in 15.1), delete them. If they are still called, replace their bodies with:

```typescript
export async function grantScreenPermission(/* ... */): Promise<void> {
  // REMOVED: legacy ScreenPermission system is dead code.
  // Use RolePermission via /api/roles/permissions instead.
}
```

- [ ] **Step 15.3 — Confirm `getUserScreenPermission` reads only `RolePermission`**

```bash
grep -n "ScreenPermission\|screenPermission" /Users/mayur/Personal/projects/s3-portal/lib/permissions.ts
```

If the main read path has a fallback to `ScreenPermission`, remove that fallback branch.

- [ ] **Step 15.4 — Add a clarifying comment at the top of the permissions section**

```typescript
// PERMISSION SYSTEM
// Source of truth: RolePermission (role → screen → level), managed via /api/roles/permissions.
// ScreenPermission (per-member overrides) is legacy — schema retained for safe migration,
// but all code paths that read/write it have been removed.
```

- [ ] **Step 15.5 — Run all tests**

```bash
npx jest --no-coverage --passWithNoTests
```

- [ ] **Step 15.6 — Commit**

```bash
git add lib/permissions.ts
git commit -m "chore: remove dead ScreenPermission read/write paths from permissions.ts"
```

---

## Task 16: Cache dashboard DB queries with `unstable_cache`

**Problem:** Dashboard server component fires ~13 DB queries on every navigation with no caching. Each user hitting the dashboard costs the same full query set.

**Critical:** Cache keys MUST include `teamId`, `credentialId`, and `bucketId` to prevent cross-team data leakage. A shared cache key would serve team A's stats to team B.

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 16.1 — Read the current query structure**

```bash
sed -n '1,180p' /Users/mayur/Personal/projects/s3-portal/app/dashboard/page.tsx
```

- [ ] **Step 16.2 — Wrap the counts + aggregates in `unstable_cache`**

Add import:

```typescript
import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
```

Extract the expensive multi-query block into a cached function. Include ALL scope variables in the cache key:

```typescript
const getDashboardStats = unstable_cache(
  async (teamId: string, credentialId: string, bucketId: string) => {
    // Move the Promise.all of counts and aggregates here
    const [fileCount, linkCount, memberCount, credentialCount, riskLinkCount] =
      await Promise.all([
        prisma.file.count({ where: { teamId, ...(credentialId && { credentialId }), ...(bucketId && { bucketId }) } }),
        prisma.link.count({ where: { file: { teamId } } }),
        prisma.teamMember.count({ where: { teamId } }),
        prisma.aWSCredential.count({ where: { teamId } }),
        prisma.link.count({ where: { file: { teamId }, expiresAt: null, passwordHash: null } }),
      ])
    return { fileCount, linkCount, memberCount, credentialCount, riskLinkCount }
  },
  // Cache key includes all scope variables — prevents cross-team data leakage
  ['dashboard-stats', 'v1'],
  {
    revalidate: 30,
    tags: ['dashboard-stats'],
  }
)
```

Call it: `const stats = await getDashboardStats(teamId, credentialId ?? '', bucketId ?? '')`

- [ ] **Step 16.3 — Add `revalidateTag('dashboard-stats')` in mutation routes**

In each route that changes stats:

```typescript
import { revalidateTag } from 'next/cache'

// After successful mutation:
revalidateTag('dashboard-stats')
```

Add to:
- `app/api/files/route.ts` — after upload complete, after file delete
- `app/api/links/route.ts` — after link create, after link delete
- `app/api/account/members/route.ts` or `app/api/team/members/route.ts` — after member add/remove

- [ ] **Step 16.4 — Build check**

```bash
npm run build
```

Expected: build succeeds, no type errors on BigInt → Number conversions.

- [ ] **Step 16.5 — Commit**

```bash
git add app/dashboard/page.tsx app/api/files/route.ts app/api/links/route.ts
git commit -m "perf: cache dashboard DB queries with 30s revalidation, scoped per team/credential/bucket"
```

---

## Task 17: Remove S3 list call from Recents — validate lazily

**Problem:** Every Recents tab activation fires a full S3 `listObjects` call to validate that DB recents still exist in S3. Expensive for large buckets.

**Files:**
- Modify: `app/api/files/route.ts` — `recents` action handler

- [ ] **Step 17.1 — Find the recents handler**

```bash
grep -n "recents\|'recents'\|\"recents\"" /Users/mayur/Personal/projects/s3-portal/app/api/files/route.ts | head -10
```

- [ ] **Step 17.2 — Replace the implementation**

Remove the S3 `listS3ObjectsWithPrefixes` call entirely. Replace with:

```typescript
// Fetch recent access logs for this user+team
const recentLogs = await prisma.accessLog.findMany({
  where: {
    userId: session.user.id,
    teamId,
    action: 'FILE_ACCESS', // or whatever the actual enum value is — check audit.ts
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
  distinct: ['resourceId'],
  select: { resourceId: true },
})

const fileIds = recentLogs.map(l => l.resourceId).filter((id): id is string => Boolean(id))

const recentFiles = await prisma.file.findMany({
  where: { id: { in: fileIds }, teamId },
})

// Preserve access-log order
const orderedFiles = fileIds
  .map(id => recentFiles.find(f => f.id === id))
  .filter((f): f is NonNullable<typeof f> => Boolean(f))

return NextResponse.json({ files: orderedFiles })
```

Files deleted from S3 but still in the DB will appear briefly in recents — they'll return a handled 404 when accessed, which is acceptable and far cheaper than an S3 list on every tab switch.

- [ ] **Step 17.3 — Run tests**

```bash
npx jest --no-coverage --passWithNoTests
```

- [ ] **Step 17.4 — Commit**

```bash
git add app/api/files/route.ts
git commit -m "perf: remove S3 list call from recents action — handle stale files lazily on access"
```

---

## Task 18: Fix double `isRefreshing` management

**Problem:** Both `handleRefresh` and `fetchFiles` set `isRefreshing`, causing extra render cycles and unclear state ownership.

**Files:**
- Modify: `app/dashboard/files/page.tsx`

- [ ] **Step 18.1 — Find all isRefreshing usages**

```bash
grep -n "isRefreshing\|setIsRefreshing" /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx
```

- [ ] **Step 18.2 — Make `fetchFiles` the sole owner**

Confirm `fetchFiles` already has `setIsRefreshing(true)` at start and `setIsRefreshing(false)` in `finally`. If not, add them.

Then simplify `handleRefresh` to only call `fetchFiles`:

```typescript
const handleRefresh = useCallback(async () => {
  await fetchFiles()
}, [fetchFiles])
```

Remove any `setIsRefreshing` calls from `handleRefresh`.

- [ ] **Step 18.3 — Run tests**

```bash
npx jest --no-coverage --passWithNoTests
```

- [ ] **Step 18.4 — Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "fix: consolidate isRefreshing ownership in fetchFiles, remove duplication in handleRefresh"
```

---

## Task 19: Split `app/api/files/route.ts` monolith

**Problem:** A ~1,700-line file dispatches all file operations via a single POST with an `action` body field. Untestable by route, no per-operation rate limiting, one error handler catches everything.

**Do this task last** — Phase 1–3 changes touch this file and must be committed first to avoid conflicts.

**Strategy: extract, don't rewrite.** Move handler blocks as-is into new files. Logic does not change.

**Files:**
- Create: `app/api/files/upload/route.ts`
- Create: `app/api/files/folder/route.ts`
- Create: `app/api/files/favorites/route.ts`
- Create: `app/api/files/recents/route.ts` (already simplified in Task 17)
- Modify: `app/api/files/route.ts` — keep only `list` action
- Modify: `app/dashboard/files/page.tsx` — update fetch URLs

- [ ] **Step 19.1 — Identify all `action` values in `app/api/files/route.ts`**

```bash
grep -n "action.*==\|case '" /Users/mayur/Personal/projects/s3-portal/app/api/files/route.ts | head -20
```

Group into: list | upload/multipart | folder/tags | favorites/recents

- [ ] **Step 19.2 — Create `app/api/files/upload/route.ts`**

Move `upload`, `multipartInit`, `multipartPresign`, `multipartComplete` action blocks from `files/route.ts`:

```typescript
// app/api/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
// copy all imports needed by these actions from files/route.ts

export async function POST(req: NextRequest) {
  // copy the auth + session check boilerplate
  // dispatch to moved action blocks
  const body = await req.json()
  const { action } = body
  if (action === 'upload') { /* ... moved code ... */ }
  if (action === 'multipartInit') { /* ... */ }
  if (action === 'multipartPresign') { /* ... */ }
  if (action === 'multipartComplete') { /* ... */ }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

- [ ] **Step 19.3 — Create `app/api/files/folder/route.ts`**

Move `createFolder` and `updateTags` action blocks.

- [ ] **Step 19.4 — Create `app/api/files/favorites/route.ts`**

Move `toggleFavorite` and `favorites` action blocks.

- [ ] **Step 19.5 — Update client fetch calls in `app/dashboard/files/page.tsx`**

Find all `fetch('/api/files', ...)` calls with `action:` in the body:

```bash
grep -n "fetch.*api/files\|action.*upload\|action.*multipart\|action.*folder\|action.*favorite" \
  /Users/mayur/Personal/projects/s3-portal/app/dashboard/files/page.tsx | head -20
```

Update each to hit its new route:
- `action: 'upload'` → `fetch('/api/files/upload', ...)`
- `action: 'multipartInit'` → `fetch('/api/files/upload', ...)`
- `action: 'createFolder'` → `fetch('/api/files/folder', ...)`
- `action: 'updateTags'` → `fetch('/api/files/folder', ...)`
- `action: 'toggleFavorite'` → `fetch('/api/files/favorites', ...)`
- `action: 'favorites'` → `fetch('/api/files/favorites', ...)`

- [ ] **Step 19.6 — Run all tests and build**

```bash
npx jest --no-coverage --passWithNoTests
npm run build
```

Expected: all pass, no broken imports.

- [ ] **Step 19.7 — Manual test**
1. Upload a file — success
2. Create a folder — success
3. Toggle favorite — success
4. Load Favorites view — shows correctly

- [ ] **Step 19.8 — Commit**

```bash
git add app/api/files/ app/dashboard/files/page.tsx
git commit -m "refactor: split files/route.ts monolith into upload, folder, favorites, recents sub-routes"
```

---

## Final: Merge Preprod

After all phases complete:

```bash
# Full test suite
npx jest --coverage --passWithNoTests

# Build check
npm run build

# Review what's on preprod vs master
git log master..preprod --oneline

# Merge to master when ready
git checkout master
git merge preprod --no-ff -m "chore: merge preprod — security hardening, bug fixes, and UX improvements"
```
