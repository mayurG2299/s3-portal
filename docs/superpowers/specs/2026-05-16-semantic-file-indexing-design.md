# Semantic File Indexing & AI Search — Design Spec

**Date:** 2026-05-16  
**Status:** Draft  
**Scope:** Add semantic vector indexing to every uploaded file and expose a natural-language AI search agent that works across all buckets and folders.

---

## 1. Problem Statement

The current search in this S3 portal is purely lexical — it matches on file `name`, `tags`, and `description`. This breaks down in two real scenarios:

1. **Non-technical teammates** don't know the folder structure or the exact filename. They remember *what* a file contained, not what it was called.
2. **Cross-folder discovery** is impossible today. A query like "find the Q4 product demo videos" requires knowing which bucket and folder to look in.

The solution is to semantically understand file content at upload time, store a vector embedding, and expose a natural-language agent that retrieves files by meaning rather than by name.

---

## 2. Goals

- Every newly uploaded file gets a content-aware vector embedding within seconds of upload completing.
- All existing files in the database get backfilled through the same pipeline.
- A `/api/ai/search` endpoint does semantic similarity search scoped to the user's team and bucket permissions.
- A `/api/ai/agent` endpoint wraps search results with a Claude-generated ranked response and per-file explanations.
- The system degrades gracefully: if indexing fails, files are still fully usable; only semantic search is unavailable for that file.

## 3. Non-Goals

- No real-time transcription or streaming results.
- No client-side ML or browser-based processing.
- No changes to the existing keyword search (`/api/search`) — it stays intact and runs in parallel.
- No chat history or multi-turn conversation in v1 (designed for later).
- No GPU infrastructure. All AI calls go through cloud APIs.

---

## 4. Architecture Overview

```
Upload completes
(verify endpoint OR multipart-complete)
          │
          ▼
Enqueue HIGH-priority job ──► Redis / BullMQ queue: "file-indexing"
          │
          ▼                      (runs in same process via instrumentation.ts)
    Worker picks up job
          │
          ├─ image/*      → presigned S3 URL → Claude Vision → summary text
          ├─ video/*      → download audio stream → OpenAI Whisper API → transcript
          ├─ audio/*      → download → OpenAI Whisper API → transcript
          ├─ application/pdf → download → pdf-parse → chunked text
          ├─ text/*, DOCX → download → text extraction
          └─ everything else → filename + tags + description (metadata-only)
                    │
                    ▼
          text-embedding-3-small (1536 dims)
                    │
                    ▼
          FileEmbedding row written to PostgreSQL (pgvector)

─────────────────────────────────────────────

Backfill scheduler (BullMQ repeatable job, every 60s)
  → finds File rows with no FileEmbedding
  → enqueues LOW-priority "file-indexing" jobs (batch of 50)
  → new uploads always jump the queue via priority

─────────────────────────────────────────────

User query: "find the onboarding walkthrough videos"
          │
          ▼
POST /api/ai/agent  (or GET /api/ai/search for raw results)
  → embed query with text-embedding-3-small
  → pgvector cosine similarity, scoped to team + bucket permissions
  → top-20 candidates
  → Claude ranks + explains results
  → return { files[], summary }
```

---

## 5. Data Model

### 5.1 New Prisma model: `FileEmbedding`

```prisma
model FileEmbedding {
  id           String         @id @default(cuid())
  fileId       String         @unique
  summary      String?        // generated text used for embedding (stored for debugging)
  status       IndexingStatus @default(PENDING)
  errorMessage String?
  processedAt  DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  file         File           @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([fileId])
}

enum IndexingStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}
```

The embedding vector itself is stored as a raw `vector(1536)` column via a manual migration (pgvector is not yet natively supported by Prisma's type system). The migration SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "FileEmbedding"
  ADD COLUMN "embedding" vector(1536);

-- Use HNSW (not IVFFlat) — HNSW works on an empty table and requires no
-- minimum row count. IVFFlat requires rows * 3 >= lists to build a useful
-- index; creating it on an empty table produces a non-functional index.
CREATE INDEX file_embedding_vector_idx
  ON "FileEmbedding"
  USING hnsw (embedding vector_cosine_ops);
```

> **Note:** HNSW is available from pgvector 0.5.0 (released 2023-09). Verify the pgvector version in the Dockerfile/docker-compose before running the migration. If constrained to an older version, defer the index creation until after the first batch of rows is inserted.

### 5.2 Change to `File` model

Add the relation (no new columns on `File`):

```prisma
model File {
  // ... existing fields ...
  embedding FileEmbedding?
}
```

### 5.3 Migration strategy

1. Run `prisma migrate dev` to create the `FileEmbedding` table and enum.
2. Run the manual SQL migration to add the `vector(1536)` column and HNSW index.
3. On next server start, the backfill scheduler auto-enqueues all unindexed files.

### 5.4 Column naming in raw SQL

Prisma stores field names as-is in PostgreSQL (camelCase). When writing raw SQL queries against Prisma-managed tables, column names must be double-quoted to preserve case:

| Prisma field | SQL reference |
|---|---|
| `fileId` | `"fileId"` |
| `bucketId` | `"bucketId"` |
| `contentType` | `"contentType"` |
| `parentPath` | `"parentPath"` |
| `processedAt` | `"processedAt"` |

All raw SQL in this spec uses this convention.

---

## 6. Processing Pipeline

### 6.1 Trigger points

Both of these places enqueue a `file-indexing` job after confirming S3 receipt:

| location | trigger |
|---|---|
| `app/api/files/verify/route.ts` | after successful `prisma.file.update` |
| `app/api/files/handlers/upload.ts → handleMultipartComplete` | after `completeMultipartUpload` succeeds |

Job payload:
```ts
interface IndexingJobPayload {
  fileId: string
}
```
The worker loads all other needed data (contentType, key, credential) from the DB.

### 6.2 Worker location

`lib/workers/indexing-worker.ts` — a BullMQ `Worker` instance.

Started from `instrumentation.ts` (Next.js's official hook for server-side side effects at startup). This means no new Docker container is needed initially. When processing load grows, the worker can be extracted to its own `docker-compose` service with no code changes — just point it at the same Redis and Postgres.

**Critical: Node.js runtime guard required.** Next.js 15+ calls `instrumentation.ts`'s `register()` in both the Node.js and Edge runtimes. BullMQ depends on `ioredis` and worker threads — it will crash in the Edge runtime. The guard is mandatory:

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startIndexingWorker } = await import('./lib/workers/indexing-worker')
    const { startBackfillScheduler } = await import('./lib/workers/backfill-scheduler')
    startIndexingWorker()
    startBackfillScheduler()
  }
}
```

**Serverless hosting caveat.** The worker runs as a long-lived Node.js process. This is incompatible with serverless platforms (Vercel, AWS Lambda) where processes are ephemeral. If the app is ever deployed to a serverless host, the worker must be a separate container or process. The current Docker-based deployment (docker-compose) supports this natively. Do not deploy the worker path to Vercel.

### 6.3 Per-type processing logic

**Images (`image/*`)**
- Generate a 15-minute presigned GET URL for the S3 object.
- Send the URL directly to Claude (`claude-haiku-4-5-20251001` — cheap, fast) with prompt: *"Describe the content of this image in 2-3 sentences for a file search index. Be specific about objects, people, text, colors, and context."*
- Use the response as the `summary`. Embed with `text-embedding-3-small`.
- Size limit: skip content extraction if file > 20 MB; fall back to metadata-only.

**Videos (`video/*`)**
- Download the file to a temp buffer (stream, not full load).
- Extract audio using `ffmpeg` via `fluent-ffmpeg` + `ffmpeg-static`.
- Send audio to OpenAI Whisper API (`whisper-1`). Limit: first 25 MB of audio (~30 minutes).
- Prepend filename to transcript for context: `"[filename.mp4] " + transcript`.
- Embed with `text-embedding-3-small`.
- Size limit: skip if audio extraction fails or file > 500 MB; fall back to metadata-only.

> **ffmpeg binary note:** `ffmpeg-static` bundles a platform-specific ffmpeg binary (~60–100 MB added to the Node.js layer). This is acceptable in Docker but must not be included in any serverless or Edge bundle. The video processor must only be imported inside the `NEXT_RUNTIME === 'nodejs'` guard. `next.config.js` should add `fluent-ffmpeg` and `ffmpeg-static` to `serverExternalPackages` to prevent them from being bundled by the Next.js webpack config.

**Audio (`audio/*`)**
- Download → Whisper API → transcript → embed.
- Size limit: 25 MB (Whisper hard limit).

**Documents (`application/pdf`)**
- Download → `pdf-parse` → extract full text → trim to 8000 chars (fits embedding context window).
- Size limit: 50 MB.

**Plain text / DOCX (`text/*`, `application/vnd.openxmlformats-officedocument.*`)**
- Download → read raw text (DOCX: use `mammoth`) → trim to 8000 chars.
- Size limit: 20 MB.

**Everything else (fallback)**
- Metadata-only summary: `"{name}. Tags: {tags.join(', ')}. {description}"`.
- Still produces a meaningful embedding for filename/tag-based similarity.
- No S3 download needed.

### 6.4 Worker error handling

- On any error, set `FileEmbedding.status = FAILED` and write `errorMessage`.
- BullMQ retries up to 3 times with exponential backoff (1s, 5s, 30s).
- After 3 failures, job moves to the dead-letter queue. The file is still fully usable — it just won't appear in semantic search results.
- A `POST /api/admin/indexing/retry-failed` endpoint re-enqueues all FAILED records.

---

## 7. Backfill Strategy

### 7.1 Scheduler

A BullMQ repeatable job (`backfill-scheduler`) runs every 60 seconds and does two things per tick:

**Step 1 — Reset stale PROCESSING rows** (worker crashed mid-job):
```ts
await prisma.fileEmbedding.updateMany({
  where: {
    status: 'PROCESSING',
    updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }, // >10 min ago
  },
  data: { status: 'PENDING' },
})
```

**Step 2 — Enqueue unindexed and stale-metadata files:**
```ts
// Files with no embedding record at all (new or existing)
const unindexed = await prisma.file.findMany({
  where: { embedding: null },
  take: 50,
  orderBy: { createdAt: 'asc' },
})

// Files whose tags/description changed after their last indexing run
const staleMetadata = await prisma.file.findMany({
  where: {
    embedding: {
      status: 'DONE',
      processedAt: { lt: prisma.file.fields.updatedAt }, // updatedAt > processedAt
    },
  },
  take: 20,
  orderBy: { updatedAt: 'desc' },
})

for (const file of [...unindexed, ...staleMetadata]) {
  await queue.add('file-indexing', { fileId: file.id }, { priority: 10 })
}
```

> **Note on stale-metadata query:** Prisma does not support cross-field comparisons natively. This comparison (`updatedAt > processedAt`) must be done via `$queryRaw` in the actual implementation. The pseudo-code above conveys intent.

Priority values: new uploads = `1` (HIGH), backfill = `10` (LOW). BullMQ processes lower numbers first.

### 7.2 Resumability

No external state needed. On every tick, the query re-reads from the DB. If the server restarts mid-backfill, the next tick finds the same unindexed files and re-enqueues them. Stale PROCESSING rows are reset in the same tick (Step 1 above).

### 7.3 Rate limiting

To avoid hitting OpenAI/Anthropic rate limits during large backfills:
- Batch size: 50 files per minute = ~3000/hour.
- BullMQ concurrency on the worker: `concurrency: 3` (3 files processed simultaneously).
- Both values are env-var configurable: `INDEXING_BATCH_SIZE`, `INDEXING_CONCURRENCY`.

### 7.4 Cost estimate

Rough numbers for a 10,000-file backfill:
- Images (assume 40%): 4000 × Claude Haiku vision call (~$0.002 each) = ~$8
- Documents/text (assume 40%): 4000 × embedding call (~$0.0001 each) = ~$0.40
- Videos/audio (assume 20%): 2000 × Whisper call (~$0.006/min, assume 5min avg) = ~$60
- **Total rough estimate: ~$70 for 10k files**

These numbers scale linearly. An admin can pause the backfill at any time.

---

## 8. Search & Agent API

### 8.1 `GET /api/ai/search`

Fast semantic retrieval, no AI call, returns raw results.

**Query params:**
- `q` — natural language query (required)
- `teamId`, `bucketId`, `identityId` — same scoping as existing `/api/search`
- `limit` — default 20, max 50

**Flow:**
1. Auth + scope resolution (identical to existing `/api/search`).
2. Embed `q` with `text-embedding-3-small`.
3. Raw SQL via Prisma `$queryRaw` (note: all column names are double-quoted camelCase per section 5.4):
   ```sql
   SELECT f.id, f.name, f.key, f."contentType", f."parentPath",
          1 - (fe.embedding <=> $1::vector) AS score
   FROM "File" f
   JOIN "FileEmbedding" fe ON fe."fileId" = f.id
   WHERE fe.status = 'DONE'
     AND fe.embedding IS NOT NULL
     AND f."bucketId" = ANY($2)   -- bucket scope
   ORDER BY fe.embedding <=> $1::vector
   LIMIT $3
   ```
4. Return `{ results: [{ ...file, semanticScore: number }] }`.

### 8.2 `POST /api/ai/agent`

Semantic search + Claude ranking + explanations.

**Request body:**
```ts
{
  query: string          // "find the product onboarding videos from last quarter"
  teamId?: string
  bucketId?: string
  limit?: number         // default 10
}
```

**Flow:**
1. Run semantic search (section 8.1) to get top-20 candidates.
2. Build a Claude prompt:
   ```
   System: You are a file search assistant. Given a user query and a list of candidate files
   with their summaries, rank the most relevant files and explain why each matches.
   Return JSON: { files: [{ id, reason }], summary: string }

   User query: "{query}"

   Candidates:
   1. {name} — {summary}
   2. ...
   ```
3. Parse Claude's JSON response, merge `reason` into the file objects.
4. Return `{ files: [{ ...file, reason: string }], summary: string }`.

**Claude model:** `claude-haiku-4-5-20251001` (exact API string). Upgrade path to `claude-sonnet-4-6` if ranking quality is insufficient.

### 8.3 Authentication & rate limiting on AI endpoints

Both `/api/ai/search` and `/api/ai/agent` require a valid session (`getServerSession`) — unauthenticated requests return 401. Each request to `/api/ai/agent` makes two external API calls (OpenAI embed + Claude). To prevent cost abuse:

- Per-user rate limit: max 30 requests/minute to `/api/ai/agent`, enforced via a Redis counter (`INCR` + `EXPIRE`).
- Per-user rate limit: max 120 requests/minute to `/api/ai/search` (embed-only, cheaper).
- Return 429 with `Retry-After` header when limit exceeded.

The Redis client (`ioredis`) already exists in the project for this.

### 8.4 Existing `/api/search` unchanged

The keyword search stays as-is. The UI will offer both paths — keyword for exact matches, semantic for natural language. The choice can be automatic (short exact queries → keyword, longer natural language queries → semantic) or explicit via a toggle.

---

## 9. Admin Endpoints

| endpoint | method | description |
|---|---|---|
| `/api/admin/indexing/status` | GET | Returns `{ total, indexed, pending, failed, percentComplete }` |
| `/api/admin/indexing/pause` | POST | Pauses the backfill repeatable job |
| `/api/admin/indexing/resume` | POST | Resumes the backfill repeatable job |
| `/api/admin/indexing/retry-failed` | POST | Re-enqueues all FAILED FileEmbedding records |

All require admin role (existing RBAC `ADMIN_SETTINGS` permission).

---

## 10. New Dependencies

| package | purpose |
|---|---|
| `bullmq` | Job queue over Redis |
| `openai` | Whisper API + text-embedding-3-small |
| `@anthropic-ai/sdk` | Claude Vision (image captioning) + agent ranking |
| `pdf-parse` | PDF text extraction |
| `mammoth` | DOCX text extraction |
| `fluent-ffmpeg` + `ffmpeg-static` | Audio extraction from video files |

No new infrastructure. pgvector is a Postgres extension (already containerized).

---

## 11. File & Folder Structure

```
lib/
  workers/
    indexing-worker.ts       ← BullMQ Worker definition
    backfill-scheduler.ts    ← repeatable job that finds unindexed files
  indexing/
    queue.ts                 ← shared BullMQ Queue instance
    processors/
      image.ts               ← Claude Vision → summary
      video.ts               ← ffmpeg + Whisper → transcript
      audio.ts               ← Whisper → transcript
      document.ts            ← pdf-parse / mammoth → text
      metadata.ts            ← fallback: name + tags + description
    embed.ts                 ← calls text-embedding-3-small, returns Float32Array
    store.ts                 ← writes/updates FileEmbedding row

app/
  api/
    ai/
      search/route.ts        ← GET semantic search
      agent/route.ts         ← POST natural language agent
    admin/
      indexing/
        status/route.ts
        pause/route.ts
        resume/route.ts
        retry-failed/route.ts

instrumentation.ts           ← starts worker + backfill scheduler on server boot

prisma/
  migrations/
    YYYYMMDD_add_file_embedding/
      migration.sql          ← FileEmbedding table + pgvector extension + HNSW index
```

---

## 12. Environment Variables

```env
# AI APIs
OPENAI_API_KEY=              # embeddings (text-embedding-3-small) + Whisper
ANTHROPIC_API_KEY=           # Claude Vision + agent ranking

# Indexing tuning
INDEXING_BATCH_SIZE=50       # files per backfill tick
INDEXING_CONCURRENCY=3       # parallel worker slots
INDEXING_MAX_IMAGE_MB=20
INDEXING_MAX_VIDEO_MB=500
INDEXING_MAX_DOC_MB=50

# Redis (already exists in the project)
REDIS_URL=redis://localhost:6379
```

---

## 13. Error Handling & Degradation

| scenario | behaviour |
|---|---|
| File not in S3 yet when job runs | job fails → retry (file usually lands within seconds) |
| AI API rate limit hit | BullMQ retry with backoff; backfill pauses naturally |
| AI API down | jobs stay in queue, retry automatically when API recovers |
| File too large for content extraction | falls back to metadata-only embedding |
| pgvector extension not installed | migration fails with clear error before deploy |
| No embedding for a file | file excluded from semantic results; still appears in keyword search |
| Worker crashes mid-job | PROCESSING rows older than 10 min reset to PENDING on next startup |

---

## 14. Testing Plan

- **Unit:** each processor (`image.ts`, `video.ts`, etc.) with mocked AI SDK calls.
- **Integration:** enqueue a job → worker processes it → assert `FileEmbedding.status = DONE` and embedding is non-null.
- **Backfill:** seed 5 files with no embedding → run scheduler tick → assert all 5 are enqueued.
- **Search:** insert known embeddings for test files → query with a semantically related phrase → assert correct files ranked first.
- **Agent:** mock Claude response → assert `reason` fields are merged onto file objects.
- **Degradation:** mock API 429 → assert job retries and status stays PENDING (not FAILED prematurely).

---

## 15. Open Questions / Future Work

1. **Chunked embeddings for long documents** — for very long PDFs, a single embedding loses detail. Future: chunk into 500-word segments, store multiple embeddings per file, aggregate scores at query time.
2. **Conversational agent (v2)** — multi-turn chat with follow-up questions ("which team?", "which date range?") using Claude's tool use.
3. **Self-hosted models** — once volume justifies it, swap `text-embedding-3-small` for `nomic-embed-text` on a local model server. The `embed.ts` module is the only change point.
4. **Clustering UI** — run k-means or HDBSCAN on the embeddings to auto-group files into topic clusters and surface them in the file browser.
