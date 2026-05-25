# Current Application Flows (S3 Portal)

Last updated: 2026-03-05

This document lists all current product flows in one place.

## 1. Public Flows

### 1.1 Landing (`/`)
1. Visitor opens landing page.
2. If unauthenticated, primary CTA routes to `/login`.
3. If authenticated, primary CTA routes to `/dashboard`.

### 1.2 Login (`/login`)
1. User submits email/password.
2. NextAuth credentials provider validates credentials.
3. On success, user is redirected to callback URL or `/dashboard`.
4. On failure, login error is shown and no session is created.

### 1.3 Register (`/register`)
1. User submits name, email, and password.
2. Backend validates password policy and email uniqueness.
3. On success, system creates user and initial team membership.
4. User is redirected to `/login`.

### 1.4 Public Share Access (`/share/[hash]`)
1. User opens share link by hash.
2. Backend validates link existence, expiry, password (if configured), and download limits.
3. On success, user receives preview/download access.
4. On failure, access is denied with error state.

## 2. Authenticated Dashboard Flows

### 2.1 Dashboard Home (`/dashboard`)
1. Authenticated user sees team-scoped summary metrics.
2. User navigates to files, credentials, links, teams, and admin areas.

### 2.2 Files (`/dashboard/files`)
1. User selects credential and bucket.
2. User lists, searches, and filters files.
3. User uploads (single or multipart) and verifies files.
4. User previews, downloads, shares, moves, tags, favorites, and deletes files.
5. Quota and access checks apply to write/destructive actions.

### 2.3 Credentials (`/dashboard/credentials`)
1. User lists credentials and bucket mappings.
2. Authorized user can delete credential entries.

### 2.4 Settings (`/dashboard/settings`)
1. User creates/updates S3 credentials.
2. User configures bucket mappings.
3. User configures CDN/CloudFront details per bucket (if used).

### 2.5 Links (`/dashboard/links`)
1. User lists existing links.
2. User copies links for sharing.
3. User revokes/deletes links.

### 2.6 Teams (`/dashboard/teams`)
1. Owner/admin views team members and roles.
2. Owner/admin invites users.
3. Owner/admin updates member roles.

### 2.7 Team Creation (`/dashboard/teams/new`)
1. User submits team name and slug.
2. Backend validates slug and uniqueness.
3. New team is created on success.

### 2.8 Invitations (`/dashboard/invitations`)
1. User views pending invites.
2. User accepts or declines invite.
3. Accept path creates membership with assigned role.

### 2.9 Profile (`/dashboard/profile`)
1. User submits current/new password.
2. Backend validates current password and policy for new password.
3. Password hash is updated on success.

### 2.10 Admin Audit (`/dashboard/admin/audit`)
1. Authorized actor views audit events.
2. Audit entries include actor, action, success/failure, and resource context.

### 2.11 Admin Permissions (`/dashboard/admin/permissions`)
1. Authorized actor views member-level screen permissions.
2. Actor grants/revokes/updates screen-level permission rows.
3. Effective access changes for protected capabilities.

### 2.12 Debug (`/dashboard/debug`)
1. Authenticated user views session and role/team diagnostics.

## 3. API Flows by Domain

### 3.1 Auth and Account
- `POST /api/auth/register`
- `POST /api/account/password`
- `POST /api/account/delete`
- `GET /api/account/members`
- `GET /api/users/lookup`
- `GET /api/health`

### 3.2 Files and Content
- `POST /api/files` with actions:
- `upload`
- `multipartInit`
- `multipartPresign`
- `multipartComplete`
- `list`
- `favorites`
- `recents`
- `toggleFavorite`
- `updateTags`
- `createFolder`
- `DELETE /api/files`
- `PATCH /api/files`
- `POST /api/files/verify`
- `GET /api/files/download`
- `GET /api/files/[fileId]/preview-url`
- `GET /api/files/[fileId]/preview-content`

### 3.3 Credentials and CDN
- `GET /api/credentials`
- `POST /api/credentials`
- `PUT /api/credentials`
- `DELETE /api/credentials`
- `PUT /api/credentials/cdn`

### 3.4 Links and Public Share
- `POST /api/links`
- `GET /api/links`
- `DELETE /api/links`
- `GET /api/share/[hash]`

### 3.5 Team, Roles, and Permissions
- `POST /api/team/members`
- `GET /api/team/members`
- `PATCH /api/team/members/role`
- `GET /api/team/invites`
- `POST /api/team/invites`
- `PATCH /api/team/invites/[id]`
- `GET /api/roles`
- `POST /api/roles`
- `GET /api/roles/[id]`
- `DELETE /api/roles/[id]`
- `POST /api/roles/permissions`
- `GET /api/permissions/screens`
- `POST /api/permissions/screens`
- `DELETE /api/permissions/screens`
- `PATCH /api/permissions/screens`

### 3.6 Admin Operations
- `GET /api/admin/audit`
- `GET /api/admin/quota`
- `POST /api/admin/quota`
- `POST /api/admin/reconcile`

## 4. Cross-Cutting System Flows

### 4.1 Authentication and Session
1. Protected pages/routes require valid session.
2. Invalid/missing session returns unauthorized behavior.

### 4.2 Authorization and RBAC
1. Access decisions use team membership, role hierarchy, and screen permissions.
2. Resource scope checks enforce team isolation and ownership rules.

### 4.3 Storage Quota
1. Upload-related flows validate team quota before/after writes.
2. Delete/verify/reconcile flows adjust usage totals.

### 4.4 Audit Logging
1. Sensitive actions write success/failure audit entries.
2. Audit metadata captures actor/resource context.

### 4.5 S3 and DB Consistency
1. File lifecycle operations update S3 and DB state.
2. Reconcile flow repairs drift between S3 objects and DB records.

## 5. Background and Ops Flows

### 5.1 Reconcile Flow
1. Admin-triggered or scheduled reconciliation compares S3 objects with DB records.
2. Missing/stale entries are corrected.
3. Quota usage is recalculated/adjusted where needed.

### 5.2 Invite Expiry Flow
1. Pending invites are checked against expiry windows.
2. Expired invites are marked accordingly.
