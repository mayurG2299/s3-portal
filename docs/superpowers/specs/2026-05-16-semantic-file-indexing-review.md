# Spec Review — Semantic File Indexing & AI Search

**Reviewer:** Claude (Opus 4.7, deep-codebase pass)
**Date:** 2026-05-16
**Spec under review:** `2026-05-16-semantic-file-indexing-design.md`
**Verdict:** **Needs revision before implementation.** Two critical infrastructure assumptions are wrong (would break first deploy). Five major issues are silent bugs that would surface days into running the system.

---

## How this review was done

Before commenting on the spec, I ground-truthed every infrastructure claim against the actual repository:

- `docker-compose.yml` and `docker-compose.production.yml` (what services run)
- `package.json` (what's installed vs. used)
- `lib/cron.ts`, `scripts/cron-worker.ts` (existing background-job pattern)
- `lib/rate-limiter.ts` (existing Redis usage and fallback behavior)
- `app/api/files/verify/route.ts` (claimed trigger point)
- `app/api/files/handlers/upload.ts` (multipart-complete trigger)
- `app/dashboard/files/page.tsx` (how the client actually calls `/verify`)
- `prisma/schema.prisma` (data model)

The previous review approved the spec without verifying infra claims. The issues below were missed.

---

## Critical issues (would break on day one)

### C1 — Redis isn't actually deployed

The spec repeatedly says "uses Redis you already have." It doesn't exist.

- `docker-compose.yml` has only `postgres` and `app` — no Redis service.
- `docker-compose.production.yml` same.
- `lib/rate-limiter.ts` is hardcoded to fall back to an in-memory `Map` if `REDIS_URL` is not set:
  ```ts
  if (process.env.REDIS_URL) {
    const IORedis = require('ioredis')
    redisClient = new IORedis(process.env.REDIS_URL)
    useRedis = true
  }
  // ... else falls back to memMap
  ```
- `ioredis` is *installed* in `package.json` (`^5.10.0`) but never connected to a running Redis instance.

BullMQ has no in-memory fallback — it requires a real Redis. Without it, the worker fails to start.

**Fix:**
- Add a `redis` service to both docker-compose files (`redis:7-alpine` is sufficient).
- Set `REDIS_URL=redis://redis:6379` in the `app` service env.
- Add a healthcheck and `depends_on: [redis]` for the app.
- Add a persistence volume (`redis_data`) — though for BullMQ-only use, in-memory is acceptable; data loss = re-queue from backfill on next tick.

This belongs in section 11 (Infra) and section 12 (env vars).

---

### C2 — Postgres image doesn't have pgvector

The spec says "pgvector is a Postgres extension (already containerized)." It isn't.

- `docker-compose.yml` uses `image: postgres:15-alpine` — the official base image. No extensions bundled.
- Running `CREATE EXTENSION vector` against this image fails with:
  ```
  ERROR: extension "vector" is not available
  ```

**Fix:**
- Swap the image to `pgvector/pgvector:pg15` (official pgvector image, based on the same Postgres 15) or `ankane/pgvector:v0.5.1` (community).
- Same Postgres major version (15) — existing `postgres_data` volume should attach cleanly. **Verify on a copy of prod data before doing this in production.**
- Confirm the chosen image bundles pgvector ≥ 0.5 (for HNSW index support).

This belongs in section 5.3 (Migration strategy) and section 11.

---

### C3 — Ignores the existing background-job pattern

The project already has its own background-job system:

- `lib/cron.ts` exports `startBackgroundJobs()` — runs `expirePendingInvites()` and `reconcileTeam()` every 6 hours via `setInterval` in-process.
- `scripts/cron-worker.ts` runs the same `startBackgroundJobs()` as a separate Node process for non-app deployments.

The spec introduces BullMQ as a parallel mechanism without:

1. Acknowledging that `lib/cron.ts` exists.
2. Justifying *why* BullMQ is added on top.
3. Saying whether the existing cron jobs migrate to BullMQ later or stay split.

This isn't wrong — BullMQ genuinely provides things `setInterval` cron does not:

- Retries with exponential backoff (cron has no concept of failure recovery)
- Per-job state and observability
- Priority queues (new uploads jumping the queue ahead of backfill)
- Enqueuing on demand from API routes (cron is timer-only)

**Fix:** Add a sub-section to section 6.2 explicitly comparing to `lib/cron.ts`, justifying BullMQ for the indexing workload, and stating that the existing cron jobs are out of scope for this change. Future maintainers will otherwise ask "why two job systems?" and find no answer.

---

## Major issues (silent bugs waiting to happen)

### M1 — `/verify` is fire-and-forget from the client

`app/dashboard/files/page.tsx:503-510`:

```ts
try {
  if (fileId) {
    await fetch('/api/files/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    })
  }
} catch (err) {
  console.error('Post-upload verification failed:', err)
}
```

The verify call is wrapped in a try/catch that **swallows the error and only logs to console**. If:

- The user closes the tab between PUT-to-S3 and the verify call
- The browser is offline at that moment
- The verify endpoint returns 500 (any reason)

…the file lands in S3, sits in the DB with `size: 0`, and no indexing job is ever enqueued.

The backfill catches this eventually (60s tick + `embedding: null` query), so it isn't a *correctness* problem — but the spec presents `/verify` as a reliable trigger when it's actually best-effort.

**Fix:** Add a sentence to section 6.1 — "The `/verify` trigger is best-effort from the client; the backfill scheduler is the authoritative source of completeness." Move the backfill scheduler's role from "for existing files" to "for existing files **and** any new files whose verify call failed."

---

### M2 — Cross-field Prisma query in section 7.1 is invalid

The pseudo-code shows:

```ts
processedAt: { lt: prisma.file.fields.updatedAt }
```

`prisma.<model>.fields.<column>` exists, but it's for *atomic updates within the same row* (e.g., `data: { count: { increment: prisma.x.fields.y } }`). It does **not** work as a `where`-clause comparator across models.

The note below the code correctly says "must be done via `$queryRaw`" — but the pseudo-code itself is invalid Prisma. A developer will copy-paste it, get a runtime error, and waste 30 minutes diagnosing.

**Fix:** Either delete the pseudo-code and show the actual raw SQL, or annotate the line as `// NOT VALID PRISMA — see note below`. The raw SQL would be roughly:

```sql
SELECT f.id FROM "File" f
JOIN "FileEmbedding" fe ON fe."fileId" = f.id
WHERE fe.status = 'DONE'
  AND f."updatedAt" > fe."processedAt"
ORDER BY f."updatedAt" DESC
LIMIT 20
```

---

### M3 — Don't trust `contentType` from the DB

`File.contentType` is set from whatever the browser sent during upload. A user can upload `evil.txt` with `Content-Type: image/png` — nothing validates this server-side. The current code accepts it as-is in `handlers/upload.ts:72-75`:

```ts
create: {
  // ...
  contentType: validated.contentType,  // <-- from request body
  // ...
}
```

If the image processor blindly trusts `contentType`, it will:

- Forward a non-image presigned URL to Claude Vision
- Either fail with a Claude error, or worse, get a hallucinated description of "what Claude thinks is in this file"

**Fix:** Add a hardening sentence to section 6.3 — detect MIME from S3 `HeadObject` response (which AWS sets based on what S3 stored, more trustworthy) or fall back to file extension (the `key` field). The DB `contentType` is a hint, not authority.

---

### M4 — Whisper audio format unspecified

The OpenAI Whisper API accepts only: `flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm`.

The video processor in section 6.3 says: *"Extract audio using `ffmpeg` via `fluent-ffmpeg` + `ffmpeg-static`."* — without specifying the output format. A developer might pipe raw PCM or AAC into Whisper and get 400 errors.

**Fix:** Specify the ffmpeg output target. Recommendation:

```
mp3, 16 kHz mono, 64 kbps
```

Mono is sufficient for speech; 16 kHz is Whisper's sampling rate; 64 kbps keeps a 30-minute clip well under the 25 MB cap. This is also a documented "good for transcription" preset.

---

### M5 — Token vs character budget for documents

Spec says: *"trim to 8000 chars (fits the embedding context window)."* This rationale is imprecise.

- `text-embedding-3-small` has an **8192 token** limit.
- 8000 chars ≈ 2000 tokens.
- So 8000 chars is *well under* the limit, not "fitting" it.

This is fine as a conservative cut (longer inputs can dilute the embedding signal anyway), but the *reasoning* in the spec is wrong, which makes future tuning harder.

**Fix:** Replace the rationale with one of:

- *"Trim to ~8000 chars (~2000 tokens). We found longer inputs dilute the document-level signal in our testing."* (if that's true)
- *"Trim to ~30000 chars (~7500 tokens) to maximize semantic richness within the 8192-token embedding limit."* (if richer is better)

Pick a side based on empirical testing post-launch.

---

## Minor issues (worth addressing, not blockers)

### m1 — Cost estimate is incomplete

The estimate omits the per-file *embedding* cost (text-embedding-3-small is $0.02/1M tokens). For 10k files at ~2000 tokens average, that's ~$0.40 — negligible — but should be itemized for completeness alongside Claude Vision and Whisper.

### m2 — "Dead-letter queue" is a BullMQ Pro feature

OSS BullMQ keeps failed jobs in a `failed` set, not a separate DLQ. The wording in section 6.4 should be: "After 3 failures, jobs remain in the `failed` set." The retry-failed admin endpoint then `requeue`s from that set.

### m3 — No HNSW tuning parameters mentioned

Section 5.1 uses `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` with defaults. HNSW has `m` (default 16) and `ef_construction` (default 64). For 1536-dim embeddings under 1M rows, defaults are fine. Query-time `ef_search` (default 40) trades recall for speed. Not blocking — add as a footnote: "Defaults work to ~1M vectors. Tune `ef_search` at query time if recall feels low."

### m4 — No embedding-quality eval

The test plan in section 14 covers mechanics (status flips to DONE, ranks correct files). It does **not** cover quality: "does the search actually return relevant files for realistic queries?"

A small golden-set eval (50 hand-curated queries with expected file IDs, run on a real seeded dataset) would catch regressions when the embedding model is upgraded or the summary prompt is tweaked. Worth adding to section 14.

### m5 — `/api/ai/*` has no version prefix

If this ever becomes an external API or you change the response shape, you'll need a `v1` prefix retroactively. For a private app, this is fine. Worth a sentence acknowledging the choice.

### m6 — Horizontal-scaling race on the backfill scheduler

If two app containers boot, both call `startBackfillScheduler()`. BullMQ deduplicates repeatable jobs by their job ID/key, so this is safe — but worth a sentence: "Safe under horizontal scaling: BullMQ deduplicates repeatable jobs by key."

---

## What the spec gets right (preserve on revision)

These are non-obvious decisions the spec already nails — don't lose them:

| Thing | Why it's correct |
|---|---|
| Node.js runtime guard for `instrumentation.ts` | Edge runtime would crash BullMQ; easy to miss |
| HNSW over IVFFlat for an empty starting table | IVFFlat requires `lists × 3` rows to build a meaningful index |
| Double-quoted camelCase columns in raw SQL | Prisma stores field names case-sensitive in Postgres |
| Rate limiting on `/api/ai/*` endpoints | Each call is real money — cost-abuse defense |
| Metadata-only fallback for unknown file types | System never refuses to index; gracefully degrades |
| Cascade delete on `File → FileEmbedding` relation | No orphan rows when files are deleted |
| Backfill resumability via re-query each tick | No external state tracking needed |
| Priority queue (new uploads jump backfill) | Correct UX — new content should be searchable fast |

---

## Recommended action

1. **Apply C1, C2, C3 fixes** — these are required before any code is written. ~20 minutes of spec edits.
2. **Apply M1-M5** — silent bugs. ~20 minutes.
3. **Skip the minors for now** — note them but defer.
4. **Re-run the spec review** with infrastructure verification this time.
5. **Then** start the implementation plan via the `writing-plans` skill.

The spec is structurally sound. The critical issues are not design flaws — they're checklist items that got missed because the previous review didn't open the docker-compose files.

---

## Notes left for the author

Reply inline below each section with `> AUTHOR:` to track decisions. If you disagree with any finding, say so — verification is welcome, "Approved" is not the same as "Correct."

### C1 reply:

> AUTHOR:

### C2 reply:

> AUTHOR:

### C3 reply:

> AUTHOR:

### M1 reply:

> AUTHOR:

### M2 reply:

> AUTHOR:

### M3 reply:

> AUTHOR:

### M4 reply:

> AUTHOR:

### M5 reply:

> AUTHOR:

### Minors to keep / drop:

> AUTHOR:
