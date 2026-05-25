# Manual Test Cases — S3 Portal

> **How to use this doc**
> Each test case has: **Steps** → **Expected Result** → **Pass/Fail** checkbox.
> Mark `[x]` for pass, `[ ]` for fail, and note what went wrong.
>
> **Test users to create before starting:**
> - `owner@test.com` — OWNER role
> - `admin@test.com` — ADMIN role
> - `viewer@test.com` — VIEWER role
> - `noauth@test.com` — not a team member

---

## Section 1 — Authentication

### TC-AUTH-01: Register with valid credentials
1. Go to `/register`
2. Enter a valid email and a strong password (e.g. `Test@1234`)
3. Submit the form

**Expected:** Account created, redirected to dashboard or login.
**Pass [ ] Fail [ ]**

---

### TC-AUTH-02: Register with weak password
1. Go to `/register`
2. Try each of these passwords one at a time: `short`, `alllowercase1!`, `ALLUPPERCASE1!`, `NoSpecialChar1`, `NoNumber!Abc`
3. Submit after each

**Expected:** Form shows a specific validation error for each case. Registration is blocked.
**Pass [ ] Fail [ ]**

---

### TC-AUTH-03: Register with duplicate email
1. Register an account with `owner@test.com`
2. Try to register again with the same email

**Expected:** Error message saying email is already in use.
**Pass [ ] Fail [ ]**

---

### TC-AUTH-04: Login with valid credentials
1. Go to `/login`
2. Enter valid credentials
3. Submit

**Expected:** Redirected to `/dashboard`.
**Pass [ ] Fail [ ]**

---

### TC-AUTH-05: Login with wrong password
1. Go to `/login`
2. Enter correct email, wrong password

**Expected:** Error message shown. Not logged in.
**Pass [ ] Fail [ ]**

---

### TC-AUTH-06: Unauthenticated redirect
1. While logged out, navigate directly to `/dashboard/files`

**Expected:** Redirected to `/login` (not a blank page or 404).
**Pass [ ] Fail [ ]**

---

### TC-AUTH-07: Session persistence
1. Log in
2. Close the browser tab
3. Reopen and navigate to `/dashboard`

**Expected:** Still logged in (session persists).
**Pass [ ] Fail [ ]**

---

## Section 2 — Team Management (OWNER only)

### TC-TEAM-01: Create a team
1. Log in as OWNER
2. Look for a "Create Team" option in the sidebar or dashboard
3. Enter a team name and submit

**Expected:** Team created, appears in team selector. Slug auto-generated from name.
**Pass [ ] Fail [ ]**

---

### TC-TEAM-02: Rename a team
1. Log in as OWNER
2. Navigate to team settings
3. Change the team name and save

**Expected:** New name reflected everywhere (sidebar, page headings).
**Pass [ ] Fail [ ]**

---

### TC-TEAM-03: Delete a team
1. Log in as OWNER
2. Navigate to team settings
3. Attempt to delete the team (confirm any prompt)

**Expected:** Team deleted. Redirected to a state with no active team or another team if one exists.
**Pass [ ] Fail [ ]**

---

### TC-TEAM-04: ADMIN cannot delete team
1. Log in as ADMIN
2. Navigate to team settings

**Expected:** Delete team option is absent or disabled. No way to trigger deletion.
**Pass [ ] Fail [ ]**

---

### TC-TEAM-05: Switch between teams
1. Log in as a user who belongs to 2+ teams
2. Use the team selector (sidebar/header) to switch

**Expected:** All data (files, links, members) changes to reflect the selected team.
**Pass [ ] Fail [ ]**

---

## Section 3 — Invitations & Members

### TC-INV-01: OWNER/ADMIN can invite a user
1. Log in as ADMIN
2. Navigate to `/dashboard/teams`
3. Invite `viewer@test.com` with VIEWER role

**Expected:** Invitation appears in pending invitations. No error.
**Pass [ ] Fail [ ]**

---

### TC-INV-02: Invited user can accept invitation
1. Log in as `viewer@test.com`
2. Navigate to `/dashboard/invitations`
3. Accept the pending invitation

**Expected:** User now appears as a team member. Invitation removed from pending list.
**Pass [ ] Fail [ ]**

---

### TC-INV-03: Invited user can decline invitation
1. Log in as `viewer@test.com`
2. Navigate to `/dashboard/invitations`
3. Decline the pending invitation

**Expected:** Invitation removed. User not added to team.
**Pass [ ] Fail [ ]**

---

### TC-INV-04: VIEWER cannot invite
1. Log in as VIEWER
2. Navigate to `/dashboard/teams`

**Expected:** Invite button/form is absent or disabled. No access to invitation controls.
**Pass [ ] Fail [ ]**

---

### TC-INV-05: OWNER/ADMIN can change a member's role
1. Log in as OWNER
2. Open team members list
3. Change `viewer@test.com` from VIEWER → ADMIN

**Expected:** Role updated. The member's permissions change immediately on next page load.
**Pass [ ] Fail [ ]**

---

### TC-INV-06: Bucket-level access restriction
1. Log in as OWNER
2. Open team member settings for a VIEWER
3. Restrict the member to specific S3 buckets
4. Log in as that VIEWER

**Expected:** VIEWER only sees files from the assigned buckets. Other buckets hidden.
**Pass [ ] Fail [ ]**

---

## Section 4 — AWS Credentials

### TC-CRED-01: OWNER/ADMIN can add credentials
1. Log in as ADMIN
2. Navigate to `/dashboard/credentials`
3. Add new AWS credentials (access key, secret key, region, bucket name)
4. Save

**Expected:** Credential appears in the list. No error.
**Pass [ ] Fail [ ]**

---

### TC-CRED-02: VIEWER cannot see credential secrets
1. Log in as VIEWER
2. Navigate to `/dashboard/credentials`

**Expected:** Credentials list is either hidden or shows names only — secret keys are never shown in full.
**Pass [ ] Fail [ ]**

---

### TC-CRED-03: VIEWER cannot add/edit/delete credentials
1. Log in as VIEWER
2. Navigate to `/dashboard/credentials`

**Expected:** No create, edit, or delete controls visible.
**Pass [ ] Fail [ ]**

---

### TC-CRED-04: Edit existing credential
1. Log in as ADMIN
2. Open an existing credential
3. Change the name and save

**Expected:** Updated name shown in the list. Underlying keys unchanged.
**Pass [ ] Fail [ ]**

---

### TC-CRED-05: Delete a credential
1. Log in as OWNER
2. Delete a credential from the list

**Expected:** Credential removed. Any buckets linked to it are also removed.
**Pass [ ] Fail [ ]**

---

### TC-CRED-06: CloudFront configuration
1. Log in as OWNER/ADMIN
2. Add a credential with CloudFront CDN fields (domain, key pair ID, private key)

**Expected:** Saved successfully. Links created later with CloudFront option use this config.
**Pass [ ] Fail [ ]**

---

## Section 5 — File Management

### TC-FILE-01: Browse files
1. Log in as any role with FILES_LIST permission
2. Navigate to `/dashboard/files`

**Expected:** S3 bucket contents displayed in a directory tree. Folders are navigable.
**Pass [ ] Fail [ ]**

---

### TC-FILE-02: Upload a file
1. Log in as ADMIN
2. Navigate to a folder in `/dashboard/files`
3. Upload a file

**Expected:** File appears in the list. Storage quota updated.
**Pass [ ] Fail [ ]**

---

### TC-FILE-03: VIEWER can upload
1. Log in as VIEWER
2. Navigate to `/dashboard/files`
3. Upload a file

**Expected:** Upload succeeds (VIEWER has FILES_UPLOAD permission).
**Pass [ ] Fail [ ]**

---

### TC-FILE-04: VIEWER cannot delete files
1. Log in as VIEWER
2. Select a file in `/dashboard/files`

**Expected:** Delete button/option is absent or disabled.
**Pass [ ] Fail [ ]**

---

### TC-FILE-05: ADMIN/OWNER can delete files
1. Log in as ADMIN
2. Select a file
3. Delete it

**Expected:** File removed from list. Storage quota decremented.
**Pass [ ] Fail [ ]**

---

### TC-FILE-06: Download a single file
1. Log in as any member
2. Right-click or select a file
3. Choose download

**Expected:** File downloads successfully.
**Pass [ ] Fail [ ]**

---

### TC-FILE-07: Download multiple files
1. Log in as any member
2. Select 2+ files using checkboxes
3. Trigger bulk download

**Expected:** Files downloaded as a zip archive.
**Pass [ ] Fail [ ]**

---

### TC-FILE-08: File preview — image
1. Log in as any member
2. Click an image file (`.png`, `.jpg`)

**Expected:** Image preview shown in-app without downloading.
**Pass [ ] Fail [ ]**

---

### TC-FILE-09: File preview — PDF
1. Click a `.pdf` file

**Expected:** PDF rendered in-app.
**Pass [ ] Fail [ ]**

---

### TC-FILE-10: File preview — code/markdown
1. Click a `.md` or `.js` file

**Expected:** File rendered with syntax highlighting.
**Pass [ ] Fail [ ]**

---

### TC-FILE-11: Create a folder
1. Log in as ADMIN
2. In `/dashboard/files`, create a new folder

**Expected:** Folder appears in the listing. Navigation into it shows empty contents.
**Pass [ ] Fail [ ]**

---

### TC-FILE-12: Recent files
1. Upload or access a file
2. Navigate to the recent files section (dashboard or sidebar)

**Expected:** The file appears in the recents list with a timestamp.
**Pass [ ] Fail [ ]**

---

### TC-FILE-13: Favorite a file
1. Mark a file as favorite
2. Navigate to favorites view

**Expected:** File appears in favorites. Unfavoriting removes it.
**Pass [ ] Fail [ ]**

---

### TC-FILE-14: Tag a file
1. Open a file's context menu
2. Add tags/description
3. Save

**Expected:** Tags saved and visible when you revisit the file.
**Pass [ ] Fail [ ]**

---

### TC-FILE-15: Storage quota enforcement
1. Log in as OWNER
2. Check current storage usage on the dashboard
3. Upload a file larger than the remaining quota (if possible to simulate)

**Expected:** Upload rejected with a quota-exceeded error. Existing files unaffected.
**Pass [ ] Fail [ ]**

---

## Section 6 — Link Sharing

### TC-LINK-01: Create a PUBLIC link
1. Log in as ADMIN
2. Select a file
3. Create a share link with type PUBLIC, no password, no expiry

**Expected:** Share URL generated. Navigating to the URL (even while logged out) shows the file.
**Pass [ ] Fail [ ]**

---

### TC-LINK-02: Create a PRESIGNED link
1. Select a file
2. Create a link with type PRESIGNED, set expiry to 1 day

**Expected:** Presigned URL generated. Note: max 7 days should be enforced.
**Pass [ ] Fail [ ]**

---

### TC-LINK-03: Presigned link max 7 days enforcement
1. Try to create a PRESIGNED link with expiry > 7 days

**Expected:** Error or the date is capped at 7 days. Not allowed to exceed.
**Pass [ ] Fail [ ]**

---

### TC-LINK-04: Password-protected link
1. Create a link with a password set
2. Open the share URL while logged out
3. Try to access without the password, then with the correct password

**Expected:** Without password → access denied. With correct password → file accessible.
**Pass [ ] Fail [ ]**

---

### TC-LINK-05: Download limit
1. Create a link with max downloads = 2
2. Access the link and download the file twice
3. Try a third time

**Expected:** Third download blocked. UI shows limit reached.
**Pass [ ] Fail [ ]**

---

### TC-LINK-06: Expiry date enforcement
1. Create a link with an expiry date in the past (or set it to today and wait/simulate)
2. Access the share URL

**Expected:** Access denied with an "expired" message.
**Pass [ ] Fail [ ]**

---

### TC-LINK-07: Disable download on a link
1. Create a link with download disabled
2. Access the share URL

**Expected:** File is previewable but the download button is hidden or non-functional.
**Pass [ ] Fail [ ]**

---

### TC-LINK-08: VIEWER can create links
1. Log in as VIEWER
2. Select a file
3. Create a link

**Expected:** Link creation succeeds (VIEWER has LINKS_CREATE permission).
**Pass [ ] Fail [ ]**

---

### TC-LINK-09: VIEWER cannot delete links
1. Log in as VIEWER
2. Navigate to `/dashboard/links`

**Expected:** Delete button absent or disabled for all links.
**Pass [ ] Fail [ ]**

---

### TC-LINK-10: ADMIN can delete links
1. Log in as ADMIN
2. Delete a link from `/dashboard/links`

**Expected:** Link removed. Share URL now returns 404 or expired.
**Pass [ ] Fail [ ]**

---

### TC-LINK-11: CloudFront link
1. Ensure CloudFront credentials are configured (TC-CRED-06)
2. Create a link with type CLOUDFRONT

**Expected:** CloudFront signed URL generated. Accessing it serves the file via CDN.
**Pass [ ] Fail [ ]**

---

## Section 7 — Search

### TC-SRCH-01: Basic file name search
1. Navigate to `/dashboard/files`
2. Type a partial filename in the search box

**Expected:** Results filtered to matching files in real time or on submit.
**Pass [ ] Fail [ ]**

---

### TC-SRCH-02: AI semantic search
1. Navigate to `/dashboard/search`
2. Enter a natural language query (e.g. "invoices from March")
3. Submit

**Expected:** Results ranked by semantic relevance, not just filename match.
**Pass [ ] Fail [ ]**

---

### TC-SRCH-03: AI search rate limit
1. Send 120+ AI search requests in 60 seconds (if possible to simulate)

**Expected:** After 120 requests, API returns a rate-limit error. UI shows appropriate message.
**Pass [ ] Fail [ ]**

---

## Section 8 — Admin Features (OWNER only)

### TC-ADMIN-01: Audit log access — OWNER
1. Log in as OWNER
2. Navigate to `/dashboard/admin/audit`

**Expected:** Audit log table shown with recent actions, user, timestamp, and metadata.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-02: Audit log access — ADMIN (view only)
1. Log in as ADMIN
2. Navigate to `/dashboard/admin/audit`

**Expected:** ADMIN can VIEW audit logs (VIEW permission) but cannot clear/delete them.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-03: VIEWER cannot access audit log
1. Log in as VIEWER
2. Navigate directly to `/dashboard/admin/audit`

**Expected:** Access denied — redirected or shown a permission error. Not a blank page.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-04: Permissions management — OWNER
1. Log in as OWNER
2. Navigate to `/dashboard/admin/permissions`
3. Change a permission for the VIEWER role (e.g. enable FILES_DELETE)
4. Save

**Expected:** Permission saved. A VIEWER user now sees the delete button on files.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-05: Permissions management — ADMIN blocked
1. Log in as ADMIN
2. Navigate directly to `/dashboard/admin/permissions`

**Expected:** Page is blocked — server returns 403 or redirects. ADMIN cannot manage role definitions.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-06: File indexing status
1. Log in as OWNER
2. Navigate to `/dashboard/admin/indexing`

**Expected:** Table showing indexing status per file (indexed, pending, failed).
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-07: Pause/resume indexing
1. Log in as OWNER
2. In `/dashboard/admin/indexing`, pause indexing
3. Resume indexing

**Expected:** Status updates accordingly. No orphaned jobs.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-08: Retry failed indexing
1. Log in as OWNER
2. If any files show "FAILED" status, click "Retry Failed"

**Expected:** Failed jobs requeued. Status changes from FAILED → PENDING/INDEXED.
**Pass [ ] Fail [ ]**

---

### TC-ADMIN-09: AI credentials configuration
1. Log in as OWNER
2. Navigate to `/dashboard/settings`
3. Enter AI provider credentials
4. Test connection

**Expected:** "Test" returns success. Semantic search works after saving.
**Pass [ ] Fail [ ]**

---

## Section 9 — Profile & Account

### TC-PROF-01: Change password
1. Log in as any user
2. Navigate to `/dashboard/profile`
3. Change password to a new strong password
4. Log out and log back in with the new password

**Expected:** New password works. Old password rejected.
**Pass [ ] Fail [ ]**

---

### TC-PROF-02: Change to weak password
1. Navigate to `/dashboard/profile`
2. Try to set a password that fails strength requirements

**Expected:** Error shown. Password not changed.
**Pass [ ] Fail [ ]**

---

### TC-PROF-03: Delete account
1. Log in as a test user (not the main owner)
2. Navigate to `/dashboard/profile`
3. Delete the account (confirm any prompt)

**Expected:** Account deleted. Redirected to `/login`. Cannot log back in with those credentials.
**Pass [ ] Fail [ ]**

---

## Section 10 — RBAC Completeness (Cross-cutting)

These tests verify that every permission boundary holds from multiple angles — UI, direct URL, and API.

### TC-RBAC-01: Server-side guards — files delete
1. Log in as VIEWER
2. Using browser DevTools, send `DELETE /api/files` with a valid file path and session cookie

**Expected:** API returns 403. File is NOT deleted.
**Pass [ ] Fail [ ]**

---

### TC-RBAC-02: Server-side guards — credential creation
1. Log in as VIEWER
2. Using DevTools, send `POST /api/credentials` with valid credential data and session cookie

**Expected:** API returns 403. Credential is NOT created.
**Pass [ ] Fail [ ]**

---

### TC-RBAC-03: Server-side guards — admin routes
1. Log in as ADMIN
2. Using DevTools, send `GET /api/admin/audit` with session cookie

**Expected:** Returns data (ADMIN has VIEW on audit log). Verify this is correct.
**Pass [ ] Fail [ ]**

1. Log in as VIEWER
2. Send `GET /api/admin/audit` with VIEWER session cookie

**Expected:** API returns 403.
**Pass [ ] Fail [ ]**

---

### TC-RBAC-04: Permission change takes effect without re-login
1. Log in as VIEWER in Browser A
2. Log in as OWNER in Browser B
3. In Browser B, remove FILES_UPLOAD from VIEWER role
4. In Browser A, try to upload a file

**Expected:** Upload blocked after the permission change (on next request — no page reload required for server-side enforcement).
**Pass [ ] Fail [ ]**

---

### TC-RBAC-05: Bucket restriction enforcement at API level
1. Log in as OWNER, restrict a VIEWER member to only `bucket-A`
2. Log in as VIEWER
3. Using DevTools, send `GET /api/files` with `bucket=bucket-B` in the query

**Expected:** API returns empty results or 403 for `bucket-B`.
**Pass [ ] Fail [ ]**

---

## Section 11 — Flow Design Review

These tests evaluate whether the UX flow is logical and complete — not just whether features work.

### TC-FLOW-01: Onboarding flow — new user with no team
1. Register a brand new account
2. Log in immediately

**Expected:** User is guided to create or join a team, not dumped into a broken empty dashboard. A clear CTA (Create Team / Enter Invitation Code) should be visible.
**Note this flow:** _______________
**Pass [ ] Fail [ ]**

---

### TC-FLOW-02: Onboarding flow — invited user
1. Have an OWNER send an invite to a new email
2. The new user registers with that email
3. Log in and navigate to `/dashboard/invitations`

**Expected:** Invitation immediately visible after registration. No need to hunt for it.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-03: Empty state — no credentials added yet
1. Log in as OWNER to a team with no AWS credentials
2. Navigate to `/dashboard/files`

**Expected:** A clear empty state message explaining that credentials must be added first, with a link/button to `/dashboard/credentials`. Not a confusing error or spinner.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-04: Empty state — no files in bucket
1. Add valid credentials pointing to an empty S3 bucket
2. Navigate to `/dashboard/files`

**Expected:** A clear "No files yet" empty state with an upload CTA. Not a blank screen.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-05: Link sharing UX — finding the share option
1. As a user who has never used the app, navigate to `/dashboard/files`
2. Try to share a file — find the option without any prior instruction

**Expected:** Share option is discoverable from the file row (right-click, hover actions, or a visible icon). It should not be hidden behind 3+ clicks.
**Note friction found:** _______________
**Pass [ ] Fail [ ]**

---

### TC-FLOW-06: Share page UX — public visitor
1. Open a share URL in an incognito window (no login)
2. Evaluate the share page at `/share/[hash]`

**Expected:** Share page clearly shows: file name, download/preview options, and (if applicable) password prompt. It should look polished, not expose internal UI.
**Note issues:** _______________
**Pass [ ] Fail [ ]**

---

### TC-FLOW-07: Error recovery — wrong AWS credentials
1. Add AWS credentials with an intentionally wrong secret key
2. Navigate to `/dashboard/files` and attempt to browse

**Expected:** A user-friendly error message explaining the credentials are invalid, with a link to fix them. Not a raw AWS error or unhandled exception.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-08: Confirmation dialogs for destructive actions
1. Attempt to delete a file
2. Attempt to delete a team
3. Attempt to delete a credential
4. Attempt to delete an account

**Expected:** Each destructive action requires explicit confirmation (modal dialog asking user to confirm). No single-click deletes on critical data.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-09: Navigation consistency — breadcrumbs
1. Navigate deep into a folder: `/dashboard/files` → folder A → folder B → folder C
2. Click on folder A in the breadcrumb

**Expected:** Navigates to folder A correctly. Breadcrumbs always visible and accurate.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-10: Loading states
1. On a slow connection (use DevTools throttling to "Slow 3G")
2. Navigate to `/dashboard/files`, `/dashboard/links`, `/dashboard/teams`

**Expected:** Skeleton loaders or spinners shown while data loads. No layout shift on data arrival. No blank white screens.
**Pass [ ] Fail [ ]**

---

### TC-FLOW-11: Keyboard shortcut accessibility
1. Open the keyboard shortcuts modal (check sidebar for shortcut hint)
2. Use at least 3 shortcuts from the list

**Expected:** Shortcuts work as described. The modal is discoverable (tooltip or `?` key).
**Pass [ ] Fail [ ]**

---

### TC-FLOW-12: Mobile/responsive layout
1. Open the app on a mobile viewport (or use DevTools device emulation)
2. Navigate through files, links, and team pages

**Expected:** No horizontal overflow. Sidebar collapses to a hamburger or bottom nav. All buttons are tappable.
**Pass [ ] Fail [ ]**

---

## Section 12 — Dashboard Health & Metrics

### TC-DASH-01: Dashboard shows correct stats
1. Log in as any member
2. Open the main `/dashboard`

**Expected:** Storage usage, file count, and team stats shown. Numbers match actual data (cross-check with files list).
**Pass [ ] Fail [ ]**

---

### TC-DASH-02: Health cards update after actions
1. Note current file count on dashboard
2. Upload 3 files
3. Return to dashboard

**Expected:** File count and storage usage updated to reflect the uploads.
**Pass [ ] Fail [ ]**

---

## Section 13 — Security Edge Cases

### TC-SEC-01: Access another team's files via URL manipulation
1. Note your current team ID from the URL or network tab
2. Change the team ID in the request to a team you are not a member of

**Expected:** 403 or 404. Never returns another team's data.
**Pass [ ] Fail [ ]**

---

### TC-SEC-02: Access expired share link
1. Create a share link with a past expiry date
2. Access the `/share/[hash]` URL

**Expected:** Access denied with a clear "link expired" message.
**Pass [ ] Fail [ ]**

---

### TC-SEC-03: Brute-force password on protected share link
1. Create a password-protected share link
2. Access it and try 5+ wrong passwords in rapid succession

**Expected:** Either rate limiting kicks in, or the attempts are logged in audit trail. No unlimited brute force.
**Pass [ ] Fail [ ]**

---

### TC-SEC-04: Credential secret not exposed in API response
1. Call `GET /api/credentials` using DevTools network tab while logged in

**Expected:** Response does not include the full `secretAccessKey` or CloudFront private key in plaintext.
**Pass [ ] Fail [ ]**

---

### TC-SEC-05: XSS via file name
1. Upload a file named `<img src=x onerror=alert(1)>.txt`
2. Browse to the folder containing it

**Expected:** The filename is displayed as plain text, not executed as HTML.
**Pass [ ] Fail [ ]**

---

## Test Run Summary

| Section | Total | Pass | Fail | Notes |
|---------|-------|------|------|-------|
| 1. Auth | 7 | | | |
| 2. Team Management | 5 | | | |
| 3. Invitations | 6 | | | |
| 4. Credentials | 6 | | | |
| 5. Files | 15 | | | |
| 6. Links | 11 | | | |
| 7. Search | 3 | | | |
| 8. Admin | 9 | | | |
| 9. Profile | 3 | | | |
| 10. RBAC | 5 | | | |
| 11. Flow Design | 12 | | | |
| 12. Dashboard | 2 | | | |
| 13. Security | 5 | | | |
| **Total** | **89** | | | |

---

*Generated: 2026-05-20*
