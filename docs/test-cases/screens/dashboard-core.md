# Screen Tests: Dashboard Core

## `/dashboard`

### SCR-CORE-001 Dashboard summary loads for team member
- Priority: Important
- Preconditions: Session for `U_OWNER_A` with `TEAM_A`
- Data Pack: `PACK-TEAM`, `PACK-FILES`, `PACK-LINKS`
- Steps:
1. Open `/dashboard`.
2. Validate stats cards and recent files.
- Expected:
1. Counts are team-scoped.
2. No cross-team data appears.
- Status: Not Run

## `/dashboard/files`

### SCR-CORE-010 File list and filter flow
- Priority: Critical
- Preconditions: `U_OWNER_A` in `TEAM_A`, credential and bucket available
- Data Pack: `PACK-CREDS`, `PACK-BUCKETS`, `PACK-FILES`
- Steps:
1. Select credential and bucket.
2. Search by name.
3. Filter by tag and favorite mode.
- Expected:
1. List updates correctly.
2. Only team-owned files shown.
- Status: Not Run

### SCR-CORE-011 Upload flow with quota boundary
- Priority: Critical
- Preconditions: Quota fixture near limit
- Data Pack: `PACK-QUOTA`, `PACK-FILES`
- Steps:
1. Upload file within available quota.
2. Upload file exceeding quota.
- Expected:
1. First upload succeeds.
2. Second is blocked with quota error.
- Status: Not Run

### SCR-CORE-012 Preview, share, and delete with permission variants
- Priority: Critical
- Preconditions: Run as `OWNER`, then `CUSTOM_VIEW`
- Data Pack: `PACK-FILES`, `PACK-LINKS`, `PACK-ROLES`
- Steps:
1. Preview file.
2. Create share link.
3. Attempt delete in each role.
- Expected:
1. Preview allowed for view-capable roles.
2. Share/delete follow screen permissions.
- Status: Not Run

## `/dashboard/credentials`

### SCR-CORE-020 Credentials list and delete
- Priority: Critical
- Preconditions: Team credentials exist
- Data Pack: `PACK-CREDS`
- Steps:
1. Open credentials page.
2. Delete one credential as owner.
3. Retry as viewer.
- Expected:
1. Owner path succeeds.
2. Viewer denied.
- Status: Not Run

## `/dashboard/settings`

### SCR-CORE-030 Create and update credential with bucket + CDN
- Priority: Critical
- Preconditions: Valid test AWS-compatible account fixture
- Data Pack: `PACK-CREDS`, `PACK-BUCKETS`
- Steps:
1. Create new credential.
2. Add bucket.
3. Configure CDN settings.
4. Update and save.
- Expected:
1. CRUD succeeds with validation.
2. Sensitive keys never rendered back in plaintext.
- Status: Not Run

### SCR-CORE-031 Invalid key and invalid bucket rejection
- Priority: Critical
- Preconditions: Invalid AWS keys fixture
- Data Pack: `PACK-CREDS`
- Steps:
1. Submit invalid key pair.
2. Submit inaccessible bucket.
- Expected:
1. Validation failure messages shown.
2. No credential persisted.
- Status: Not Run

## `/dashboard/links`

### SCR-CORE-040 Link listing and revocation
- Priority: Important
- Preconditions: Existing links for owner
- Data Pack: `PACK-LINKS`
- Steps:
1. Open links page.
2. Copy link.
3. Revoke/delete selected link.
- Expected:
1. Link states shown (expired/password/download count).
2. Deleted link no longer listed.
- Status: Not Run

## `/dashboard/profile`

### SCR-CORE-050 Password change success and mismatch failure
- Priority: Critical
- Preconditions: Valid current password
- Data Pack: `PACK-AUTH`
- Steps:
1. Change password with valid current and strong new password.
2. Repeat with mismatched confirmation.
- Expected:
1. First succeeds.
2. Second fails with validation error.
- Status: Not Run

## `/dashboard/debug`

### SCR-CORE-060 Debug page displays session diagnostics
- Priority: Nice-to-Have
- Preconditions: Authenticated user
- Data Pack: `PACK-AUTH`
- Steps:
1. Open debug page.
2. Verify key session fields and warning messages for missing role/team fields.
- Expected:
1. Session details shown.
2. Missing field warnings visible when fixture has gaps.
- Status: Not Run
