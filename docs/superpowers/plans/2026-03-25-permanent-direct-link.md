# Permanent Direct Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current expiring “Direct S3/CDN Link” behavior with a true permanent direct link flow that returns a CDN URL when configured or the original S3 URL otherwise.

**Architecture:** The existing direct-link modal already represents the right UX entry point, but the backend currently generates a 15-minute presigned or signed URL. The fix is to make the direct-link endpoint return an unsigned permanent URL derived from CDN configuration or the bucket/object path instead of generating an expiring token.

**Tech Stack:** Next.js App Router, TypeScript, AWS SDK helpers, React modal UI

---

### Task 1: Confirm Current Direct Link Behavior

**Files:**
- Modify: app/api/files/[fileId]/direct-link/route.ts
- Reference: components/DirectLinkModal.tsx
- Reference: app/dashboard/files/page.tsx

- [ ] **Step 1: Verify endpoint TTL behavior**

Confirm the direct-link route hardcodes a short TTL and does not return a true permanent URL.

- [ ] **Step 2: Verify current UI copy mismatch**

Confirm the modal or button text implies permanence while the backend returns an expiring link.

### Task 2: Return Permanent Unsigned URLs

**Files:**
- Modify: app/api/files/[fileId]/direct-link/route.ts
- Modify: lib/aws.ts

- [ ] **Step 1: Decide permanent URL source**

Implement this rule:
- if CDN configured, return CDN origin + object key
- otherwise return S3 object URL

- [ ] **Step 2: Add or reuse helper for permanent URL construction**

Prefer a dedicated helper in `lib/aws.ts` instead of mixing permanent URL logic into presign helpers.

- [ ] **Step 3: Preserve permission checks and ownership validation**

Do not weaken auth or file ownership validation when changing URL generation.

### Task 3: Simplify UX Copy

**Files:**
- Modify: components/DirectLinkModal.tsx
- Modify: app/dashboard/files/page.tsx

- [ ] **Step 1: Rename action to reflect permanent behavior**

Remove wording that implies temporary presigned behavior if the action is now permanent.

- [ ] **Step 2: Keep share-link modal separate**

Do not break the existing expiring share-link flow. The permanent link action should remain distinct from the share-link action.

### Task 4: Verify Permanent Link Behavior

**Files:**
- Test: direct link modal and direct-link API route

- [ ] **Step 1: Verify CDN-configured file**

Expected: URL uses CDN domain and object path, no expiry parameters.

- [ ] **Step 2: Verify non-CDN file**

Expected: URL uses S3 object path, no expiry parameters.

- [ ] **Step 3: Run build verification**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/api/files/[fileId]/direct-link/route.ts lib/aws.ts components/DirectLinkModal.tsx app/dashboard/files/page.tsx
git commit -m "feat: return permanent direct links for files"
```