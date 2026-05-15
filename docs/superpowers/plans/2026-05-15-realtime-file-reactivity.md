# Real-Time File Reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make file operations (upload, delete, move, folder create, tag update) instantly visible to all team members without a manual refresh, using Server-Sent Events.

**Architecture:** Extend the existing in-memory SSE broker pattern (already used for membership events in `lib/events/membership.ts`) to cover file-change events keyed by `teamId`. API handlers call `revalidateTag('dashboard-stats')` then `publishFileChanged()` after every mutation. The files page opens an `EventSource` and calls `fetchFiles()` on matching events.

**Tech Stack:** Next.js 15 App Router, Server-Sent Events (`ReadableStream<Uint8Array>`), React `EventSource` API, `next/cache` `revalidateTag`, Jest for unit tests.

---

## File Map

| Action | File |
|--------|------|
| Create | `lib/events/types.ts` |
| Create | `lib/events/files.ts` |
| Create | `app/api/events/files/route.ts` |
| Create | `__tests__/lib/events-files.test.ts` |
| Create | `__tests__/api/events-files-route.test.ts` |
| Modify | `app/dashboard/page.tsx` line 71 — add `tags` to `unstable_cache` |
| Modify | `app/api/files/handlers/upload.ts` — `handleUpload` + `handleMultipartComplete` |
| Modify | `app/api/files/handlers/folder.ts` — `handleCreateFolder` |
| Modify | `app/api/files/handlers/metadata.ts` — `handleUpdateTags` |
| Modify | `app/api/files/route.ts` — DELETE + PATCH handlers |
| Modify | `app/dashboard/files/page.tsx` — SSE subscription + abort fix |

---

## Task 1: Shared event types

**Files:**
- Create: `lib/events/types.ts`

This file has no server-only imports so it is safe to import in both `'use server'` modules and `'use client'` components.

- [ ] **Step 1: Create `lib/events/types.ts`**

```typescript
export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated'
  key?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/events/types.ts
git commit -m "feat(sse): add shared FileChangedPayload type"
```

---

## Task 2: File SSE broker

**Files:**
- Create: `lib/events/files.ts`
- Create: `__tests__/lib/events-files.test.ts`

Mirrors `lib/events/membership.ts` exactly, keyed by `teamId` instead of `userId`. Does NOT import `next/cache` — that's the caller's responsibility.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/events-files.test.ts`:

```typescript
import { publishFileChanged, createFileEventStream } from '@/lib/events/files'
import type { FileChangedPayload } from '@/lib/events/types'

describe('publishFileChanged', () => {
  it('is a no-op when no subscribers exist for the teamId', () => {
    expect(() =>
      publishFileChanged('team-no-subscribers', { bucketId: 'b1', action: 'uploaded' })
    ).not.toThrow()
  })

  it('enqueues a file-changed SSE event to all subscribers for the teamId', async () => {
    const received: string[] = []
    const decoder = new TextDecoder()

    const stream = createFileEventStream('team-abc')

    const reader = stream.getReader()
    // Consume the initial ':connected\n\n' chunk
    await reader.read()

    const payload: FileChangedPayload = { bucketId: 'bucket-1', action: 'deleted', key: 'x/y.png' }
    publishFileChanged('team-abc', payload)

    const { value } = await reader.read()
    received.push(decoder.decode(value))
    reader.cancel()

    expect(received[0]).toBe(
      `event: file-changed\ndata: ${JSON.stringify(payload)}\n\n`
    )
  })

  it('does not deliver to subscribers of a different teamId', async () => {
    const stream = createFileEventStream('team-X')
    const reader = stream.getReader()
    await reader.read() // consume :connected

    publishFileChanged('team-Y', { bucketId: 'b', action: 'uploaded' })

    // No event should arrive — we read with a timeout to confirm
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 50))
    const readRace = reader.read().then((r) => r)
    const result = await Promise.race([readRace, timeout])
    reader.cancel()

    expect(result).toBeNull()
  })
})

describe('createFileEventStream', () => {
  it('sends :connected comment immediately on subscription', async () => {
    const decoder = new TextDecoder()
    const stream = createFileEventStream('team-connect-test')
    const reader = stream.getReader()
    const { value } = await reader.read()
    reader.cancel()
    expect(decoder.decode(value)).toBe(': connected\n\n')
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx jest __tests__/lib/events-files.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/events/files'`

- [ ] **Step 3: Create `lib/events/files.ts`**

```typescript
// NOTE: In-memory only — does not work across multiple server instances.
import type { FileChangedPayload } from './types'

const encoder = new TextEncoder()
const HEARTBEAT_INTERVAL_MS = 25_000

type FileController = ReadableStreamDefaultController<Uint8Array>

const fileClients = new Map<string, Set<FileController>>()

export function publishFileChanged(teamId: string, payload: FileChangedPayload): void {
  const controllers = fileClients.get(teamId)
  if (!controllers || controllers.size === 0) return

  const data = encoder.encode(`event: file-changed\ndata: ${JSON.stringify(payload)}\n\n`)

  for (const controller of controllers) {
    try {
      controller.enqueue(data)
    } catch {
      controllers.delete(controller)
    }
  }

  if (controllers.size === 0) {
    fileClients.delete(teamId)
  }
}

export function createFileEventStream(teamId: string): ReadableStream<Uint8Array> {
  let cleanup: (() => void) | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let controllers = fileClients.get(teamId)
      if (!controllers) {
        controllers = new Set<FileController>()
        fileClients.set(teamId, controllers)
      }
      controllers.add(controller)

      controller.enqueue(encoder.encode(': connected\n\n'))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeat)
          controllers?.delete(controller)
          if (controllers && controllers.size === 0) {
            fileClients.delete(teamId)
          }
        }
      }, HEARTBEAT_INTERVAL_MS)

      cleanup = () => {
        clearInterval(heartbeat)
        controllers?.delete(controller)
        if (controllers && controllers.size === 0) {
          fileClients.delete(teamId)
        }
      }
    },
    cancel() {
      if (cleanup) cleanup()
    },
  })
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest __tests__/lib/events-files.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/events/files.ts __tests__/lib/events-files.test.ts
git commit -m "feat(sse): add in-memory file SSE broker keyed by teamId"
```

---

## Task 3: SSE endpoint for file events

**Files:**
- Create: `app/api/events/files/route.ts`
- Create: `__tests__/api/events-files-route.test.ts`

Auth check (401 if no session) + team membership check (403 if not a member). Returns the SSE stream.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/events-files-route.test.ts`:

```typescript
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { teamMember: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/events/files', () => ({
  createFileEventStream: jest.fn(() => new ReadableStream()),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { createFileEventStream } from '@/lib/events/files'
import { GET } from '@/app/api/events/files/route'
import { NextRequest } from 'next/server'

function makeRequest(teamId?: string) {
  const url = teamId
    ? `http://localhost/api/events/files?teamId=${teamId}`
    : 'http://localhost/api/events/files'
  return new NextRequest(url)
}

describe('GET /api/events/files', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when teamId query param is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not a member of the team', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(403)
  })

  it('returns 200 SSE stream when user is a valid team member', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'tm-1' })
    const res = await GET(makeRequest('team-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(createFileEventStream).toHaveBeenCalledWith('team-1')
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx jest __tests__/api/events-files-route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/events/files/route'`

- [ ] **Step 3: Create `app/api/events/files/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createFileEventStream } from '@/lib/events/files'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const teamId = request.nextUrl.searchParams.get('teamId')
  if (!teamId) {
    return new Response('teamId is required', { status: 400 })
  }

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  })
  if (!member) {
    return new Response('Forbidden', { status: 403 })
  }

  const stream = createFileEventStream(teamId)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest __tests__/api/events-files-route.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/events/files/route.ts __tests__/api/events-files-route.test.ts
git commit -m "feat(sse): add GET /api/events/files SSE endpoint with auth and team membership check"
```

---

## Task 4: Wire `revalidateTag` into `unstable_cache`

**Files:**
- Modify: `app/dashboard/page.tsx` line 71

The `['dashboard-stats']` array passed as the second argument to `unstable_cache` is the cache **key**, not the tags array. `revalidateTag('dashboard-stats')` only works if `tags: ['dashboard-stats']` is also set in the options object (third argument).

- [ ] **Step 1: Open `app/dashboard/page.tsx` and add `tags` to the options**

In `app/dashboard/page.tsx`, find line 71 (the `unstable_cache` options):

```typescript
// Before (line 70-72):
  ['dashboard-stats'],
  { revalidate: 30 }
)

// After:
  ['dashboard-stats'],
  { revalidate: 30, tags: ['dashboard-stats'] }
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "fix(cache): add tags array to unstable_cache so revalidateTag('dashboard-stats') works"
```

---

## Task 5: Publish file events after upload mutations

**Files:**
- Modify: `app/api/files/handlers/upload.ts`

Add `revalidateTag` + `publishFileChanged` after `prisma.file.upsert` in `handleUpload` (line ~73) and after `incrementUsage` in `handleMultipartComplete` (line ~200). Both calls happen before the `logUserAction` + return so they are still inside the active request scope.

- [ ] **Step 1: Add imports to `upload.ts`**

At the top of `app/api/files/handlers/upload.ts`, add:

```typescript
import { revalidateTag } from 'next/cache'
import { publishFileChanged } from '@/lib/events/files'
```

- [ ] **Step 2: Wire `handleUpload` — after `prisma.file.upsert` (line ~73)**

Find the block ending with:
```typescript
  await logUserAction({ request, action: 'FILE_UPLOAD_INIT', success: true, ... })
  return NextResponse.json({ url, key, fileId: file.id })
```

Insert before `logUserAction`:
```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(validated.teamId || bucket.credential.teamId, { bucketId: validated.bucketId, action: 'uploaded', key })
```

- [ ] **Step 3: Wire `handleMultipartComplete` — after `incrementUsage` block (line ~204)**

Find the block ending with:
```typescript
  await logUserAction({ request, action: 'FILE_MULTIPART_COMPLETE', success: true, ... })
  return NextResponse.json({ success: true })
```

Insert before `logUserAction`:
```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(file.teamId || file.credential.teamId, { bucketId: file.bucketId, action: 'uploaded', key: validated.key })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run existing upload tests**

```bash
npx jest __tests__/lib/files-route-quota.test.ts __tests__/lib/files-parentpath.test.ts --no-coverage
```

Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add app/api/files/handlers/upload.ts
git commit -m "feat(sse): publish file-changed event after upload and multipart complete"
```

---

## Task 6: Publish file events after folder creation

**Files:**
- Modify: `app/api/files/handlers/folder.ts`

Add `revalidateTag` + `publishFileChanged` after `prisma.file.create` in `handleCreateFolder`.

- [ ] **Step 1: Add imports to `folder.ts`**

```typescript
import { revalidateTag } from 'next/cache'
import { publishFileChanged } from '@/lib/events/files'
```

- [ ] **Step 2: Wire `handleCreateFolder` — after `prisma.file.create`**

`app/api/files/handlers/folder.ts` currently ends with:

```typescript
  await logUserAction({ request, action: 'FILE_CREATE_FOLDER', ... })
  return NextResponse.json({ success: true, key: folderKey })
```

Insert before `logUserAction`:
```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(bucket.credential.teamId, { bucketId: validated.bucketId, action: 'folder-created', key: folderKey })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/files/handlers/folder.ts
git commit -m "feat(sse): publish file-changed event after folder creation"
```

---

## Task 7: Publish file events after tag updates

**Files:**
- Modify: `app/api/files/handlers/metadata.ts`

Add `publishFileChanged` (no `revalidateTag` — tag updates don't change file counts) after `prisma.file.update` in `handleUpdateTags`. `handleToggleFavorite` is NOT published — it's per-user state.

- [ ] **Step 1: Add imports to `metadata.ts`**

```typescript
import { publishFileChanged } from '@/lib/events/files'
```

- [ ] **Step 2: Wire `handleUpdateTags` — after `prisma.file.update`**

`app/api/files/handlers/metadata.ts` currently ends `handleUpdateTags` with:

```typescript
  await logUserAction({ request, action: 'FILE_TAG_UPDATE', ... })
  return NextResponse.json(updated)
```

Insert before `logUserAction`:
```typescript
  publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'metadata-updated', key: file.key })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/files/handlers/metadata.ts
git commit -m "feat(sse): publish file-changed event after tag/description update"
```

---

## Task 8: Publish file events after delete and move

**Files:**
- Modify: `app/api/files/route.ts`

Wire `revalidateTag` + `publishFileChanged` into the DELETE handler (after `prisma.file.delete`) and `publishFileChanged` only into the PATCH handler (after `prisma.file.update` — move doesn't change file counts).

- [ ] **Step 1: Add imports to `app/api/files/route.ts`**

```typescript
import { revalidateTag } from 'next/cache'
import { publishFileChanged } from '@/lib/events/files'
```

- [ ] **Step 2: Wire DELETE handler — after `prisma.file.delete` (line ~113)**

The DELETE handler currently has:
```typescript
    await prisma.file.delete({ where: { id } })

    await logUserAction({ request, action: 'FILE_DELETE', success: true, ... })
    return NextResponse.json({ success: true })
```

Insert between `prisma.file.delete` and `logUserAction`:
```typescript
    revalidateTag('dashboard-stats')
    publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'deleted', key: file.key })
```

- [ ] **Step 3: Wire PATCH handler — after `prisma.file.update` (line ~155)**

The PATCH handler currently has:
```typescript
    await prisma.file.update({ where: { id: validated.id }, data: { key: newKey, parentPath: validated.newPath } })

    await logUserAction({ request, action: 'FILE_MOVE', success: true, ... })
    return NextResponse.json({ success: true })
```

Insert between `prisma.file.update` and `logUserAction`:
```typescript
    publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'moved', key: newKey })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run existing route tests**

```bash
npx jest __tests__/api/ --no-coverage
```

Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add app/api/files/route.ts
git commit -m "feat(sse): publish file-changed events after delete and move"
```

---

## Task 9: Subscribe to file SSE events in the files page

**Files:**
- Modify: `app/dashboard/files/page.tsx`

Two changes:
1. **SSE subscription** — new `useEffect` with a `useRef` stable-ref pattern so the `EventSource` is only torn down when `selectedTeamId` or `selectedBucketId` changes (not on every `fetchFiles` change from folder navigation).
2. **Upload abort fix** — move `fetchFiles()` from the `try` block to a `finally` block so it runs even when an upload is aborted or fails.

- [ ] **Step 1: Add `useRef` stable ref for `fetchFiles` — after existing `useRef` declarations**

In `app/dashboard/files/page.tsx`, the `inFlightRequestKeyRef` is already declared at line 136. Directly after it, add:

```typescript
  const fetchFilesRef = useRef(fetchFiles)
  useEffect(() => { fetchFilesRef.current = fetchFiles }, [fetchFiles])
```

- [ ] **Step 2: Add SSE `useEffect` — after the existing `useEffect` that calls `fetchFiles` on dep change**

The existing effect at line ~327-330 is:
```typescript
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles, selectedBucketId, currentPath, tagFilter, searchQuery, viewMode, currentPage])
```

After that block, add the SSE subscription:

```typescript
  useEffect(() => {
    if (!selectedTeamId || !selectedBucketId) return
    const evtSource = new EventSource(`/api/events/files?teamId=${selectedTeamId}`)
    evtSource.addEventListener('file-changed', (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as FileChangedPayload
      if (payload.bucketId !== selectedBucketId) return
      // Clear dedup guard so SSE-triggered fetch always issues a fresh request.
      inFlightRequestKeyRef.current = null
      fetchFilesRef.current()
    })
    return () => evtSource.close()
  }, [selectedTeamId, selectedBucketId])  // fetchFiles intentionally excluded — stable via ref
```

- [ ] **Step 3: Add `FileChangedPayload` import**

In the imports section at the top of `app/dashboard/files/page.tsx`, add:

```typescript
import type { FileChangedPayload } from '@/lib/events/types'
```

- [ ] **Step 4: Fix upload abort — move `fetchFiles()` to `finally`**

Around line 1648-1662, the `onUpload` prop callback currently reads:

```typescript
              onUpload={async (files, onProgress) => {
                try {
                  await handleUpload(files, onProgress)
                  setIsUploadOpen(false)
                  setUploadTags('')
                  setUploadDescription('')
                  fetchFiles()
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: error.message || 'Failed to upload files',
                  })
                  throw error
                }
              }}
```

Change it to:

```typescript
              onUpload={async (files, onProgress) => {
                try {
                  await handleUpload(files, onProgress)
                  setIsUploadOpen(false)
                  setUploadTags('')
                  setUploadDescription('')
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: error.message || 'Failed to upload files',
                  })
                  throw error
                } finally {
                  fetchFiles()
                }
              }}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: PASS (no regressions).

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/files/page.tsx
git commit -m "feat(sse): subscribe to file SSE events in files page; fix upload abort leaving stale list"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Start dev server and manually verify**

```bash
npm run dev
```

Open the files page in two browser tabs with the same team + bucket selected. Upload a file in tab 1 — tab 2 should refresh automatically within 1–2 seconds. Delete a file in tab 2 — tab 1 should update. Create a folder — both tabs update.

- [ ] **Commit any final cleanup if needed, then push**

```bash
git push origin preprod
```
