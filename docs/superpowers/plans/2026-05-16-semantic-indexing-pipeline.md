# Semantic File Indexing & AI Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index every uploaded file semantically using BullMQ + OpenAI + Claude, then expose natural-language AI search via `GET /api/ai/search` and a ranked agent via `POST /api/ai/agent`.

**Architecture:** BullMQ (Redis-backed) workers consume `file-indexing` jobs. Each job extracts content based on MIME type (Claude Vision for images, Whisper for audio/video, pdf-parse/mammoth for documents, metadata fallback for everything else), generates a text summary, embeds it with OpenAI `text-embedding-3-small` (1536 dims), and stores it as a pgvector `vector(1536)` in a new `FileEmbedding` table. A repeatable backfill job indexes existing files. Two AI endpoints cover raw semantic search and Claude-ranked results. Admin endpoints cover status, pause, resume, and retry-failed. The worker starts in `instrumentation.ts` (Node.js runtime only — not Edge).

**Tech Stack:** BullMQ + ioredis, OpenAI SDK (`text-embedding-3-small` + Whisper), `@anthropic-ai/sdk` (Claude Haiku), pgvector PostgreSQL extension, pdf-parse, mammoth, fluent-ffmpeg + ffmpeg-static, Next.js `instrumentation.ts`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/indexing/queue.ts` | BullMQ Queue singleton + `enqueueFileIndexing()` |
| Create | `lib/indexing/embed.ts` | OpenAI `text-embedding-3-small` wrapper |
| Create | `lib/indexing/store.ts` | `FileEmbedding` DB read/write (including raw vector upsert) |
| Create | `lib/indexing/processors/metadata.ts` | Fallback: name + tags + description |
| Create | `lib/indexing/processors/document.ts` | PDF / DOCX / plain text extraction |
| Create | `lib/indexing/processors/image.ts` | Claude Vision → summary |
| Create | `lib/indexing/processors/audio.ts` | Whisper transcript |
| Create | `lib/indexing/processors/video.ts` | ffmpeg audio extract → Whisper |
| Create | `lib/workers/indexing-worker.ts` | BullMQ Worker: dispatches to processors, embeds, stores |
| Create | `lib/workers/backfill-scheduler.ts` | Repeatable job: enqueues unindexed + stale files |
| Create | `app/api/ai/search/route.ts` | GET semantic search (pgvector cosine similarity) |
| Create | `app/api/ai/agent/route.ts` | POST natural language agent (search + Claude ranking) |
| Create | `app/api/admin/indexing/status/route.ts` | Indexing stats |
| Create | `app/api/admin/indexing/pause/route.ts` | Pause backfill |
| Create | `app/api/admin/indexing/resume/route.ts` | Resume backfill |
| Create | `app/api/admin/indexing/retry-failed/route.ts` | Re-enqueue FAILED rows |
| Create | `instrumentation.ts` | Start worker + backfill at server boot (Node.js only) |
| Create | `__tests__/lib/indexing/embed.test.ts` | Unit: embed.ts |
| Create | `__tests__/lib/indexing/store.test.ts` | Unit: store.ts |
| Create | `__tests__/lib/indexing/processors/metadata.test.ts` | Unit |
| Create | `__tests__/lib/indexing/processors/document.test.ts` | Unit |
| Create | `__tests__/lib/indexing/processors/image.test.ts` | Unit |
| Create | `__tests__/lib/indexing/processors/audio.test.ts` | Unit |
| Create | `__tests__/lib/indexing/processors/video.test.ts` | Unit |
| Create | `__tests__/lib/workers/indexing-worker.test.ts` | Unit |
| Create | `__tests__/lib/workers/backfill-scheduler.test.ts` | Unit |
| Create | `__tests__/api/ai-search.test.ts` | Unit: search route |
| Create | `__tests__/api/ai-agent.test.ts` | Unit: agent route |
| Modify | `prisma/schema.prisma` | Add `FileEmbedding` model + `IndexingStatus` enum + relation on `File` |
| Modify | `app/api/files/handlers/upload.ts` | Call `enqueueFileIndexing` in `handleMultipartComplete` |
| Modify | `app/api/files/verify/route.ts` | Call `enqueueFileIndexing` after `prisma.file.update` |
| Modify | `next.config.js` | Add `serverExternalPackages` for ffmpeg |

---

## Task 1: Install npm dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install bullmq openai @anthropic-ai/sdk pdf-parse mammoth fluent-ffmpeg ffmpeg-static
```

- [ ] **Step 2: Install type definitions**

```bash
npm install --save-dev @types/pdf-parse @types/fluent-ffmpeg
```

- [ ] **Step 3: Verify no peer conflict**

```bash
npm ls bullmq openai @anthropic-ai/sdk 2>&1 | head -20
```

Expected: versions printed, no `UNMET PEER DEPENDENCY` errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install BullMQ, OpenAI, Anthropic SDK, pdf-parse, mammoth, ffmpeg deps"
```

---

## Task 2: Prisma schema — FileEmbedding model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `IndexingStatus` enum and `FileEmbedding` model**

In `prisma/schema.prisma`, append before the closing of the file (after the last `enum` block):

```prisma
enum IndexingStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model FileEmbedding {
  id           String         @id @default(cuid())
  fileId       String         @unique
  summary      String?
  status       IndexingStatus @default(PENDING)
  errorMessage String?
  processedAt  DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  file         File           @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([fileId])
}
```

- [ ] **Step 2: Add `embedding` relation to `File` model**

In `prisma/schema.prisma`, inside the `File` model block add after `links Link[]`:

```prisma
  embedding    FileEmbedding?
```

- [ ] **Step 3: Run Prisma migration**

```bash
npx prisma migrate dev --name add_file_embedding
```

Expected: new migration folder created under `prisma/migrations/`, no errors.

- [ ] **Step 4: Verify generated client includes FileEmbedding**

```bash
npx prisma generate && grep -r "FileEmbedding" node_modules/.prisma/client/index.d.ts | head -3
```

Expected: type definitions for `FileEmbedding` are present.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add FileEmbedding model and IndexingStatus enum"
```

---

## Task 3: pgvector SQL migration

**Files:**
- Create: `prisma/migrations/20260516_add_pgvector/migration.sql`

The `vector(1536)` column and HNSW index cannot be created by Prisma's schema DSL — they require raw SQL.

- [ ] **Step 1: Create the manual migration file**

Create directory and file:

```bash
mkdir -p prisma/migrations/20260516_add_pgvector
```

Write `prisma/migrations/20260516_add_pgvector/migration.sql`:

```sql
-- Enable pgvector extension (requires PostgreSQL 11+ and pgvector installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to the FileEmbedding table created by Prisma
ALTER TABLE "FileEmbedding"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- HNSW index: works on empty tables, no minimum row requirement
-- vector_cosine_ops enables <=> (cosine distance) similarity queries
CREATE INDEX IF NOT EXISTS file_embedding_vector_idx
  ON "FileEmbedding"
  USING hnsw (embedding vector_cosine_ops);
```

- [ ] **Step 2: Apply the migration**

```bash
psql $DATABASE_URL -f prisma/migrations/20260516_add_pgvector/migration.sql
```

Expected: `CREATE EXTENSION`, `ALTER TABLE`, `CREATE INDEX` printed, no errors.
If pgvector is not installed: `ERROR: extension "vector" is not available` — install pgvector on the database server first.

- [ ] **Step 3: Verify column and index exist**

```bash
psql $DATABASE_URL -c "\d \"FileEmbedding\""
```

Expected: output includes `embedding | vector(1536)` column and `file_embedding_vector_idx`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260516_add_pgvector/
git commit -m "feat(db): add pgvector extension, vector(1536) column and HNSW index on FileEmbedding"
```

---

## Task 4: BullMQ queue singleton

**Files:**
- Create: `lib/indexing/queue.ts`

No tests needed — this is pure configuration/wiring. Tested indirectly through worker and trigger point tests.

- [ ] **Step 1: Create `lib/indexing/queue.ts`**

```typescript
import { Queue } from 'bullmq'

export interface IndexingJobPayload {
  fileId: string
}

export let fileIndexingQueue: Queue<IndexingJobPayload> | null = null

if (process.env.REDIS_URL) {
  fileIndexingQueue = new Queue<IndexingJobPayload>('file-indexing', {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  })
}

export async function enqueueFileIndexing(fileId: string, priority = 1): Promise<void> {
  if (!fileIndexingQueue) return
  await fileIndexingQueue.add('file-indexing', { fileId }, { priority })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/indexing/queue.ts
git commit -m "feat(indexing): add BullMQ queue singleton with graceful no-op when Redis is absent"
```

---

## Task 5: Embedding utility

**Files:**
- Create: `lib/indexing/embed.ts`
- Create: `__tests__/lib/indexing/embed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/indexing/embed.test.ts`:

```typescript
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }],
      }),
    },
  })),
}))

import { embedText } from '@/lib/indexing/embed'

describe('embedText', () => {
  // Capture the mock before clearAllMocks() wipes mock.results (constructor ran at module load)
  let mockCreate: jest.Mock
  beforeAll(() => {
    const OpenAI = require('openai').default
    mockCreate = OpenAI.mock.results[0].value.embeddings.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns a 1536-element number array', async () => {
    const result = await embedText('find the Q4 product demo')
    expect(result).toHaveLength(1536)
    expect(typeof result[0]).toBe('number')
  })

  it('trims input to 8000 characters before sending', async () => {
    const longInput = 'x'.repeat(10000)
    await embedText(longInput)
    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.input.length).toBeLessThanOrEqual(8000)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest __tests__/lib/indexing/embed.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/embed'`

- [ ] **Step 3: Create `lib/indexing/embed.ts`**

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest __tests__/lib/indexing/embed.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/embed.ts __tests__/lib/indexing/embed.test.ts
git commit -m "feat(indexing): add embedText utility wrapping OpenAI text-embedding-3-small"
```

---

## Task 6: Embedding store

**Files:**
- Create: `lib/indexing/store.ts`
- Create: `__tests__/lib/indexing/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/indexing/store.test.ts`:

```typescript
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}))

import { prisma } from '@/lib/db'
import { setProcessing, setDone, setFailed } from '@/lib/indexing/store'

describe('store', () => {
  beforeEach(() => jest.clearAllMocks())

  it('setProcessing upserts with PROCESSING status', async () => {
    await setProcessing('file-1')
    expect(prisma.fileEmbedding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fileId: 'file-1' },
        create: expect.objectContaining({ fileId: 'file-1', status: 'PROCESSING' }),
        update: expect.objectContaining({ status: 'PROCESSING' }),
      })
    )
  })

  it('setDone calls $executeRaw to write the vector', async () => {
    const embedding = Array(1536).fill(0.5)
    await setDone('file-1', 'a summary', embedding)
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })

  it('setFailed updates status to FAILED with errorMessage', async () => {
    await setFailed('file-1', 'API timeout')
    expect(prisma.fileEmbedding.update).toHaveBeenCalledWith({
      where: { fileId: 'file-1' },
      data: { status: 'FAILED', errorMessage: 'API timeout' },
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/indexing/store.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/store'`

- [ ] **Step 3: Create `lib/indexing/store.ts`**

```typescript
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function setProcessing(fileId: string): Promise<void> {
  await prisma.fileEmbedding.upsert({
    where: { fileId },
    create: { fileId, status: 'PROCESSING' },
    update: { status: 'PROCESSING', errorMessage: null },
  })
}

export async function setDone(fileId: string, summary: string, embedding: number[]): Promise<void> {
  // embedding is number[] from OpenAI — all floats, no SQL injection risk
  const vectorStr = `[${embedding.join(',')}]`
  await prisma.$executeRaw`
    UPDATE "FileEmbedding"
    SET summary = ${summary},
        status = 'DONE'::"IndexingStatus",
        embedding = ${Prisma.raw(`'${vectorStr}'::vector`)},
        "processedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "fileId" = ${fileId}
  `
}

export async function setFailed(fileId: string, errorMessage: string): Promise<void> {
  await prisma.fileEmbedding.update({
    where: { fileId },
    data: { status: 'FAILED', errorMessage },
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/indexing/store.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/store.ts __tests__/lib/indexing/store.test.ts
git commit -m "feat(indexing): add store helpers for FileEmbedding status transitions and vector write"
```

---

## Task 7: Metadata processor (fallback)

**Files:**
- Create: `lib/indexing/processors/metadata.ts`
- Create: `__tests__/lib/indexing/processors/metadata.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/indexing/processors/metadata.test.ts`:

```typescript
import { processMetadata } from '@/lib/indexing/processors/metadata'

describe('processMetadata', () => {
  it('formats name, tags and description', () => {
    const file = { name: 'report.pdf', tags: ['q4', 'finance'], description: 'Annual report' }
    const result = processMetadata(file as any)
    expect(result).toContain('report.pdf')
    expect(result).toContain('q4')
    expect(result).toContain('finance')
    expect(result).toContain('Annual report')
  })

  it('handles missing tags and description gracefully', () => {
    const file = { name: 'photo.jpg', tags: [], description: null }
    const result = processMetadata(file as any)
    expect(result).toBe('photo.jpg')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest __tests__/lib/indexing/processors/metadata.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/processors/metadata'`

- [ ] **Step 3: Create `lib/indexing/processors/metadata.ts`**

```typescript
interface FileRecord {
  name: string
  tags: string[]
  description: string | null
}

export function processMetadata(file: FileRecord): string {
  const parts = [file.name]
  if (file.tags.length > 0) parts.push(file.tags.join(', '))
  if (file.description) parts.push(file.description)
  return parts.join('. ')
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest __tests__/lib/indexing/processors/metadata.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/processors/metadata.ts __tests__/lib/indexing/processors/metadata.test.ts
git commit -m "feat(indexing): add metadata fallback processor"
```

---

## Task 8: Document processor (PDF / DOCX / text)

**Files:**
- Create: `lib/indexing/processors/document.ts`
- Create: `__tests__/lib/indexing/processors/document.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/indexing/processors/document.test.ts`:

```typescript
jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))
jest.mock('pdf-parse', () => jest.fn())
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }))

import { getS3ObjectBody } from '@/lib/aws'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { processDocument } from '@/lib/indexing/processors/document'
import { Readable } from 'stream'

function makeStream(content: string) {
  return Readable.from([Buffer.from(content)])
}

describe('processDocument', () => {
  beforeEach(() => jest.clearAllMocks())

  it('extracts text from a PDF and trims to 8000 chars', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('pdf-bytes'))
    ;(pdfParse as jest.Mock).mockResolvedValue({ text: 'PDF content here' })
    const file = { name: 'doc.pdf', contentType: 'application/pdf', key: 'docs/doc.pdf' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('PDF content here')
  })

  it('extracts text from a DOCX file', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('docx-bytes'))
    ;(mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'DOCX content' })
    const file = {
      name: 'report.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      key: 'docs/report.docx',
    }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('DOCX content')
  })

  it('reads raw text for text/plain content type', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('plain text content'))
    const file = { name: 'readme.txt', contentType: 'text/plain', key: 'readme.txt' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('plain text content')
  })

  it('returns null on extraction error', async () => {
    ;(getS3ObjectBody as jest.Mock).mockRejectedValue(new Error('S3 error'))
    const file = { name: 'bad.pdf', contentType: 'application/pdf', key: 'bad.pdf' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/indexing/processors/document.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/processors/document'`

- [ ] **Step 3: Create `lib/indexing/processors/document.ts`**

```typescript
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'
import { Readable } from 'stream'

const MAX_CHARS = 8000

interface FileRecord {
  name: string
  key: string
  contentType: string | null
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function processDocument(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  try {
    const stream = await getS3ObjectBody(awsConfig, file.key)
    const buffer = await streamToBuffer(stream)
    const ct = (file.contentType || '').toLowerCase()

    if (ct === 'application/pdf') {
      const parsed = await pdfParse(buffer)
      return parsed.text.slice(0, MAX_CHARS) || null
    }

    if (ct.includes('officedocument.wordprocessingml')) {
      const { value } = await mammoth.extractRawText({ buffer })
      return value.slice(0, MAX_CHARS) || null
    }

    // text/*
    return buffer.toString('utf-8').slice(0, MAX_CHARS) || null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/indexing/processors/document.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/processors/document.ts __tests__/lib/indexing/processors/document.test.ts
git commit -m "feat(indexing): add document processor (PDF/DOCX/text via pdf-parse and mammoth)"
```

---

## Task 9: Image processor (Claude Vision)

**Files:**
- Create: `lib/indexing/processors/image.ts`
- Create: `__tests__/lib/indexing/processors/image.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/indexing/processors/image.test.ts`:

```typescript
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'A screenshot of a dashboard with charts.' }],
      }),
    },
  })),
}))
jest.mock('@/lib/aws', () => ({
  generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}))

import { processImage } from '@/lib/indexing/processors/image'

describe('processImage', () => {
  let mockMessagesCreate: jest.Mock
  beforeAll(() => {
    const Anthropic = require('@anthropic-ai/sdk').default
    mockMessagesCreate = Anthropic.mock.results[0].value.messages.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns Claude description for an image file', async () => {
    const file = { name: 'dashboard.png', key: 'imgs/dashboard.png', contentType: 'image/png', size: BigInt(1024 * 1024) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBe('A screenshot of a dashboard with charts.')
  })

  it('returns null for files over 20 MB', async () => {
    const file = { name: 'huge.png', key: 'imgs/huge.png', contentType: 'image/png', size: BigInt(21 * 1024 * 1024) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBeNull()
  })

  it('returns null if Claude call throws', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('rate limit'))
    const file = { name: 'img.jpg', key: 'imgs/img.jpg', contentType: 'image/jpeg', size: BigInt(1000) }
    const result = await processImage(file as any, {} as any)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/indexing/processors/image.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/processors/image'`

- [ ] **Step 3: Create `lib/indexing/processors/image.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { generatePresignedDownloadUrl } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'

const MAX_IMAGE_BYTES = (parseInt(process.env.INDEXING_MAX_IMAGE_MB || '20', 10)) * 1024 * 1024
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

export async function processImage(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_IMAGE_BYTES) return null

  try {
    const url = await generatePresignedDownloadUrl(awsConfig, file.key, 900) // 15 min
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url } },
            {
              type: 'text',
              text: 'Describe the content of this image in 2-3 sentences for a file search index. Be specific about objects, people, text, colors, and context.',
            },
          ],
        },
      ],
    })
    const block = message.content[0]
    return block.type === 'text' ? block.text : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/indexing/processors/image.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/processors/image.ts __tests__/lib/indexing/processors/image.test.ts
git commit -m "feat(indexing): add image processor using Claude Vision"
```

---

## Task 10: Audio processor (Whisper)

**Files:**
- Create: `lib/indexing/processors/audio.ts`
- Create: `__tests__/lib/indexing/processors/audio.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/indexing/processors/audio.test.ts`:

```typescript
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'Hello from the audio file' }),
      },
    },
  })),
}))
jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))

import { getS3ObjectBody } from '@/lib/aws'
import { processAudio } from '@/lib/indexing/processors/audio'
import { Readable } from 'stream'

describe('processAudio', () => {
  let mockTranscriptionsCreate: jest.Mock
  beforeAll(() => {
    const OpenAI = require('openai').default
    mockTranscriptionsCreate = OpenAI.mock.results[0].value.audio.transcriptions.create
  })
  beforeEach(() => jest.clearAllMocks())

  it('returns Whisper transcript', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('audio-bytes')]))
    const file = { name: 'podcast.mp3', key: 'audio/podcast.mp3', contentType: 'audio/mpeg', size: BigInt(1000) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBe('Hello from the audio file')
  })

  it('returns null for files over 25 MB', async () => {
    const file = { name: 'big.mp3', key: 'audio/big.mp3', contentType: 'audio/mpeg', size: BigInt(26 * 1024 * 1024) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBeNull()
  })

  it('returns null when Whisper throws', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('bytes')]))
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error('API error'))
    const file = { name: 'audio.mp3', key: 'audio/audio.mp3', contentType: 'audio/mpeg', size: BigInt(100) }
    const result = await processAudio(file as any, {} as any)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/indexing/processors/audio.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/processors/audio'`

- [ ] **Step 3: Create `lib/indexing/processors/audio.ts`**

```typescript
import OpenAI from 'openai'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'
import { Readable } from 'stream'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // Whisper hard limit
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function processAudio(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_AUDIO_BYTES) return null

  try {
    const stream = await getS3ObjectBody(awsConfig, file.key)
    const buffer = await streamToBuffer(stream)
    const audioFile = new File([buffer], file.name, { type: file.contentType || 'audio/mpeg' })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })
    return transcription.text || null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/indexing/processors/audio.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/processors/audio.ts __tests__/lib/indexing/processors/audio.test.ts
git commit -m "feat(indexing): add audio processor using OpenAI Whisper"
```

---

## Task 11: Video processor (ffmpeg + Whisper)

**Files:**
- Create: `lib/indexing/processors/video.ts`
- Create: `__tests__/lib/indexing/processors/video.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/indexing/processors/video.test.ts`:

```typescript
jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn().mockReturnValue({
    noVideo: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockImplementation((dest) => {
      // Simulate writing audio data then ending
      process.nextTick(() => {
        dest.write(Buffer.from('audio-bytes'))
        dest.end()
      })
      return dest
    }),
  })
  mockFfmpeg.setFfmpegPath = jest.fn()
  return { default: mockFfmpeg, __esModule: true }
})
jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg')
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'video transcript' }),
      },
    },
  })),
}))

import { getS3ObjectBody } from '@/lib/aws'
import { processVideo } from '@/lib/indexing/processors/video'
import { Readable } from 'stream'

describe('processVideo', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns transcript prefixed with filename', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(Readable.from([Buffer.from('video-bytes')]))
    const file = { name: 'demo.mp4', key: 'vids/demo.mp4', contentType: 'video/mp4', size: BigInt(1024) }
    const result = await processVideo(file as any, {} as any)
    expect(result).toContain('demo.mp4')
    expect(result).toContain('video transcript')
  })

  it('returns null for files over 500 MB', async () => {
    const file = { name: 'huge.mp4', key: 'vids/huge.mp4', contentType: 'video/mp4', size: BigInt(501 * 1024 * 1024) }
    const result = await processVideo(file as any, {} as any)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/indexing/processors/video.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/indexing/processors/video'`

- [ ] **Step 3: Create `lib/indexing/processors/video.ts`**

```typescript
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import OpenAI from 'openai'
import { PassThrough } from 'stream'
import { getS3ObjectBody } from '@/lib/aws'
import type { AWSConfig } from '@/lib/aws'
import { Readable } from 'stream'

ffmpeg.setFfmpegPath(ffmpegStatic as string)

const MAX_VIDEO_BYTES = (parseInt(process.env.INDEXING_MAX_VIDEO_MB || '500', 10)) * 1024 * 1024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface FileRecord {
  name: string
  key: string
  contentType: string | null
  size: bigint
}

function extractAudio(videoStream: Readable): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const passThrough = new PassThrough()
    const chunks: Buffer[] = []
    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passThrough.on('end', () => resolve(Buffer.concat(chunks)))
    passThrough.on('error', () => resolve(null))
    ffmpeg(videoStream)
      .noVideo()
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('error', () => resolve(null))
      .pipe(passThrough)
  })
}

export async function processVideo(file: FileRecord, awsConfig: AWSConfig): Promise<string | null> {
  if (Number(file.size) > MAX_VIDEO_BYTES) return null

  try {
    const videoStream = await getS3ObjectBody(awsConfig, file.key)
    const audioBuffer = await extractAudio(videoStream)
    if (!audioBuffer || audioBuffer.length === 0) return null

    const audioFile = new File([audioBuffer], `${file.name}.mp3`, { type: 'audio/mpeg' })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })
    return `[${file.name}] ${transcription.text}`
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/indexing/processors/video.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/indexing/processors/video.ts __tests__/lib/indexing/processors/video.test.ts
git commit -m "feat(indexing): add video processor using fluent-ffmpeg audio extraction + Whisper"
```

---

## Task 12: Indexing worker

**Files:**
- Create: `lib/workers/indexing-worker.ts`
- Create: `__tests__/lib/workers/indexing-worker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/workers/indexing-worker.test.ts`:

```typescript
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name, processor) => {
    return { on: jest.fn(), processor }
  }),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    file: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'file-1',
        name: 'test.pdf',
        key: 'test.pdf',
        contentType: 'application/pdf',
        size: BigInt(1000),
        tags: [],
        description: null,
        credential: { encryptedAccessKey: 'enc', encryptedSecretKey: 'enc2', region: 'us-east-1' },
        bucket: { bucket: 'my-bucket', cloudfrontDomain: null },
      }),
    },
  },
}))
jest.mock('@/lib/aws', () => ({ decryptAWSConfig: jest.fn().mockReturnValue({}) }))
jest.mock('@/lib/indexing/store', () => ({
  setProcessing: jest.fn().mockResolvedValue(undefined),
  setDone: jest.fn().mockResolvedValue(undefined),
  setFailed: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/indexing/embed', () => ({
  embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
}))
jest.mock('@/lib/indexing/processors/document', () => ({
  processDocument: jest.fn().mockResolvedValue('extracted text from doc'),
}))
jest.mock('@/lib/indexing/processors/image', () => ({ processImage: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/audio', () => ({ processAudio: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/video', () => ({ processVideo: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/indexing/processors/metadata', () => ({
  processMetadata: jest.fn().mockReturnValue('test.pdf'),
}))

import { Worker } from 'bullmq'
import { setProcessing, setDone } from '@/lib/indexing/store'
import { embedText } from '@/lib/indexing/embed'

describe('startIndexingWorker', () => {
  it('does not start worker when REDIS_URL is absent', () => {
    delete process.env.REDIS_URL
    const { startIndexingWorker } = require('@/lib/workers/indexing-worker')
    startIndexingWorker()
    expect(Worker).not.toHaveBeenCalled()
  })

  it('processes a PDF file: setProcessing → processDocument → embedText → setDone', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    jest.resetModules()
    // Re-apply mocks after resetModules
    jest.mock('bullmq', () => ({
      Worker: jest.fn().mockImplementation((_name, processor) => ({ on: jest.fn(), _processor: processor })),
    }))
    jest.mock('@/lib/db', () => ({
      prisma: { file: { findUnique: jest.fn().mockResolvedValue({ id: 'file-1', name: 'doc.pdf', key: 'doc.pdf', contentType: 'application/pdf', size: BigInt(500), tags: [], description: null, credential: {}, bucket: {} }) } },
    }))
    jest.mock('@/lib/aws', () => ({ decryptAWSConfig: jest.fn().mockReturnValue({}) }))
    jest.mock('@/lib/indexing/store', () => ({ setProcessing: jest.fn().mockResolvedValue(undefined), setDone: jest.fn().mockResolvedValue(undefined), setFailed: jest.fn() }))
    jest.mock('@/lib/indexing/embed', () => ({ embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)) }))
    jest.mock('@/lib/indexing/processors/document', () => ({ processDocument: jest.fn().mockResolvedValue('doc text') }))
    jest.mock('@/lib/indexing/processors/image', () => ({ processImage: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/audio', () => ({ processAudio: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/video', () => ({ processVideo: jest.fn().mockResolvedValue(null) }))
    jest.mock('@/lib/indexing/processors/metadata', () => ({ processMetadata: jest.fn().mockReturnValue('doc.pdf') }))

    const { startIndexingWorker } = require('@/lib/workers/indexing-worker')
    const worker = startIndexingWorker()
    // Call the processor directly
    await worker._processor({ data: { fileId: 'file-1' } })

    const { setProcessing: sp, setDone: sd } = require('@/lib/indexing/store')
    const { embedText: et } = require('@/lib/indexing/embed')
    expect(sp).toHaveBeenCalledWith('file-1')
    expect(et).toHaveBeenCalledWith('doc text')
    expect(sd).toHaveBeenCalledWith('file-1', 'doc text', expect.any(Array))
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/workers/indexing-worker.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/workers/indexing-worker'`

- [ ] **Step 3: Create `lib/workers/indexing-worker.ts`**

```typescript
import { Worker } from 'bullmq'
import { prisma } from '@/lib/db'
import { decryptAWSConfig } from '@/lib/aws'
import type { IndexingJobPayload } from '@/lib/indexing/queue'
import { setProcessing, setDone, setFailed } from '@/lib/indexing/store'
import { embedText } from '@/lib/indexing/embed'
import { processMetadata } from '@/lib/indexing/processors/metadata'
import { processDocument } from '@/lib/indexing/processors/document'
import { processImage } from '@/lib/indexing/processors/image'
import { processAudio } from '@/lib/indexing/processors/audio'
import { processVideo } from '@/lib/indexing/processors/video'

const CONCURRENCY = parseInt(process.env.INDEXING_CONCURRENCY || '3', 10)

export function startIndexingWorker() {
  if (!process.env.REDIS_URL) return null

  const worker = new Worker<IndexingJobPayload>(
    'file-indexing',
    async (job) => {
      const { fileId } = job.data

      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: { credential: true, bucket: true },
      })
      if (!file) throw new Error(`File ${fileId} not found`)

      await setProcessing(fileId)

      const awsConfig = decryptAWSConfig(file.credential as any, file.bucket as any)
      const ct = (file.contentType || '').toLowerCase()

      let summary: string | null = null
      try {
        if (ct.startsWith('image/')) {
          summary = await processImage(file as any, awsConfig)
        } else if (ct.startsWith('video/')) {
          summary = await processVideo(file as any, awsConfig)
        } else if (ct.startsWith('audio/')) {
          summary = await processAudio(file as any, awsConfig)
        } else if (
          ct === 'application/pdf' ||
          ct.includes('officedocument') ||
          ct.startsWith('text/')
        ) {
          summary = await processDocument(file as any, awsConfig)
        }
      } catch {
        // processor threw — fall back to metadata below
      }

      if (!summary) summary = processMetadata(file as any)

      const embedding = await embedText(summary)
      await setDone(fileId, summary, embedding)
    },
    {
      connection: { url: process.env.REDIS_URL },
      concurrency: CONCURRENCY,
    }
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      await setFailed(job.data.fileId, err.message).catch(() => {})
    }
  })

  return worker
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/workers/indexing-worker.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/workers/indexing-worker.ts __tests__/lib/workers/indexing-worker.test.ts
git commit -m "feat(indexing): add BullMQ indexing worker dispatching to per-type processors"
```

---

## Task 13: Backfill scheduler

**Files:**
- Create: `lib/workers/backfill-scheduler.ts`
- Create: `__tests__/lib/workers/backfill-scheduler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/workers/backfill-scheduler.test.ts`:

```typescript
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })),
  Worker: jest.fn().mockImplementation((_name, processor) => ({ on: jest.fn(), _processor: processor })),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    fileEmbedding: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    file: {
      findMany: jest.fn().mockResolvedValue([{ id: 'file-a' }, { id: 'file-b' }]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('@/lib/indexing/queue', () => ({
  enqueueFileIndexing: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'

describe('startBackfillScheduler', () => {
  it('does not start when REDIS_URL is absent', () => {
    delete process.env.REDIS_URL
    const { startBackfillScheduler } = require('@/lib/workers/backfill-scheduler')
    const result = startBackfillScheduler()
    expect(result).toBeNull()
  })

  it('resets stale PROCESSING rows and enqueues unindexed files', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    jest.resetModules()
    jest.mock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
      Worker: jest.fn().mockImplementation((_name, processor) => ({ _processor: processor })),
    }))
    jest.mock('@/lib/db', () => ({
      prisma: {
        fileEmbedding: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        file: { findMany: jest.fn().mockResolvedValue([{ id: 'fa' }, { id: 'fb' }]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
      },
    }))
    jest.mock('@/lib/indexing/queue', () => ({ enqueueFileIndexing: jest.fn().mockResolvedValue(undefined) }))

    const { startBackfillScheduler } = require('@/lib/workers/backfill-scheduler')
    const { worker } = startBackfillScheduler()
    await worker._processor({})

    const { prisma: p } = require('@/lib/db')
    const { enqueueFileIndexing: enq } = require('@/lib/indexing/queue')
    expect(p.fileEmbedding.updateMany).toHaveBeenCalled()
    expect(enq).toHaveBeenCalledWith('fa', 10)
    expect(enq).toHaveBeenCalledWith('fb', 10)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/workers/backfill-scheduler.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/workers/backfill-scheduler'`

- [ ] **Step 3: Create `lib/workers/backfill-scheduler.ts`**

```typescript
import { Queue, Worker } from 'bullmq'
import { prisma } from '@/lib/db'
import { enqueueFileIndexing } from '@/lib/indexing/queue'

const BATCH_SIZE = parseInt(process.env.INDEXING_BATCH_SIZE || '50', 10)

export function startBackfillScheduler() {
  if (!process.env.REDIS_URL) return null

  const schedulerQueue = new Queue('backfill-scheduler', {
    connection: { url: process.env.REDIS_URL },
  })

  schedulerQueue.add('tick', {}, {
    repeat: { every: 60_000 },
    jobId: 'backfill-tick',
  })

  const worker = new Worker(
    'backfill-scheduler',
    async () => {
      // Reset stale PROCESSING rows (worker crashed >10 min ago)
      await prisma.fileEmbedding.updateMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        data: { status: 'PENDING' },
      })

      // Enqueue files with no embedding at all
      const unindexed = await prisma.file.findMany({
        where: { embedding: null },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      })

      // Enqueue files whose metadata changed after last indexing (cross-field: updatedAt > processedAt)
      const staleMetadata = await prisma.$queryRaw<{ id: string }[]>`
        SELECT f.id FROM "File" f
        JOIN "FileEmbedding" fe ON fe."fileId" = f.id
        WHERE fe.status = 'DONE'
          AND fe."processedAt" IS NOT NULL
          AND f."updatedAt" > fe."processedAt"
        LIMIT 20
      `

      for (const file of [...unindexed, ...staleMetadata]) {
        await enqueueFileIndexing(file.id, 10)
      }
    },
    { connection: { url: process.env.REDIS_URL } }
  )

  return { schedulerQueue, worker }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/workers/backfill-scheduler.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/workers/backfill-scheduler.ts __tests__/lib/workers/backfill-scheduler.test.ts
git commit -m "feat(indexing): add backfill scheduler — resets stale rows, enqueues unindexed files every 60s"
```

---

## Task 14: Wire trigger points

**Files:**
- Modify: `app/api/files/handlers/upload.ts`
- Modify: `app/api/files/verify/route.ts`

- [ ] **Step 1: Add import to `upload.ts`**

In `app/api/files/handlers/upload.ts`, the imports already include `revalidateTag` and `publishFileChanged`. Add after them:

```typescript
import { enqueueFileIndexing } from '@/lib/indexing/queue'
```

- [ ] **Step 2: Wire `handleMultipartComplete` — after line 212 (`publishFileChanged`)**

Find in `handleMultipartComplete`:
```typescript
  revalidateTag('dashboard-stats', 'max')
  publishFileChanged((file.teamId ?? file.credential.teamId) as string, { bucketId: file.bucketId, action: 'uploaded', key: validated.key })
```

Add immediately after that block (before `logUserAction`):
```typescript
  await enqueueFileIndexing(file.id, 1)
```

- [ ] **Step 3: Add import to `verify/route.ts`**

In `app/api/files/verify/route.ts`, add after existing imports:

```typescript
import { enqueueFileIndexing } from '@/lib/indexing/queue'
```

- [ ] **Step 4: Wire `verify/route.ts` — after `prisma.file.update` in the `newSize > oldSize` branch**

Find in `verify/route.ts`:
```typescript
      await prisma.file.update({ where: { id: file.id }, data: { size: meta.size, contentType: meta.contentType ?? file.contentType } })
      await incrementUsage(file.teamId || file.credential.teamId, delta)
```

Add after `incrementUsage`:
```typescript
      await enqueueFileIndexing(file.id, 1)
```

Also in the `newSize < oldSize` branch after its `prisma.file.update`:
```typescript
      await enqueueFileIndexing(file.id, 1)
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run existing upload tests to verify no regression**

```bash
npx jest __tests__/lib/files-route-quota.test.ts __tests__/api/ --no-coverage
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/files/handlers/upload.ts app/api/files/verify/route.ts
git commit -m "feat(indexing): enqueue file-indexing job after multipart complete and verify"
```

---

## Task 15: instrumentation.ts + next.config.js

**Files:**
- Create: `instrumentation.ts`
- Modify: `next.config.js`

- [ ] **Step 1: Create `instrumentation.ts`**

Create at project root:

```typescript
export async function register() {
  // BullMQ uses ioredis and worker threads — crashes in Edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startIndexingWorker } = await import('./lib/workers/indexing-worker')
    const { startBackfillScheduler } = await import('./lib/workers/backfill-scheduler')
    startIndexingWorker()
    startBackfillScheduler()
  }
}
```

- [ ] **Step 2: Add `serverExternalPackages` to `next.config.js`**

In `next.config.js`, inside the `nextConfig` object, add:

```js
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', '@ffmpeg-installer/ffmpeg'],
```

This prevents Next.js from bundling native binaries into the webpack output.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add instrumentation.ts next.config.js
git commit -m "feat(indexing): start indexing worker and backfill scheduler on server boot via instrumentation.ts"
```

---

## Task 16: GET /api/ai/search

**Files:**
- Create: `app/api/ai/search/route.ts`
- Create: `__tests__/api/ai-search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/ai-search.test.ts`:

```typescript
/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({ prisma: { $queryRaw: jest.fn() } }))
jest.mock('@/lib/indexing/embed', () => ({ embedText: jest.fn().mockResolvedValue(Array(1536).fill(0.1)) }))
jest.mock('@/lib/bucket-access', () => ({ getAccessibleBucketIds: jest.fn().mockResolvedValue(['bucket-1']) }))
jest.mock('@/lib/rate-limiter', () => ({ allowRequest: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/team-selection', () => ({
  getResolvedUserTeamScope: jest.fn().mockResolvedValue({ teamId: 'team-1', identityId: null }),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { GET } from '@/app/api/ai/search/route'
import { NextRequest } from 'next/server'

function makeRequest(q: string, teamId?: string) {
  const url = `http://localhost/api/ai/search?q=${encodeURIComponent(q)}${teamId ? `&teamId=${teamId}` : ''}`
  return new NextRequest(url)
}

describe('GET /api/ai/search', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(makeRequest('demo videos'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when q is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await GET(new NextRequest('http://localhost/api/ai/search'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const { allowRequest } = require('@/lib/rate-limiter')
    allowRequest.mockResolvedValueOnce(false)
    const res = await GET(makeRequest('query', 'team-1'))
    expect(res.status).toBe(429)
  })

  it('returns 200 with results array from pgvector query', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { id: 'f1', name: 'demo.mp4', key: 'vids/demo.mp4', contentType: 'video/mp4', parentPath: '/', score: 0.95 },
    ])
    const res = await GET(makeRequest('product demo', 'team-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].semanticScore).toBeCloseTo(0.95)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/api/ai-search.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/ai/search/route'`

- [ ] **Step 3: Create `app/api/ai/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { embedText } from '@/lib/indexing/embed'
import { getAccessibleBucketIds } from '@/lib/bucket-access'
import { allowRequest } from '@/lib/rate-limiter'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export const dynamic = 'force-dynamic'

interface SearchRow {
  id: string
  name: string
  key: string
  contentType: string | null
  parentPath: string
  score: number
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ message: 'q is required' }, { status: 400 })

  const allowed = await allowRequest(`ai-search:${session.user.id}`, 120, 60)
  if (!allowed) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: searchParams.get('teamId'),
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  // teamId must be resolved before bucket access check
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  // getAccessibleBucketIds returns string[] | null — null means unrestricted admin (no filter)
  const allowedBucketIds = searchParams.get('bucketId')
    ? [searchParams.get('bucketId')!]
    : await getAccessibleBucketIds(session.user.id, teamId)

  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  const embedding = await embedText(q)
  // embedding is number[] from OpenAI — all floats, no SQL injection risk
  const vectorStr = `[${embedding.join(',')}]`

  // When allowedBucketIds is null the user is an unrestricted admin — no bucket filter needed
  const bucketClause = allowedBucketIds === null
    ? Prisma.sql`1=1`
    : Prisma.sql`f."bucketId" = ANY(${allowedBucketIds})`

  const rows = await prisma.$queryRaw<SearchRow[]>(
    Prisma.sql`
      SELECT f.id, f.name, f.key, f."contentType", f."parentPath",
             1 - (fe.embedding <=> ${Prisma.raw(`'${vectorStr}'::vector`)}) AS score
      FROM "File" f
      JOIN "FileEmbedding" fe ON fe."fileId" = f.id
      WHERE fe.status = 'DONE'
        AND fe.embedding IS NOT NULL
        AND ${bucketClause}
      ORDER BY fe.embedding <=> ${Prisma.raw(`'${vectorStr}'::vector`)}
      LIMIT ${limit}
    `
  )

  return NextResponse.json({
    results: rows.map((r) => ({ ...r, semanticScore: Number(r.score) })),
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/api/ai-search.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/search/route.ts __tests__/api/ai-search.test.ts
git commit -m "feat(ai): add GET /api/ai/search — pgvector cosine similarity search scoped to team/buckets"
```

---

## Task 17: POST /api/ai/agent

**Files:**
- Create: `app/api/ai/agent/route.ts`
- Create: `__tests__/api/ai-agent.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/ai-agent.test.ts`:

```typescript
/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limiter', () => ({ allowRequest: jest.fn().mockResolvedValue(true) }))
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            files: [{ id: 'f1', reason: 'Matches product demo query' }],
            summary: 'Found 1 relevant video',
          }),
        }],
      }),
    },
  })),
}))
// Mock the search route's GET handler inline
jest.mock('@/app/api/ai/search/route', () => ({
  GET: jest.fn().mockResolvedValue({
    json: async () => ({ results: [{ id: 'f1', name: 'demo.mp4', contentType: 'video/mp4', parentPath: '/', semanticScore: 0.9 }] }),
    status: 200,
  }),
}))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/ai/agent/route'
import { NextRequest } from 'next/server'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/ai/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ai/agent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ query: 'demo' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when query is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const { allowRequest } = require('@/lib/rate-limiter')
    allowRequest.mockResolvedValueOnce(false)
    const res = await POST(makeRequest({ query: 'find videos' }))
    expect(res.status).toBe(429)
  })

  it('returns ranked files with reasons and a summary', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } })
    const res = await POST(makeRequest({ query: 'find the product demo videos', teamId: 'team-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.files[0].reason).toBe('Matches product demo query')
    expect(body.summary).toBe('Found 1 relevant video')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/api/ai-agent.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/ai/agent/route'`

- [ ] **Step 3: Create `app/api/ai/agent/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { allowRequest } from '@/lib/rate-limiter'
import { GET as semanticSearch } from '@/app/api/ai/search/route'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const query: string | undefined = body?.query
  if (!query) return NextResponse.json({ message: 'query is required' }, { status: 400 })

  const allowed = await allowRequest(`ai-agent:${session.user.id}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  // Get top-20 semantic candidates via the search endpoint
  const searchUrl = new URL('/api/ai/search', request.url)
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('limit', '20')
  if (body.teamId) searchUrl.searchParams.set('teamId', body.teamId)
  if (body.bucketId) searchUrl.searchParams.set('bucketId', body.bucketId)

  const searchReq = new NextRequest(searchUrl, { headers: request.headers })
  const searchRes = await semanticSearch(searchReq)
  const { results } = await searchRes.json() as { results: Array<{ id: string; name: string; contentType: string | null; parentPath: string; semanticScore: number }> }

  if (results.length === 0) {
    return NextResponse.json({ files: [], summary: 'No relevant files found.' })
  }

  // Build candidates list for Claude
  const limit = Math.min(body.limit ?? 10, 20)
  const candidateList = results
    .slice(0, 20)
    .map((f, i) => `${i + 1}. ${f.name} (${f.contentType || 'unknown'}) — score ${f.semanticScore.toFixed(3)}`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a file search assistant. Given the user query and candidate files below, select the top ${limit} most relevant files and explain why each matches. Return ONLY valid JSON in this format: {"files":[{"id":"...","reason":"..."}],"summary":"..."}\n\nUser query: "${query}"\n\nCandidates:\n${candidateList}`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    return NextResponse.json({ files: results.slice(0, limit), summary: '' })
  }

  let parsed: { files: { id: string; reason: string }[]; summary: string }
  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = block.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ files: results.slice(0, limit), summary: '' })
  }

  // Merge reasons onto the original file objects
  const resultMap = new Map(results.map((r) => [r.id, r]))
  const rankedFiles = parsed.files
    .filter((f) => resultMap.has(f.id))
    .map((f) => ({ ...resultMap.get(f.id)!, reason: f.reason }))

  return NextResponse.json({ files: rankedFiles, summary: parsed.summary })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/api/ai-agent.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/agent/route.ts __tests__/api/ai-agent.test.ts
git commit -m "feat(ai): add POST /api/ai/agent — semantic search + Claude Haiku ranking with per-file reasons"
```

---

## Task 18: Admin indexing endpoints

**Files:**
- Create: `app/api/admin/indexing/status/route.ts`
- Create: `app/api/admin/indexing/pause/route.ts`
- Create: `app/api/admin/indexing/resume/route.ts`
- Create: `app/api/admin/indexing/retry-failed/route.ts`

No individual tests — these are thin wrappers over BullMQ and Prisma. Covered by TypeScript compilation and the existing admin auth pattern.

- [ ] **Step 1: Create `app/api/admin/indexing/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { prisma } from '@/lib/db'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: request.nextUrl.searchParams.get('teamId'),
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'VIEW')

  const [total, indexed, pending, failed] = await Promise.all([
    prisma.file.count(),
    prisma.fileEmbedding.count({ where: { status: 'DONE' } }),
    prisma.fileEmbedding.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.fileEmbedding.count({ where: { status: 'FAILED' } }),
  ])

  return NextResponse.json({
    total,
    indexed,
    pending,
    failed,
    unindexed: total - indexed - pending - failed,
    percentComplete: total === 0 ? 100 : Math.round((indexed / total) * 100),
  })
}
```

- [ ] **Step 2: Create `app/api/admin/indexing/pause/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { fileIndexingQueue } from '@/lib/indexing/queue'
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

  if (!fileIndexingQueue) return NextResponse.json({ message: 'Queue not configured (no REDIS_URL)' }, { status: 503 })

  await fileIndexingQueue.pause()
  return NextResponse.json({ ok: true, paused: true })
}
```

- [ ] **Step 3: Create `app/api/admin/indexing/resume/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { fileIndexingQueue } from '@/lib/indexing/queue'
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

  if (!fileIndexingQueue) return NextResponse.json({ message: 'Queue not configured (no REDIS_URL)' }, { status: 503 })

  await fileIndexingQueue.resume()
  return NextResponse.json({ ok: true, paused: false })
}
```

- [ ] **Step 4: Create `app/api/admin/indexing/retry-failed/route.ts`**

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

  const failed = await prisma.fileEmbedding.findMany({
    where: { status: 'FAILED' },
    select: { fileId: true },
  })

  await prisma.fileEmbedding.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', errorMessage: null },
  })

  for (const { fileId } of failed) {
    await enqueueFileIndexing(fileId, 5)
  }

  return NextResponse.json({ ok: true, requeued: failed.length })
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/indexing/
git commit -m "feat(admin): add indexing status, pause, resume, retry-failed endpoints"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass, including the new 27 tests added in this plan.

- [ ] **TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Manual smoke test (requires Docker with Redis + pgvector)**

```bash
REDIS_URL=redis://localhost:6379 npm run dev
```

1. Upload a PDF file → check Redis queue has a new `file-indexing` job
2. Wait ~5 seconds → check database: `SELECT status, summary FROM "FileEmbedding" WHERE "fileId" = '<id>'`
3. Call `GET /api/ai/search?q=your+query+here&teamId=<id>` → expect relevant file in results
4. Call `POST /api/ai/agent` with `{"query":"find the PDF I just uploaded","teamId":"<id>"}` → expect ranked result with reason
5. Call `GET /api/admin/indexing/status` → expect `indexed >= 1`

- [ ] **Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup after semantic indexing implementation"
```
