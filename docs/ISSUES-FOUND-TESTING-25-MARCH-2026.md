# Issues Found During Testing — 25 March 2026

## Bug 1 — Invited Team: Identities & Buckets Dropdown Empty

After accepting an invitation and switching to the invited team via the teams dropdown, the identities and buckets dropdowns show no options.

**Expected:** Switching teams should load the credentials and buckets belonging to that team.

---

## Bug 2 — Share Link: Internal Server Error on Image Share

Generating a share link for an image returns `Internal server error`.

**Reproduction curl:**
```bash
curl 'http://localhost:3000/api/links' \
  -H 'Content-Type: application/json' \
  --data-raw '{"type":"PRESIGNED","expiresIn":2592000,"mode":"direct","allowDownload":true,"allowPreview":true,"fileId":"cmn5wrad8002bxfcc07zawbjd"}'
```

**Root Cause:** `expiresIn: 2592000` (30 days) exceeded the global 7-day AWS presigned URL cap enforced in the Zod schema, causing a validation error that surfaced as a 500.

**Fix:** Narrowed the 7-day TTL cap to only apply when `mode === 'direct'` via `superRefine`. Other modes (preview, download, raw) allow longer or unlimited expiry.

---

## Bug 3 — New User Credential Save: Internal Server Error

For a brand-new user, entering AWS credentials in the onboarding popup and clicking **Save** returns `Internal server error`.

**Root Cause (two-part):**
1. The form was sending un-trimmed / incorrectly validated field values.
2. `app/dashboard/page.tsx` was passing `bucketsCount` (always 0 for new users) instead of `credentialsCount` to `<FirstTimeWizard>`, so the wizard kept re-opening even after a successful save.

**Fix:**
- Pre-compute `trimmedX` values and an `isCredentialsFormValid` boolean in the wizard before enabling submit.
- Dashboard now queries `prisma.aWSCredential.count()` and passes `credentialsCount` to the wizard.

---

## Bug 4 — Files API Breaking on List Action

The `/api/files` list action was returning an error when called with a `bucketId` that belongs to a non-primary team.

**Reproduction curl:**
```bash
curl 'http://localhost:3000/api/files' \
  -H 'Content-Type: application/json' \
  --data-raw '{"action":"list","bucketId":"cmn5wmn0p000bxfccbmm4nlsp","prefix":"","query":"lotu","page":1,"pageSize":200}'
```

**Root Cause:** The route always resolved team context from `session.user.teamId` (primary team) instead of the active team indicated by the `selectedTeamId` cookie or request body `teamId`. Bucket ownership check then failed for invited-team buckets.

**Fix:** Route now resolves active team from `body.teamId` → `selectedTeamId` cookie → `session.user.teamId` (fallback). A membership guard returns 403 if the user is not a member of the resolved team before any bucket access.

---

## Bug 5 — Share Popup Missing Permanent / Perma-Link Option

The share file popup did not expose a simple permanent link option. The only available option bundled expiry and CDN/direct-S3 configuration into one confusing flow.

**Expected:** A dedicated **Perma-link** option that:
- If a CDN (CloudFront) is configured → returns the permanent CDN URL (no expiry).
- Otherwise → returns the permanent S3 URL (no expiry, no presigning).

**Status:** Identified; to be implemented as a separate UI addition to the share modal.

---

## Resolution Summary

| # | Issue | Status |
|---|---|---|
| 1 | Invited team dropdowns empty | Fixed — credentials API accepts `?teamId`, validates membership |
| 2 | Share link 500 on 30-day expiry | Fixed — TTL cap scoped to `mode=direct` only |
| 3 | New user credential save 500 | Fixed — trimmed form validation + correct credential count passed to wizard |
| 4 | Files API breaking on list | Fixed — active team resolved from cookie/body; membership guard added |
| 5 | No perma-link option in share popup | Pending implementation |
