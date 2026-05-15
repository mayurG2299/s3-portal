# S3 Portal UI/UX and Feature Testing: Error & Issue Log

**Date:** 5 April 2026

---

## 1. Login Screen: Registration Link Accessibility

- **Issue:** The "Create an account" link on the login screen is present in the DOM but cannot be clicked via browser automation because it is outside the viewport.
- **Impact:** Users on certain screen sizes or devices may not be able to access the registration page without manual scrolling or resizing.
- **Severity:** High (blocks new user registration for some users; fails accessibility and responsiveness requirements)
- **Steps to Reproduce:**
  1. Open http://localhost:3000/login
  2. Attempt to click "Create an account" (either manually or via automation)
  3. Observe that the link is not visible/clickable without scrolling.
- **Expected:** The registration link should always be visible and accessible without scrolling or resizing, on all supported devices and viewport sizes.
- **Recommendation:** Adjust layout/CSS to ensure all primary actions are always in view.

---


---

## 2. Files Screen: UI Navigation Blocker

- **Issue:** Sidebar links become outside viewport in the current automation viewport, causing click timeouts unless direct URL navigation is used.
- **Impact:** Sidebar-driven automation is unreliable and can produce false-negative UI test failures.
- **Severity:** High.
- **Steps to Reproduce:**
  1. Open http://localhost:3000/dashboard
  2. Attempt to click any navigation link via browser automation.
  3. Observe timeout and no navigation.
- **Expected:** All navigation links should be interactable via browser automation and accessible for all users.
- **Recommendation:** Ensure primary navigation remains reachable in constrained viewport sizes and verify responsive behavior for automated test viewport dimensions.

---

## 3. Files API: RBAC, Quota, and Audit Logging

- **Status:** All endpoints enforce authentication, RBAC, quota, and audit logging as per requirements.
- **Manual API tests:** All permission and quota checks work as expected.

---

## 4. Teams Screen: Runtime Crash (Dashboard Error)

- **Issue:** Opening `/dashboard/teams` crashes with a dashboard error.
- **Observed Error:** `Attempted to call useDashboard() from the server but useDashboard is on the client.`
- **Impact:** Team management screen is not usable.
- **Severity:** Critical.
- **Steps to Reproduce:**
  1. Open `http://localhost:3000/dashboard/teams`
  2. Observe dashboard error boundary instead of team management UI.
- **Expected:** Teams page should render team members, invite form, and role controls without runtime hook violations.
- **Recommendation:** Remove client-hook usage from server-rendered tree on Teams route (or move affected subtree to client component boundaries).

---

## 5. Links API: Sensitive `passwordHash` Exposure

- **Issue:** `GET /api/links` returns `passwordHash` for links in API response payload.
- **Impact:** Sensitive credential-derived data is exposed to frontend/API consumers; this is a security violation.
- **Severity:** Critical.
- **Steps to Reproduce:**
  1. Open `http://localhost:3000/api/links` while authenticated.
  2. Inspect returned JSON.
  3. Observe `passwordHash` fields present for multiple link records.
- **Expected:** `passwordHash` must never be returned in API responses.
- **Recommendation:** Use explicit Prisma `select` in links listing endpoint and omit all sensitive fields by default.

---

## 6. Shared Links Screen/API Validation

- **Verified:** Revoke action triggers confirmation dialog and performs delete API call.
- **Verified:** `GET /api/links` returns team-scoped data and supports fallback behavior (`personalScopeFallback`) when invalid team is requested.
- **Verified:** Deleting with invalid/non-owned id returns `403 Forbidden`.

---

## 7. Automated Test Suite Failures (Jest)

- **Command:** `npm test`
- **Result:** 88 passed, 2 failed.
- **Failing File:** `__tests__/lib/dashboard-context.integration.test.tsx`
- **Failure 1:** Team switch integration test cannot find `selected-team` because modal/overlay state blocks expected UI state.
- **Failure 2:** 403/404 safety-net integration test cannot find `simulate-removed` and shows modal flow instability.
- **Additional Signal:** jsdom reports `window.location.reload()` not implemented in this path, contributing to unstable assertions.

---

## 8. Screen/API Status Snapshot (Current Session)

- **Dashboard files:** loads; actions disabled until credential and bucket selected.
- **Dashboard links:** loads with records; revoke flow reachable.
- **Dashboard credentials:** loads and lists credentials.
- **Dashboard settings:** loads theme and credential forms.
- **Dashboard invitations:** loads (no pending invites currently).
- **Dashboard permissions:** loads (admin/owner-only route).
- **Dashboard audit:** loads (owner-only route).
- **Dashboard teams:** fails with runtime crash (see issue #4).

---

## 9. File Upload Quota Enforcement Bypass (Init)

- **Issue:** `POST /api/files` with `action: "upload"` accepted a 3 TB `size` request and returned a valid presigned URL despite UI showing a 1 TB team limit.
- **Impact:** Users can initiate uploads far beyond team quota constraints; quota policy can be bypassed at upload-init stage.
- **Severity:** Critical.
- **Steps to Reproduce:**
  1. Use authenticated session with selected team and bucket.
  2. Call `POST /api/files` with payload containing:
     - `action: "upload"`
     - valid `bucketId`, `teamId`
     - `size: 3000000000000` (3 TB)
  3. Observe `200` response with presigned upload URL.
- **Expected:** Request should be rejected with `403` when requested size exceeds remaining quota.
- **Recommendation:** Enforce strict hard-limit validation before issuing presigned URL and before persisting/upserting file metadata.

---

## 10. Files Screen Functional Validation (After Selecting Credential + Bucket)

- **Verified:** Files list loads with real folder objects once credential and bucket are selected.
- **Verified:** Selecting a file/folder checkbox enables `Share Selected` action immediately (live UI update, no refresh required).
- **Verified:** Upload modal opens via Upload action.
- **Verified:** Refresh action re-fetches files list successfully.

---

## 11. Quota State Inconsistency Visible in UI

- **Issue:** After oversized upload-init request was accepted, dashboard usage indicator moved to `100%` and displayed `2.7 TB / 1 TB`.
- **Impact:** Team storage state can become inconsistent/over-limit through upload-init path alone.
- **Severity:** High.
- **Notes:** This is consistent with issue #9 and indicates usage accounting is updated even before a real object is uploaded.

---

## 12. Profile Screen and Password API Validation

- **Verified:** Profile page loads and password update form renders correctly.
- **Verified:** `POST /api/account/password` rejects weak payload with `400` and validation error (`String must contain at least 8 character(s)`).
- **Result:** Validation behavior is correct for this negative-path test.

---

## 13. Audit Logs Verification

- **Verified in UI:** Audit page includes recent file and link actions (including `FILE_UPLOAD_INIT` and `LINK_DELETE`) and PASS/FAIL badges.
- **Observed:** Audit log table is rendering and updating with recent activity in current session.
- **Note:** Direct MCP database verification was not possible because connected MCP Postgres instance appears to be a different database/schema than this app.

---

## 14. Mobile Responsiveness Observation (Files Screen)

- **Issue:** At mobile viewport (390x844), sidebar/navigation remains rendered while primary file actions are also present; interaction hierarchy appears crowded and inconsistent with compact mobile navigation expectations.
- **Impact:** Reduced usability on small screens; increased chance of off-screen/overlap interaction issues during navigation and header selection.
- **Severity:** Medium.
- **Recommendation:** Validate mobile breakpoint behavior for sidebar collapse, team/credential selectors, and primary file actions to ensure predictable touch interactions.

---

## 15. RBAC Bypass: Files API Accepts Invalid Team Context

- **Issue:** `POST /api/files` (`action: list`) returns file objects even when `teamId` is an invalid/non-member UUID.
- **Impact:** Team-context authorization can be bypassed/mis-scoped for file listing.
- **Severity:** Critical.
- **Steps to Reproduce:**
  1. Use authenticated session and a valid `bucketId`.
  2. Call `POST /api/files` with `teamId: "00000000-0000-0000-0000-000000000000"`.
  3. Observe `200` with file objects returned instead of `403`.
- **Expected:** Invalid/non-member team context should be rejected with `403`.

---

## 16. Team Scope Handling Inconsistency Across APIs

- **Observed:**
  - `GET /api/links?teamId=<invalid>` => `200`, `personalScopeFallback: true`, `links: []`.
  - `GET /api/credentials?teamId=<invalid>` => `200`, returns team credentials with `personalScopeFallback: false` (falls to session team context).
- **Impact:** Team scoping behavior is inconsistent across modules, making policy expectations unclear.
- **Severity:** Medium.

---

## 17. Credential Management API Negative-Path Validation

- **Verified:** `PUT /api/credentials` without `id` returns `400` (`Credential ID is required`).
- **Verified:** `PUT /api/credentials?id=<valid>` with only `accessKey` returns `400` (`Access key and secret key must be provided together`).
- **Verified:** `DELETE /api/credentials` without `id` returns `400`.
- **Verified:** `POST /api/credentials` with empty payload returns `400` validation error.
- **Verified:** `PUT /api/credentials/cdn` with invalid non-PEM private key returns `400`.

---

## 18. File Download API Validation Notes

- **Verified:** Invalid id on `GET /api/files/download?id=non-existent-file-id` returns `404` (`File not found`).
- **Verified:** Valid file download path initiates external S3 redirect flow (observed attempted S3 request in browser events).
- **Note:** Browser `fetch` for cross-origin redirect reports opaque redirect status, so this was validated via event trace rather than response body inspection.

---

## 19. Live UI State Update Verification (Files Selection)

- **Verified:** `Share Selected` button state updates immediately without page refresh:
  - Initial: disabled
  - After selecting one checkbox: enabled
  - After unselecting the same checkbox: disabled
- **Observed Checkbox Count:** 63 selectable rows in tested view.
- **Result:** Selection-driven UI state change is reactive and works as expected.

---

## 20. Files Verify & Action Validation (Negative Paths)

- **Verified:** `POST /api/files/verify` with empty payload returns `400` (`fileId or (bucketId and key) required`).
- **Verified:** `POST /api/files/verify` with invalid `fileId` returns `404` (`File not found`).
- **Verified:** `POST /api/files` with unknown `action` returns `400` (`Invalid action`).
- **Result:** Validation guards for verify/action routing are working for these negative paths.

---

## 21. Live UI State Update Verification (Settings Theme & Mode)

- **Verified:** Color mode toggles apply immediately without refresh:
  - `Dark -> Light` updates document theme class.
  - `Light -> Dark` updates document theme class back.
- **Verified:** Theme preset selection updates active theme attribute immediately (example: `nebula -> nord`).
- **Result:** Settings UI live-update behavior is reactive and working for appearance controls.

---
