# Share Link Internal Server Error Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `/api/links` from throwing a 500 when a user requests a presigned link expiration longer than S3 supports.

**Architecture:** The route should reject invalid expiration input at validation time instead of letting the AWS SDK throw at runtime. The fix belongs in request validation, with optional tightening of error translation for safer client feedback.

**Tech Stack:** Next.js App Router, TypeScript, Zod, AWS SDK v3

---

### Task 1: Lock Down Input Validation

**Files:**
- Modify: app/api/links/route.ts
- Modify: lib/aws.ts
- Test: manual POST /api/links payloads

- [ ] **Step 1: Inspect current schema and mode handling**

Confirm the route accepts `expiresIn` without a maximum bound and forwards it into presigned URL generation.

- [ ] **Step 2: Add a failing validation case**

Document or codify this failing payload:

```json
{
  "type": "PRESIGNED",
  "expiresIn": 2592000,
  "mode": "direct",
  "allowDownload": true,
  "allowPreview": true,
  "fileId": "test"
}
```

Expected: 400 validation error, not 500.

### Task 2: Enforce S3 Presigned URL Max TTL

**Files:**
- Modify: app/api/links/route.ts

- [ ] **Step 1: Add explicit upper bound for presigned TTL**

Use the S3 maximum of `604800` seconds in the route schema or mode-aware refinement.

- [ ] **Step 2: Return a client-safe validation message**

Example message:

```ts
"Presigned links cannot exceed 7 days (604800 seconds)."
```

- [ ] **Step 3: Keep other link types working**

Do not regress existing supported TTL behavior for shorter presigned links or other modes already supported by the endpoint.

### Task 3: Improve Error Translation If Needed

**Files:**
- Modify: app/api/links/route.ts
- Optional: lib/error-translator.ts or lib/aws.ts

- [ ] **Step 1: Check the generic catch path**

If AWS validation can still bubble up, translate it into a 400 instead of 500.

- [ ] **Step 2: Preserve audit logging and route response consistency**

Use existing response helpers and keep success/failure logging behavior intact.

### Task 4: Verify Link Creation Behavior

**Files:**
- Test: POST /api/links

- [ ] **Step 1: Verify invalid 30-day presigned request**

Run the reported curl payload with `expiresIn=2592000`.
Expected: 400 with clear validation message.

- [ ] **Step 2: Verify valid request**

Run a payload with `expiresIn=604800`.
Expected: successful link creation.

- [ ] **Step 3: Run build verification**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/api/links/route.ts lib/aws.ts
git commit -m "fix: validate presigned share link expiration"
```