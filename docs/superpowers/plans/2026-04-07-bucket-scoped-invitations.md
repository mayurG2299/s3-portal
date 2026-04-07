# Bucket-Scoped Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When inviting a team member, admins can select specific S3 buckets (grouped by credential) the invitee will have access to; after acceptance the invitee only sees those buckets across credentials, files, preview, and search.

**Architecture:** A new `TeamMemberBucketAccess` join table stores which buckets each `TeamMember` can see. `TeamInvite` carries the selected bucket IDs through to acceptance. ADMIN/OWNER roles (level >= 50) always bypass the filter — `getAccessibleBucketIds` returns `null` for them. A `lib/bucket-access.ts` module centralises all access-check queries so every API route calls one function. **Empty `inviteBucketIds` for a non-admin role = zero access.** Admins are unrestricted regardless.

**Tech Stack:** Next.js 14 App Router, Prisma ORM (PostgreSQL), React, shadcn/ui, zod validation.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Add `TeamMemberBucketAccess` model; add `inviteBucketIds` to `TeamInvite` |
| Create | `lib/bucket-access.ts` | `getAccessibleBucketIds`, `canAccessBucket`, `grantBucketAccess`, `setBucketAccess` |
| Create | `app/api/team/buckets/route.ts` | `GET /api/team/buckets?teamId=` — credentials+buckets for invite picker |
| Modify | `app/api/team/invites/route.ts` | Accept `bucketIds: string[]` in POST body |
| Modify | `app/api/team/invites/[id]/route.ts` | Create `TeamMemberBucketAccess` rows on accept |
| Modify | `app/api/credentials/route.ts` | Filter buckets in GET response for non-admins |
| Modify | `app/api/files/route.ts` | Extend `getAccessibleBucket()` for bucket-level check |
| Modify | `app/api/files/[fileId]/preview-url/route.ts` | Add `canAccessBucket` check |
| Modify | `app/api/files/[fileId]/preview-content/route.ts` | Add `canAccessBucket` check |
| Modify | `app/api/files/[fileId]/direct-link/route.ts` | Add `canAccessBucket` check |
| Modify | `app/api/files/download/route.ts` | Add `canAccessBucket` check |
| Modify | `app/api/links/route.ts` | Add `canAccessBucket` check to POST (link creation) |
| Modify | `app/api/search/route.ts` | Filter search results to allowed buckets |
| Modify | `components/admin/invite-user-form.tsx` | Add bucket picker step |
| Create | `components/admin/BucketAccessManager.tsx` | Manage bucket access for existing members |
| Modify | `components/admin/user-role-management.tsx` | Render `BucketAccessManager` per member |
| Create | `app/api/team/members/[memberId]/buckets/route.ts` | GET + PUT bucket access for a member |
| Create | `app/api/team/members/restricted/route.ts` | GET members missing a specific bucket |
| Modify | `prisma/seed.js` | Seed `TeamMemberBucketAccess` for existing members |
| Create | `__tests__/lib/bucket-access.test.ts` | Unit tests for access helper |
| Create | `__tests__/api/bucket-scoped-invitations.test.ts` | Integration tests for invite + enforcement |

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit schema**

Make four changes:

**1a. Add to `TeamInvite` model** (after `updatedAt`):
```prisma
inviteBucketIds  String[]  @default([])
```

**1b. Add to `TeamMember` model** (after `screenPermissions`):
```prisma
bucketAccess  TeamMemberBucketAccess[]
```

**1c. Add to `AwsBucket` model** (after `files`):
```prisma
memberAccess  TeamMemberBucketAccess[]
```

**1d. Add new model** (after `TeamMember`):
```prisma
model TeamMemberBucketAccess {
  id           String     @id @default(cuid())
  teamMemberId String
  bucketId     String
  createdAt    DateTime   @default(now())
  teamMember   TeamMember @relation(fields: [teamMemberId], references: [id], onDelete: Cascade)
  bucket       AwsBucket  @relation(fields: [bucketId], references: [id], onDelete: Cascade)

  @@unique([teamMemberId, bucketId])
  @@index([teamMemberId])
  @@index([bucketId])
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
npx prisma migrate dev --name add-bucket-access
```

Expected: Migration applied, Prisma client regenerated with `TeamMemberBucketAccess`.

- [ ] **Step 3: Verify Prisma client compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add TeamMemberBucketAccess model and inviteBucketIds to TeamInvite"
```

---

## Task 2: `lib/bucket-access.ts` — Central access helper

**Files:**
- Create: `lib/bucket-access.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/bucket-access.ts
import { prisma } from '@/lib/db'

/**
 * Returns the list of bucket IDs a user is allowed to access in a team.
 * Returns null if the user is unrestricted (ADMIN/OWNER — role level >= 50).
 * Returns string[] (possibly empty) for restricted members.
 */
export async function getAccessibleBucketIds(
  userId: string,
  teamId: string
): Promise<string[] | null> {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: {
      role: { select: { level: true } },
      bucketAccess: { select: { bucketId: true } },
    },
  })

  if (!member) return []

  // ADMIN (level >= 50) and OWNER (level >= 100) are unrestricted
  if (member.role.level >= 50) return null

  return member.bucketAccess.map((ba) => ba.bucketId)
}

/**
 * Returns true if user can access the specific bucket.
 * Admins/owners always return true (if they're team members).
 */
export async function canAccessBucket(
  userId: string,
  teamId: string,
  bucketId: string
): Promise<boolean> {
  const allowed = await getAccessibleBucketIds(userId, teamId)
  if (allowed === null) return true   // unrestricted admin/owner
  return allowed.includes(bucketId)
}

/**
 * Grants bucket access rows for a team member. Skips duplicates.
 */
export async function grantBucketAccess(
  teamMemberId: string,
  bucketIds: string[]
): Promise<void> {
  if (bucketIds.length === 0) return
  await prisma.teamMemberBucketAccess.createMany({
    data: bucketIds.map((bucketId) => ({ teamMemberId, bucketId })),
    skipDuplicates: true,
  })
}

/**
 * Replaces all bucket access rows for a team member.
 */
export async function setBucketAccess(
  teamMemberId: string,
  bucketIds: string[]
): Promise<void> {
  await prisma.$transaction([
    prisma.teamMemberBucketAccess.deleteMany({ where: { teamMemberId } }),
    ...(bucketIds.length > 0
      ? [prisma.teamMemberBucketAccess.createMany({
          data: bucketIds.map((bucketId) => ({ teamMemberId, bucketId })),
          skipDuplicates: true,
        })]
      : []),
  ])
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep bucket-access
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/bucket-access.ts
git commit -m "feat: add bucket-access helper (getAccessibleBucketIds, canAccessBucket, grantBucketAccess, setBucketAccess)"
```

---

## Task 3: `GET /api/team/buckets`

**Files:**
- Create: `app/api/team/buckets/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/team/buckets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const credentials = await prisma.aWSCredential.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        region: true,
        buckets: {
          select: { id: true, bucket: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ credentials })
  } catch (error) {
    console.error('Fetch team buckets error:', error)
    return NextResponse.json({ error: 'Failed to fetch buckets' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "team/buckets"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/buckets/route.ts
git commit -m "feat: add GET /api/team/buckets for invite bucket picker"
```

---

## Task 4: Update `POST /api/team/invites` to store bucket IDs

**Files:**
- Modify: `app/api/team/invites/route.ts`

- [ ] **Step 1: Destructure `bucketIds` from request body**

Find the line that destructures `teamId`, `email`, `roleId: inputRoleId` from `request.json()` and add `bucketIds`:

```typescript
// Before:
const { teamId, email, roleId: inputRoleId } = await request.json();
// After:
const { teamId, email, roleId: inputRoleId, bucketIds } = await request.json();
```

- [ ] **Step 2: Validate and normalise bucket IDs**

After the `roleId` resolution block (after the block that finds the ADMIN role as fallback), add:

```typescript
const normalizedBucketIds: string[] = Array.isArray(bucketIds) ? bucketIds : []
if (normalizedBucketIds.length > 0) {
  const validCount = await prisma.awsBucket.count({
    where: {
      id: { in: normalizedBucketIds },
      credential: { teamId },
    },
  })
  if (validCount !== normalizedBucketIds.length) {
    return NextResponse.json(
      { error: 'One or more bucket IDs are invalid for this team' },
      { status: 400 }
    )
  }
}
```

- [ ] **Step 3: Add `inviteBucketIds` to the `teamInvite.create` call**

Find the `prisma.teamInvite.create({ data: { ... } })` call. Add the field inside `data`:

```typescript
inviteBucketIds: normalizedBucketIds,
```

- [ ] **Step 4: Update audit metadata**

In the `logUserAction` call after the invite creation, update `metadata`:
```typescript
metadata: { email: normalizedEmail, roleId, bucketIds: normalizedBucketIds },
```

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "invites/route"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/team/invites/route.ts
git commit -m "feat: store inviteBucketIds on TeamInvite when sending invite"
```

---

## Task 5: Update invite accept to create `TeamMemberBucketAccess`

**Files:**
- Modify: `app/api/team/invites/[id]/route.ts`

- [ ] **Step 1: Import the helper**

Add at the top:
```typescript
import { grantBucketAccess } from '@/lib/bucket-access'
```

- [ ] **Step 2: Replace the accept block**

Find the `if (action === 'accept') {` block. Replace the entire block with:

```typescript
if (action === 'accept') {
  const alreadyMember = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, teamId: invite.teamId },
  })

  let teamMemberId: string

  if (!alreadyMember) {
    const newMember = await prisma.teamMember.create({
      data: {
        userId: session.user.id,
        teamId: invite.teamId,
        roleId: invite.roleId,
      },
    })
    teamMemberId = newMember.id
  } else {
    teamMemberId = alreadyMember.id
  }

  // Grant bucket access from invite.
  // IMPORTANT: for non-admin roles, empty inviteBucketIds = no access (not unrestricted).
  // Admins (role.level >= 50) bypass the bucket check entirely in getAccessibleBucketIds.
  if (invite.inviteBucketIds.length > 0) {
    await grantBucketAccess(teamMemberId, invite.inviteBucketIds)
  }

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { status: 'ACCEPTED' },
  })

  await logUserAction({
    request,
    action: 'TEAM_INVITE_ACCEPT',
    success: true,
    userId: session.user.id,
    teamId: invite.teamId,
    resourceType: 'teamInvite',
    resourceId: invite.id,
    metadata: {
      teamName: invite.team.name,
      role: invite.role.name,
      bucketCount: invite.inviteBucketIds.length,
    },
  })

  publishMembershipChanged(session.user.id)

  return NextResponse.json({
    success: true,
    teamId: invite.teamId,
    teamName: invite.team.name,
  })
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "invites/\[id\]"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/team/invites/[id]/route.ts
git commit -m "feat: create TeamMemberBucketAccess rows when invite is accepted"
```

---

## Task 6: Seed existing members with all team buckets

**Files:**
- Modify: `prisma/seed.js`

> **IMPORTANT deployment note:** The seed MUST run immediately after the migration and before the new code is deployed. Any non-admin member who joined before the seed runs will have zero rows = zero bucket access. Run `npx prisma db seed` as the final step of the migration deployment, before restarting the app server.

- [ ] **Step 1: Read `prisma/seed.js`** to see its structure, then append this function and call it from the main function:

```javascript
async function seedBucketAccessForExistingMembers() {
  console.log('Seeding bucket access for existing members...')

  const members = await prisma.teamMember.findMany({
    include: {
      role: true,
      team: {
        include: {
          credentials: {
            include: { buckets: true },
          },
        },
      },
      bucketAccess: true,
    },
  })

  for (const member of members) {
    // Skip if this member already has bucket access records
    if (member.bucketAccess.length > 0) continue
    // Skip admins/owners — they're unrestricted by design (no rows needed)
    if (member.role.level >= 50) continue

    const allBuckets = member.team.credentials.flatMap((c) => c.buckets)
    if (allBuckets.length === 0) continue

    await prisma.teamMemberBucketAccess.createMany({
      data: allBuckets.map((b) => ({
        teamMemberId: member.id,
        bucketId: b.id,
      })),
      skipDuplicates: true,
    })

    console.log(
      `  Granted ${allBuckets.length} bucket(s) to member ${member.id} in team ${member.teamId}`
    )
  }

  console.log('Done seeding bucket access.')
}
```

Call it at the end of the main seed function: `await seedBucketAccessForExistingMembers()`

- [ ] **Step 2: Run the seed**

```bash
npx prisma db seed
```

Expected: members listed with bucket counts granted.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.js
git commit -m "feat: seed TeamMemberBucketAccess for existing non-admin team members"
```

---

## Task 7: Filter buckets in `GET /api/credentials`

**Files:**
- Modify: `app/api/credentials/route.ts`

- [ ] **Step 1: Import the helper**

Add at the top:
```typescript
import { getAccessibleBucketIds } from '@/lib/bucket-access'
```

- [ ] **Step 2: Apply filtering after the credentials query**

Find the `return ApiResponse.success({ credentials, personalScopeFallback })` line in the GET handler. Replace it with:

```typescript
let filteredCredentials = credentials
if (teamIdToQuery) {
  const allowedBucketIds = await getAccessibleBucketIds(auth!.userId, teamIdToQuery)
  if (allowedBucketIds !== null) {
    // Restrict to allowed buckets, drop credentials with none visible
    filteredCredentials = credentials
      .map((cred) => ({
        ...cred,
        buckets: cred.buckets.filter((b) => allowedBucketIds.includes(b.id)),
      }))
      .filter((cred) => cred.buckets.length > 0)
  }
}

return ApiResponse.success({ credentials: filteredCredentials, personalScopeFallback: usePersonalScopeFallback })
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "credentials/route"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/credentials/route.ts
git commit -m "feat: filter credentials/buckets by TeamMemberBucketAccess for non-admin members"
```

---

## Task 8: Enforce bucket access in `app/api/files/route.ts`

**Files:**
- Modify: `app/api/files/route.ts`

- [ ] **Step 1: Import the helper**

Add at the top:
```typescript
import { canAccessBucket } from '@/lib/bucket-access'
```

- [ ] **Step 2: Extend `getAccessibleBucket`**

Find the `getAccessibleBucket` function. After the `prisma.awsBucket.findFirst(...)` call (which fetches `bucket`), add the bucket-level check before the return:

```typescript
if (!bucket) return null

// For team operations on non-admin members, enforce bucket-level access
if (teamId && !requireAdmin) {
  const allowed = await canAccessBucket(userId, teamId, bucketId)
  if (!allowed) return null
}

return bucket
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "files/route"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/files/route.ts
git commit -m "feat: enforce TeamMemberBucketAccess in getAccessibleBucket"
```

---

## Task 8b: Enforce bucket access in preview-url and preview-content routes

**Files:**
- Modify: `app/api/files/[fileId]/preview-url/route.ts`
- Modify: `app/api/files/[fileId]/preview-content/route.ts`

These routes do their own independent auth (they look up the file and check team membership directly), so they bypass `getAccessibleBucket`. We need to add a bucket-level check to each.

- [ ] **Step 1: Read both files** to find where team membership is confirmed and where the file record is fetched.

- [ ] **Step 2: Add import to both files**

```typescript
import { canAccessBucket } from '@/lib/bucket-access'
```

- [ ] **Step 3: Add the check in `preview-url/route.ts`**

After the existing authorization check (after confirming user is a team member), find where `file` is fetched with its `teamId` and `bucketId`. Add:

```typescript
// file.teamId null = personal-scope file; those bypass bucket restriction intentionally
if (file.teamId && file.bucketId) {
  const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

- [ ] **Step 4: Apply the same check in `preview-content/route.ts`**

Same pattern — add import and the same 5-line check (with the same null-guard comment) after the membership guard.

- [ ] **Step 5: Verify both compile**

```bash
npx tsc --noEmit 2>&1 | grep "preview"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/files/[fileId]/preview-url/route.ts \
        app/api/files/[fileId]/preview-content/route.ts
git commit -m "feat: enforce bucket-level access in preview-url and preview-content routes"
```

---

## Task 8c: Enforce bucket access in download, direct-link, and link-creation routes

**Files:**
- Modify: `app/api/files/download/route.ts`
- Modify: `app/api/files/[fileId]/direct-link/route.ts`
- Modify: `app/api/links/route.ts`

All three routes currently check team membership but not bucket-level access.

- [ ] **Step 1: Read all three files** to find where team membership is confirmed and where the file/bucket is referenced.

- [ ] **Step 2: Import `canAccessBucket` in all three files**

```typescript
import { canAccessBucket } from '@/lib/bucket-access'
```

- [ ] **Step 3: Add bucket-level check in `app/api/files/download/route.ts`**

After the existing team membership check, add:

```typescript
// Personal-scope files (teamId null) bypass bucket restriction intentionally
if (file.teamId && file.bucketId) {
  const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

- [ ] **Step 4: Apply same check in `app/api/files/[fileId]/direct-link/route.ts`**

Same pattern — add import and the 5-line check after the membership guard.

- [ ] **Step 5: Add bucket-level check to the POST handler in `app/api/links/route.ts`**

Find the POST handler that creates a shareable link. After confirming the user is a team member and the file belongs to the team, add:

```typescript
if (file.teamId && file.bucketId) {
  const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

- [ ] **Step 6: Verify all three compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "download|direct-link|links/route"
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/files/download/route.ts \
        app/api/files/[fileId]/direct-link/route.ts \
        app/api/links/route.ts
git commit -m "feat: enforce bucket-level access in download, direct-link, and link-creation routes"
```

---

## Task 9: Filter search results by allowed buckets

**Files:**
- Modify: `app/api/search/route.ts`

- [ ] **Step 1: Read the file** to understand the `prisma.file.findMany` query and where `teamId` is resolved.

- [ ] **Step 2: Import and apply the filter**

Add at the top:
```typescript
import { getAccessibleBucketIds } from '@/lib/bucket-access'
```

After resolving `teamId`, before the `prisma.file.findMany` call, add:

```typescript
let bucketFilter: { in: string[] } | undefined = undefined
if (teamId) {
  const allowedIds = await getAccessibleBucketIds(session.user.id, teamId)
  if (allowedIds !== null) {
    bucketFilter = { in: allowedIds }
  }
}
```

In the `prisma.file.findMany` `where` clause, add:
```typescript
...(bucketFilter ? { bucketId: bucketFilter } : {}),
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "search/route"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/search/route.ts
git commit -m "feat: filter search results by allowed buckets for non-admin members"
```

---

## Task 10: Bucket picker UI in `InviteUserForm`

**Files:**
- Modify: `components/admin/invite-user-form.tsx`

- [ ] **Step 1: Add new state**

After the existing `useState` declarations, add:

```typescript
const [credentials, setCredentials] = useState<
  Array<{ id: string; name: string; region: string; buckets: Array<{ id: string; bucket: string }> }>
>([])
const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([])
const [bucketsLoading, setBucketsLoading] = useState(false)
```

- [ ] **Step 2: Fetch buckets on mount**

Add a `useEffect` after the existing roles fetch effect:

```typescript
useEffect(() => {
  const fetchBuckets = async () => {
    setBucketsLoading(true)
    try {
      const res = await fetch(`/api/team/buckets?teamId=${encodeURIComponent(teamId)}`)
      if (res.ok) {
        const data = await res.json()
        setCredentials(data.credentials || [])
        const allIds = (data.credentials || []).flatMap(
          (c: { buckets: { id: string }[] }) => c.buckets.map((b) => b.id)
        )
        setSelectedBucketIds(allIds)
      }
    } catch (err) {
      console.error('Failed to fetch buckets:', err)
    } finally {
      setBucketsLoading(false)
    }
  }
  fetchBuckets()
}, [teamId])
```

- [ ] **Step 3: Add toggle helpers** (before the return statement):

```typescript
const toggleBucket = (bucketId: string) => {
  setSelectedBucketIds((prev) =>
    prev.includes(bucketId) ? prev.filter((id) => id !== bucketId) : [...prev, bucketId]
  )
}

const toggleCredential = (credBucketIds: string[], allSelected: boolean) => {
  if (allSelected) {
    setSelectedBucketIds((prev) => prev.filter((id) => !credBucketIds.includes(id)))
  } else {
    setSelectedBucketIds((prev) => [...new Set([...prev, ...credBucketIds])])
  }
}
```

- [ ] **Step 4: Add bucket picker JSX**

Between the role `<Select>` section and the action buttons `<div>`, add:

```tsx
{(lookupStatus === 'found' || lookupStatus === 'not-found') && credentials.length > 0 && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="buckets" className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground ml-1">
        Bucket Access
      </Label>
      <button
        type="button"
        onClick={() => {
          const allIds = credentials.flatMap((c) => c.buckets.map((b) => b.id))
          const allSelected = allIds.every((id) => selectedBucketIds.includes(id))
          setSelectedBucketIds(allSelected ? [] : allIds)
        }}
        className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
      >
        {credentials.flatMap((c) => c.buckets).every((b) => selectedBucketIds.includes(b.id))
          ? 'Deselect All'
          : 'Select All'}
      </button>
    </div>

    {bucketsLoading ? (
      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
    ) : (
      <div className="space-y-3 max-h-64 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
        {credentials.map((cred) => {
          const credBucketIds = cred.buckets.map((b) => b.id)
          const allCredSelected = credBucketIds.every((id) => selectedBucketIds.includes(id))
          const someCredSelected = credBucketIds.some((id) => selectedBucketIds.includes(id))

          return (
            <div key={cred.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`cred-${cred.id}`}
                  checked={allCredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someCredSelected && !allCredSelected
                  }}
                  onChange={() => toggleCredential(credBucketIds, allCredSelected)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                />
                <label
                  htmlFor={`cred-${cred.id}`}
                  className="text-[11px] font-black text-foreground uppercase tracking-tight cursor-pointer"
                >
                  {cred.name}
                  <span className="ml-1.5 text-muted-foreground font-medium normal-case">
                    ({cred.region})
                  </span>
                </label>
              </div>
              <div className="ml-5 space-y-1">
                {cred.buckets.map((bucket) => (
                  <div key={bucket.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`bucket-${bucket.id}`}
                      checked={selectedBucketIds.includes(bucket.id)}
                      onChange={() => toggleBucket(bucket.id)}
                      className="h-3 w-3 rounded border-border accent-primary cursor-pointer"
                    />
                    <label
                      htmlFor={`bucket-${bucket.id}`}
                      className="text-[11px] font-mono text-foreground/80 cursor-pointer"
                    >
                      {bucket.bucket}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )}

    {selectedBucketIds.length === 0 && (
      <p className="text-[10px] text-rose-500 ml-1">
        No buckets selected — this member will have no file access.
      </p>
    )}
  </div>
)}
```

- [ ] **Step 5: Pass `bucketIds` in the invite API call**

In `handleSendInvite`, update the fetch body:
```typescript
body: JSON.stringify({ teamId, email, roleId, bucketIds: selectedBucketIds }),
```

- [ ] **Step 6: Reset buckets on form reset**

In `resetForm()`, add:
```typescript
const allIds = credentials.flatMap((c) => c.buckets.map((b) => b.id))
setSelectedBucketIds(allIds)
```

- [ ] **Step 7: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "invite-user-form"
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/admin/invite-user-form.tsx
git commit -m "feat: add bucket picker to InviteUserForm (grouped by credential, select-all)"
```

---

## Task 11: `BucketAccessManager` + member bucket API

**Files:**
- Create: `app/api/team/members/[memberId]/buckets/route.ts`
- Create: `components/admin/BucketAccessManager.tsx`
- Modify: `components/admin/user-role-management.tsx`

- [ ] **Step 1: Create the member bucket API route**

```typescript
// app/api/team/members/[memberId]/buckets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from '@/types/next-route-context'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { setBucketAccess } from '@/lib/bucket-access'

export async function GET(
  request: NextRequest,
  context: RouteContext<{ memberId: string }>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { memberId } = await context.params
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { bucketAccess: { select: { bucketId: true } } },
    })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    const hasAccess = await canManageTeam(session.user.id, member.teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ bucketIds: member.bucketAccess.map((ba) => ba.bucketId) })
  } catch (error) {
    console.error('Get member bucket access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<{ memberId: string }>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { memberId } = await context.params
    const { bucketIds } = await request.json()
    if (!Array.isArray(bucketIds)) {
      return NextResponse.json({ error: 'bucketIds must be an array' }, { status: 400 })
    }
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, teamId: true },
    })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    const hasAccess = await canManageTeam(session.user.id, member.teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (bucketIds.length > 0) {
      const validCount = await prisma.awsBucket.count({
        where: { id: { in: bucketIds }, credential: { teamId: member.teamId } },
      })
      if (validCount !== bucketIds.length) {
        return NextResponse.json({ error: 'Invalid bucket IDs' }, { status: 400 })
      }
    }
    await setBucketAccess(memberId, bucketIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update member bucket access error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `BucketAccessManager` component**

Note: All hooks are declared before any early returns (fixes React hooks-in-conditions issue).

```tsx
// components/admin/BucketAccessManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Database, ChevronDown, ChevronUp } from 'lucide-react'

type Bucket = { id: string; bucket: string }
type Credential = { id: string; name: string; region: string; buckets: Bucket[] }
type Member = {
  id: string
  user: { id: string; name: string | null; email: string }
  role: { name: string; level: number }
}

type Props = {
  member: Member
  teamId: string
  currentUserId: string
  ownerId: string
}

export function BucketAccessManager({ member, teamId, currentUserId, ownerId }: Props) {
  // All hooks must be declared before any conditional returns
  const [open, setOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        const [credsRes, accessRes] = await Promise.all([
          fetch(`/api/team/buckets?teamId=${encodeURIComponent(teamId)}`),
          fetch(`/api/team/members/${member.id}/buckets`),
        ])
        if (credsRes.ok) {
          const { credentials: creds } = await credsRes.json()
          setCredentials(creds || [])
        }
        if (accessRes.ok) {
          const { bucketIds } = await accessRes.json()
          setSelectedIds(bucketIds || [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, teamId, member.id])

  // Admins/owners are unrestricted — no UI needed
  if (member.role.level >= 50) return null
  // Can't manage yourself or the owner
  if (member.user.id === currentUserId || member.user.id === ownerId) return null

  const toggle = (id: string) =>
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/team/members/${member.id}/buckets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketIds: selectedIds }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast({ title: 'Bucket access updated' })
      setOpen(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to update bucket access', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <Database size={11} />
        Bucket Access
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 space-y-3 animate-fade-in">
          {loading ? (
            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : credentials.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No buckets in this team.</p>
          ) : (
            credentials.map((cred) => (
              <div key={cred.id} className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {cred.name} <span className="font-normal normal-case">({cred.region})</span>
                </p>
                {cred.buckets.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 ml-2">
                    <input
                      type="checkbox"
                      id={`bam-${b.id}`}
                      checked={selectedIds.includes(b.id)}
                      onChange={() => toggle(b.id)}
                      className="h-3 w-3 rounded accent-primary cursor-pointer"
                    />
                    <label htmlFor={`bam-${b.id}`} className="text-[11px] font-mono cursor-pointer">
                      {b.bucket}
                    </label>
                  </div>
                ))}
              </div>
            ))
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-[10px] font-black uppercase tracking-widest">
              {saving ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-[10px]">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Read `components/admin/user-role-management.tsx`**, find each member row, import and add `BucketAccessManager`:

```tsx
import { BucketAccessManager } from '@/components/admin/BucketAccessManager'

// Inside the member row, after the role dropdown/display:
<BucketAccessManager
  member={member}
  teamId={teamId}
  currentUserId={currentUserId}
  ownerId={ownerId}
/>
```

- [ ] **Step 4: Verify all three files compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/team/members/ \
        components/admin/BucketAccessManager.tsx \
        components/admin/user-role-management.tsx
git commit -m "feat: add BucketAccessManager UI and member bucket access API"
```

---

## Task 12: Notify admin when new bucket is added to team

**Files:**
- Create: `app/api/team/members/restricted/route.ts`
- Modify: `app/dashboard/credentials/page.tsx` (read first to understand the save flow)

When an admin saves a credential with new buckets, the app queries for restricted members who don't have access to the new bucket(s), then offers a one-click "Grant All" action.

- [ ] **Step 1: Create restricted members endpoint**

```typescript
// app/api/team/members/restricted/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const bucketId = searchParams.get('bucketId')

    if (!teamId || !bucketId) {
      return NextResponse.json({ error: 'teamId and bucketId are required' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Non-admin members who have some bucket access but NOT this bucket
    const restrictedMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        role: { level: { lt: 50 } },
        bucketAccess: {
          none: { bucketId },
          some: {},   // has at least one row (is a truly restricted member, not brand new)
        },
      },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true } },
        bucketAccess: { select: { bucketId: true } },
      },
    })

    return NextResponse.json({ members: restrictedMembers })
  } catch (error) {
    console.error('Get restricted members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Read `app/dashboard/credentials/page.tsx`** to understand where credentials are saved (POST/PUT response handling).

- [ ] **Step 3: After a successful credential save, check for restricted members and show a toast**

In the credential save success handler, for each new `bucketId` returned in the API response, call the restricted members endpoint. If any members are returned, show a toast with an action:

```typescript
// After credential save succeeds, for each newBucketId in the saved credential's buckets:
const checkAndNotify = async (teamId: string, newBucketIds: string[]) => {
  for (const bucketId of newBucketIds) {
    const res = await fetch(
      `/api/team/members/restricted?teamId=${teamId}&bucketId=${encodeURIComponent(bucketId)}`
    )
    if (!res.ok) continue
    const { members } = await res.json()
    if (members.length === 0) continue

    toast({
      title: 'New bucket added',
      description: `${members.length} restricted member(s) don't have access to this bucket.`,
      action: (
        <button
          onClick={async () => {
            // Grant access: for each member, add the new bucket to their existing list
            await Promise.all(
              members.map((m: { id: string; bucketAccess: { bucketId: string }[] }) =>
                fetch(`/api/team/members/${m.id}/buckets`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bucketIds: [...m.bucketAccess.map((ba: { bucketId: string }) => ba.bucketId), bucketId],
                  }),
                })
              )
            )
            toast({ title: 'Access granted to all affected members' })
          }}
          className="text-[10px] font-black uppercase tracking-widest underline"
        >
          Grant Access
        </button>
      ),
    })
  }
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/team/members/restricted/ app/dashboard/credentials/
git commit -m "feat: notify admin of restricted members when new bucket added to team"
```

---

## Task 13: Tests

**Files:**
- Create: `__tests__/lib/bucket-access.test.ts`
- Create: `__tests__/api/bucket-scoped-invitations.test.ts`

Look at existing tests in `__tests__/lib/` and `__tests__/rbac/` for patterns (mocking approach, jest setup).

- [ ] **Step 1: Write unit tests for `lib/bucket-access.ts`**

```typescript
// __tests__/lib/bucket-access.test.ts
import { getAccessibleBucketIds, canAccessBucket } from '@/lib/bucket-access'
import { prisma } from '@/lib/db'

jest.mock('@/lib/db', () => ({ prisma: { teamMember: { findUnique: jest.fn() } } }))

const mockFindUnique = prisma.teamMember.findUnique as jest.Mock

describe('getAccessibleBucketIds', () => {
  it('returns null for ADMIN (level 50)', async () => {
    mockFindUnique.mockResolvedValue({
      role: { level: 50 },
      bucketAccess: [],
    })
    const result = await getAccessibleBucketIds('user1', 'team1')
    expect(result).toBeNull()
  })

  it('returns null for OWNER (level 100)', async () => {
    mockFindUnique.mockResolvedValue({
      role: { level: 100 },
      bucketAccess: [],
    })
    const result = await getAccessibleBucketIds('user1', 'team1')
    expect(result).toBeNull()
  })

  it('returns allowed bucket IDs for VIEWER (level 10)', async () => {
    mockFindUnique.mockResolvedValue({
      role: { level: 10 },
      bucketAccess: [{ bucketId: 'b1' }, { bucketId: 'b2' }],
    })
    const result = await getAccessibleBucketIds('user1', 'team1')
    expect(result).toEqual(['b1', 'b2'])
  })

  it('returns empty array when member has no bucket access records', async () => {
    mockFindUnique.mockResolvedValue({
      role: { level: 10 },
      bucketAccess: [],
    })
    const result = await getAccessibleBucketIds('user1', 'team1')
    expect(result).toEqual([])
  })

  it('returns empty array when member not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await getAccessibleBucketIds('user1', 'team1')
    expect(result).toEqual([])
  })
})

describe('canAccessBucket', () => {
  it('returns true for admin (null from getAccessibleBucketIds)', async () => {
    mockFindUnique.mockResolvedValue({ role: { level: 50 }, bucketAccess: [] })
    expect(await canAccessBucket('user1', 'team1', 'b1')).toBe(true)
  })

  it('returns true when bucket is in allowed list', async () => {
    mockFindUnique.mockResolvedValue({ role: { level: 10 }, bucketAccess: [{ bucketId: 'b1' }] })
    expect(await canAccessBucket('user1', 'team1', 'b1')).toBe(true)
  })

  it('returns false when bucket is not in allowed list', async () => {
    mockFindUnique.mockResolvedValue({ role: { level: 10 }, bucketAccess: [{ bucketId: 'b2' }] })
    expect(await canAccessBucket('user1', 'team1', 'b1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the unit tests**

```bash
npx jest __tests__/lib/bucket-access.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Read `__tests__/lib/personal-scope-fallback.test.ts`** to understand the project's exact mocking conventions (how `next-auth`, `prisma`, and `next/server` are mocked) before writing any integration tests.

- [ ] **Step 4: Write API integration tests for the invite + accept + enforcement flow**

Follow the patterns from `__tests__/lib/personal-scope-fallback.test.ts` exactly. Key scenarios to cover:

```typescript
// __tests__/api/bucket-scoped-invitations.test.ts

// Mock setup should follow the exact same pattern as personal-scope-fallback.test.ts.
// Use jest.mock for prisma, next-auth/react, and next-auth.

describe('POST /api/team/invites with bucketIds', () => {
  it('stores inviteBucketIds on the invite when valid bucketIds provided', async () => {
    // Mock: session, canManageTeam returns true, prisma.awsBucket.count returns bucketIds.length,
    //       no existing member/invite, prisma.teamInvite.create resolves with id
    // Call the POST handler, assert teamInvite.create was called with inviteBucketIds
  })

  it('returns 400 when bucketIds contain IDs not belonging to the team', async () => {
    // Mock: prisma.awsBucket.count returns fewer than bucketIds.length
    // Assert 400 response
  })
})

describe('PATCH /api/team/invites/[id] accept', () => {
  it('creates TeamMemberBucketAccess rows from invite.inviteBucketIds on accept', async () => {
    // Mock: invite.inviteBucketIds = ['b1', 'b2'], no existing member
    // Assert prisma.teamMemberBucketAccess.createMany called with those IDs
  })

  it('does not call createMany when inviteBucketIds is empty', async () => {
    // Mock: invite.inviteBucketIds = []
    // Assert prisma.teamMemberBucketAccess.createMany NOT called
  })
})

describe('GET /api/credentials bucket filtering', () => {
  it('returns all buckets for ADMIN members (level 50)', async () => {
    // Mock: getAccessibleBucketIds returns null (admin)
    // Assert all buckets returned unfiltered
  })

  it('filters to allowed buckets only for VIEWER members', async () => {
    // Mock: getAccessibleBucketIds returns ['b1'], credential has buckets ['b1', 'b2']
    // Assert only b1 in response
  })

  it('drops credentials with no allowed buckets for VIEWER members', async () => {
    // Mock: getAccessibleBucketIds returns [], credential has buckets ['b1', 'b2']
    // Assert credentials array is empty
  })
})
```

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add __tests__/lib/bucket-access.test.ts __tests__/api/
git commit -m "test: add unit and integration tests for bucket-scoped invitations"
```

---

## Deployment Checklist

Before going live:
1. Run `npx prisma migrate deploy` (applies migration)
2. **Immediately** run `npx prisma db seed` (seeds existing members — do NOT skip)
3. Deploy app server
4. Verify: an existing non-admin member can still see their buckets
5. Verify: invite a new member with specific buckets → accept → they only see those buckets
