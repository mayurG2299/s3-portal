# Real-Time File Reactivity Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the S3 portal fully reactive to file operations — both for the acting user (same-tab) and for all other team members (cross-tab, cross-user) — without requiring a manual refresh.

**Architecture:** Extend the existing in-memory SSE broker pattern (already used for membership events) to cover file-change events keyed by team. API handlers publish events after every mutation. The files page opens an `EventSource` and calls `fetchFiles()` on matching events. Dashboard stats cache is busted server-side on every file mutation via `revalidateTag`.

**Tech Stack:** Next.js 15 App Router, Server-Sent Events (`ReadableStream`), React `EventSource` API, `next/cache` `revalidateTag`, existing `fetchFiles()` debounced callback in files page.

---

## 1. Context & Constraints

The codebase already has:
- `lib/events/membership.ts` — in-memory SSE broker keyed by `userId`
- `app/api/events/membership/route.ts` — GET endpoint returning the stream
- `lib/contexts/dashboard-context.tsx` — opens `EventSource('/api/events/membership')` and calls `invalidateQueries` on events
- `app/api/files/handlers/` — split handler files for upload, list, metadata, folder
- `app/dashboard/files/page.tsx` — `fetchFiles()` useCallback already called in every mutation success handler except `handleAbort`
- `app/dashboard/page.tsx` — `getDashboardStats` wrapped in `unstable_cache(['dashboard-stats'], { revalidate: 30 })`

**Known limitation:** The in-memory broker does not work across multiple Node.js server instances. For single-instance deployments (current) this is fine. A note is included in the broker file.

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

The client filters by `bucketId` — only refetches when the event's `bucketId` matches the currently selected bucket. The `key` field is included for future use (e.g. optimistic single-item removal) but not acted on in this iteration.

`toggleFavorite` is **not** published. Favorites are per-user state; no other client needs to know.

---

## 3. New Files

### `lib/events/files.ts`

In-memory SSE broker keyed by `teamId`. Mirrors `lib/events/membership.ts` exactly.

```typescript
// NOTE: In-memory only — does not work across multiple server instances.
const HEARTBEAT_INTERVAL_MS = 25_000
type FileController = ReadableStreamDefaultController<Uint8Array>
const fileClients = new Map<string, Set<FileController>>()

export function publishFileChanged(teamId: string, payload: FileChangedPayload): void
export function createFileEventStream(teamId: string): ReadableStream<Uint8Array>
```

`publishFileChanged` also calls `revalidateTag('dashboard-stats')` from `next/cache` to bust the dashboard stats cache on every file mutation.

### `app/api/events/files/route.ts`

```typescript
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response>
```

- Reads `teamId` from `request.nextUrl.searchParams`
- Auth check: 401 if no session
- Team membership check: 403 if user is not a member of `teamId`
- Returns `createFileEventStream(teamId)` with SSE headers

---

## 4. Modified Files — Server Side

### `app/api/files/handlers/upload.ts`

- `handleUpload`: after successful `prisma.file.upsert`, call `publishFileChanged(teamId, { bucketId, action: 'uploaded', key })`
- `handleMultipartComplete`: after `prisma.file.update` and quota increment, call `publishFileChanged(teamId, { bucketId, action: 'uploaded', key: validated.key })`

### `app/api/files/handlers/folder.ts`

- `handleCreateFolder`: after `prisma.file.create`, call `publishFileChanged(teamId, { bucketId, action: 'folder-created', key: folderKey })`

### `app/api/files/handlers/metadata.ts`

- `handleUpdateTags`: after `prisma.file.update`, call `publishFileChanged(teamId, { bucketId: file.bucketId, action: 'metadata-updated', key: file.key })`
- `handleToggleFavorite`: no publish (per-user state)

### `app/api/files/route.ts` — DELETE handler

After `prisma.file.delete`, call `publishFileChanged(file.teamId, { bucketId: file.bucketId, action: 'deleted', key: file.key })`

### `app/api/files/route.ts` — PATCH handler

After `prisma.file.update`, call `publishFileChanged(file.teamId, { bucketId: file.bucketId, action: 'moved', key: newKey })`

### `app/dashboard/page.tsx`

Add `tags: ['dashboard-stats']` to the `unstable_cache` options so `revalidateTag` can bust it:

```typescript
unstable_cache(fn, ['dashboard-stats'], { revalidate: 30, tags: ['dashboard-stats'] })
```

---

## 5. Modified Files — Client Side

### `app/dashboard/files/page.tsx`

**Add SSE subscription** — one `useEffect` that depends on `[selectedTeamId, selectedBucketId]`:

```typescript
useEffect(() => {
  if (!selectedTeamId || !selectedBucketId) return
  const evtSource = new EventSource(`/api/events/files?teamId=${selectedTeamId}`)
  evtSource.addEventListener('file-changed', (e) => {
    const payload = JSON.parse(e.data) as FileChangedPayload
    if (payload.bucketId === selectedBucketId) {
      fetchFiles()
    }
  })
  return () => evtSource.close()
}, [selectedTeamId, selectedBucketId, fetchFiles])
```

**Fix `handleAbort`** (same-tab gap): currently does not call `fetchFiles()` after cancellation. Add `fetchFiles()` in the finally/after block so an aborted upload cleans up the optimistically-added file record.

---

## 6. Data Flow

```
User action (upload / delete / move / folder / tag)
        │
        ▼
API handler (app/api/files/handlers/* or route.ts)
        │  mutates DB + S3
        │
        ├─► publishFileChanged(teamId, payload)
        │         │
        │         ├─► revalidateTag('dashboard-stats')   [server cache bust]
        │         │
        │         └─► SSE push to all clients watching teamId
        │                   │
        │                   └─► files page EventSource listener
        │                             │ payload.bucketId matches?
        │                             └─► fetchFiles()   [cross-tab / cross-user]
        │
        └─► success handler in files/page.tsx
                  └─► fetchFiles()                       [same-tab, already wired]
```

---

## 7. Error Handling & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| SSE connection drops | Browser `EventSource` auto-reconnects with exponential backoff |
| User has no active team/bucket | `useEffect` early-returns; no connection opened |
| `publishFileChanged` with no subscribers | No-op (Map lookup returns undefined) |
| `revalidateTag` called outside request context | Next.js throws — only call inside server action or route handler (both satisfied here) |
| Multiple rapid mutations | `fetchFiles()` is debounced via `inFlightRequestKeyRef`; duplicate calls are dropped |
| `handleAbort` leaving stale DB record | `fetchFiles()` after abort re-syncs list with S3 |

---

## 8. Out of Scope

- Cross-server-instance pubsub (Redis, Upstash) — single instance is current deployment
- Presence indicators ("User X is viewing this folder")
- Granular optimistic updates per event type (remove single file without full refetch)
- Dashboard stats live SSE push (30s TTL + `revalidateTag` on next navigation is sufficient)
