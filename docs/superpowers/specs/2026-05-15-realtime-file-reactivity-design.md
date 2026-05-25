# Real-Time File Reactivity Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the S3 portal fully reactive to file operations — both for the acting user (same-tab) and for all other team members (cross-tab, cross-user) — without requiring a manual refresh.

**Architecture:** Extend the existing in-memory SSE broker pattern (already used for membership events) to cover file-change events keyed by team. API handlers call `revalidateTag` then `publishFileChanged` after every mutation (both calls happen inside the active request scope). The files page opens an `EventSource` and calls `fetchFiles()` on matching events.

**Tech Stack:** Next.js 15 App Router, Server-Sent Events (`ReadableStream`), React `EventSource` API, `next/cache` `revalidateTag`, existing `fetchFiles()` callback in files page.

---

## 1. Context & Constraints

The codebase already has:
- `lib/events/membership.ts` — in-memory SSE broker keyed by `userId`
- `app/api/events/membership/route.ts` — GET endpoint returning the stream
- `lib/contexts/dashboard-context.tsx` — opens `EventSource('/api/events/membership')` and calls `invalidateQueries` on events
- `app/api/files/handlers/` — split handler files for upload, list, metadata, folder
- `app/dashboard/files/page.tsx` — `fetchFiles()` useCallback already called in every mutation success handler except the abort path
- `app/dashboard/page.tsx` — `getDashboardStats` wrapped in `unstable_cache(['dashboard-stats'], { revalidate: 30 })` — **no tags yet**

**Known limitation:** The in-memory broker does not work across multiple Node.js server instances. For single-instance deployments (current) this is fine. A note is included in the broker file.

**Important constraint:** `revalidateTag` from `next/cache` must be called within an active Next.js request scope (route handler or Server Action). It must **not** be called from a background singleton like an SSE broker. All `revalidateTag` calls go in the API handler at the mutation call site, before `publishFileChanged`.

---

## 2. SSE Event Schema

All file-change events use a single SSE event name: `file-changed`.

```typescript
type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated'
  key?: string   // S3 key of the affected object (informational, not required for refetch logic)
}
```

The client filters by `bucketId` — only refetches when the event's `bucketId` matches the currently selected bucket. The `key` field is included for future use but not acted on in this iteration.

`toggleFavorite` is **not** published. Favorites are per-user state; no other client needs to know.

---

## 3. New Files

### `lib/events/files.ts`

In-memory SSE broker keyed by `teamId`. Mirrors `lib/events/membership.ts` exactly. Does **not** import `next/cache` — that responsibility belongs to call sites.

```typescript
// NOTE: In-memory only — does not work across multiple server instances.
const HEARTBEAT_INTERVAL_MS = 25_000
type FileController = ReadableStreamDefaultController<Uint8Array>
const fileClients = new Map<string, Set<FileController>>()

export function publishFileChanged(teamId: string, payload: FileChangedPayload): void
export function createFileEventStream(teamId: string): ReadableStream<Uint8Array>
```

### `lib/events/types.ts` (new)

Shared types file with no server dependencies — safe to import in both server modules and `'use client'` components:

```typescript
export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated'
  key?: string
}
```

Both `lib/events/files.ts` and `app/dashboard/files/page.tsx` import `FileChangedPayload` from here, not from `lib/events/files.ts`.

### `app/api/events/files/route.ts`

```typescript
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response>
```

- Reads `teamId` from `request.nextUrl.searchParams`
- Auth check: 401 if no session
- Team membership check via `prisma.teamMember.findUnique`: 403 if not a member
- Returns `createFileEventStream(teamId)` with SSE headers (`text/event-stream`, `no-cache`, `keep-alive`)

---

## 4. Modified Files — Server Side

At every mutation call site: call `revalidateTag('dashboard-stats')` first (within request scope), then call `publishFileChanged`.

### `app/api/files/handlers/upload.ts`

- `handleUpload`: after successful `prisma.file.upsert`:
  ```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(validated.teamId || bucket.credential.teamId, { bucketId: validated.bucketId, action: 'uploaded', key })
  ```
- `handleMultipartComplete`: after `prisma.file.update` and quota increment:
  ```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(file.teamId || file.credential.teamId, { bucketId: file.bucketId, action: 'uploaded', key: validated.key })
  ```

### `app/api/files/handlers/folder.ts`

- `handleCreateFolder`: after `prisma.file.create`:
  ```typescript
  revalidateTag('dashboard-stats')
  publishFileChanged(bucket.credential.teamId, { bucketId: validated.bucketId, action: 'folder-created', key: folderKey })
  ```

### `app/api/files/handlers/metadata.ts`

- `handleUpdateTags`: after `prisma.file.update`:
  ```typescript
  publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'metadata-updated', key: file.key })
  ```
  (No `revalidateTag` here — tag updates don't change file counts on the dashboard.)
- `handleToggleFavorite`: no publish (per-user state)

### `app/api/files/route.ts` — DELETE handler

After `prisma.file.delete`:
```typescript
revalidateTag('dashboard-stats')
publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'deleted', key: file.key })
```

### `app/api/files/route.ts` — PATCH handler

After `prisma.file.update`:
```typescript
publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'moved', key: newKey })
```
(Move doesn't change counts, so no `revalidateTag`.)

### `app/dashboard/page.tsx`

Add `tags: ['dashboard-stats']` to the `unstable_cache` options — this is what makes `revalidateTag('dashboard-stats')` actually work:

```typescript
unstable_cache(fn, ['dashboard-stats'], { revalidate: 30, tags: ['dashboard-stats'] })
```

---

## 5. Modified Files — Client Side

### `app/dashboard/files/page.tsx`

**Add SSE subscription** — one `useEffect` scoped only to `[selectedTeamId, selectedBucketId]`. Use a `useRef` to hold the latest `fetchFiles` so the effect never needs to depend on it (avoids tearing down the `EventSource` on every folder navigation or pagination):

```typescript
const fetchFilesRef = useRef(fetchFiles)
useEffect(() => { fetchFilesRef.current = fetchFiles }, [fetchFiles])

useEffect(() => {
  if (!selectedTeamId || !selectedBucketId) return
  const evtSource = new EventSource(`/api/events/files?teamId=${selectedTeamId}`)
  evtSource.addEventListener('file-changed', (e) => {
    const payload = JSON.parse(e.data) as FileChangedPayload
    if (payload.bucketId !== selectedBucketId) return
    // Clear in-flight dedup ref so the SSE-triggered fetch always issues a fresh request,
    // even if a same-tab mutation's request is still in-flight when the event arrives.
    inFlightRequestKeyRef.current = null
    fetchFilesRef.current()
  })
  return () => evtSource.close()
}, [selectedTeamId, selectedBucketId])  // fetchFiles intentionally excluded — stable via ref
```

Import `FileChangedPayload` from `@/lib/events/types` (the shared types file, not from `lib/events/files`).

**Fix `handleAbort` / upload abort path** — The `onUpload` handler (the `FileUpload` drop zone callback around line 1650) calls `fetchFiles()` at line 1654 inside a `try` block. On abort/error the catch re-throws before reaching line 1654, so aborted uploads leave a stale DB record visible in the list. Fix: wrap line 1654's `fetchFiles()` call in a `finally` block instead of leaving it in `try`, so it runs whether the upload succeeded, failed, or was aborted:

```typescript
// Before (broken on abort):
try {
  await handleUpload(files, onProgress)
  fetchFiles()   // ← never reached on abort
} catch (err) { ... }

// After:
try {
  await handleUpload(files, onProgress)
} catch (err) { ... } finally {
  fetchFiles()   // ← always runs
}
```

---

## 6. Data Flow

```
User action (upload / delete / move / folder / tag)
        │
        ▼
API handler — mutates DB + S3  (still in request scope)
        │
        ├─► revalidateTag('dashboard-stats')     [Next.js server cache bust, in-request]
        │
        ├─► publishFileChanged(teamId, payload)  [SSE push to all team clients]
        │         └─► SSE → files page EventSource listener
        │                   │ payload.bucketId matches?
        │                   ├─► inFlightRequestKeyRef.current = null
        │                   └─► fetchFiles()      [cross-tab / cross-user]
        │
        └─► success handler in files/page.tsx
                  └─► fetchFiles()               [same-tab, already wired]
```

---

## 7. Error Handling & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| SSE connection drops | Browser `EventSource` auto-reconnects |
| User has no active team/bucket | `useEffect` early-returns; no connection opened |
| `publishFileChanged` with no subscribers | No-op; Map lookup returns undefined/empty set |
| SSE event arrives while same-tab request in-flight | `inFlightRequestKeyRef.current = null` before `fetchFiles()` forces a fresh request |
| `revalidateTag` called inside broker (lib function) | **Not done** — call sites call it directly before `publishFileChanged` |
| `handleAbort` leaving stale DB record | `fetchFiles()` at line 1654 of upload flow re-syncs list with S3 |
| Multiple rapid SSE events | `fetchFiles()` dedup via `inFlightRequestKeyRef` after the null-reset only drops truly identical concurrent requests |

---

## 8. Out of Scope

- Cross-server-instance pubsub (Redis, Upstash) — single instance is current deployment
- Presence indicators ("User X is viewing this folder")
- Granular optimistic updates per event type (remove single file without full refetch)
- Dashboard stats live SSE push (30s TTL + `revalidateTag` on next navigation is sufficient)
