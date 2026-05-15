# API Tests: Auth and Account

## `/api/auth/register` POST

### API-AUTH-001 Register success
- Priority: Critical
- Preconditions: Email not in use
- Data Pack: `PACK-AUTH`
- Input: valid name/email/strong password
- Expected:
1. `201` success.
2. User created with hashed password.
3. Default team and owner membership created.
- DB Assertions: `User`, `Team`, `TeamMember` rows created.
- AccessLog Assertions: N/A unless route logs.

### API-AUTH-002 Duplicate email rejected
- Priority: Critical
- Preconditions: Existing user email
- Expected: `400` with duplicate email message.
- DB Assertions: no new user row.

## `/api/account/password` POST

### API-ACC-001 Password change success
- Priority: Critical
- Preconditions: Authenticated user with valid current password
- Data Pack: `PACK-AUTH`
- Expected:
1. `200` success.
2. Password hash changed.
- AccessLog Assertions: success action for password change.

### API-ACC-002 Wrong current password
- Priority: Critical
- Preconditions: Authenticated user
- Expected: `400` or `401` invalid current password.
- DB Assertions: hash unchanged.
- AccessLog Assertions: failure action with error message.

## `/api/account/delete` POST

### API-ACC-010 Non-owner delete self
- Priority: Critical
- Preconditions: Auth as admin/viewer user
- Expected: account soft delete succeeds.
- DB Assertions: `deletedAt` set.

### API-ACC-011 Owner delete requires transfer
- Priority: Critical
- Preconditions: Auth as team owner
- Expected:
1. Without `transferToUserId` -> validation error.
2. With valid team member transfer target -> success.
- DB Assertions: ownership moved, deletedAt set for old owner.

## `/api/account/members` GET

### API-ACC-020 Team members list scoped
- Priority: Important
- Preconditions: Auth as team member
- Data Pack: `PACK-TEAM`
- Expected: returns current-team members only.

### API-ACC-021 Unauthenticated denied
- Priority: Critical
- Preconditions: No session
- Expected: `401`.

## `/api/users/lookup` GET

### API-LOOKUP-001 Admin/member-manager lookup allowed
- Priority: Important
- Preconditions: Actor with team management access
- Expected: lookup returns matching users.

### API-LOOKUP-002 Unauthorized actor denied
- Priority: Critical
- Preconditions: viewer or non-member
- Expected: `403` or `401` based on auth state.

## `/api/health` GET

### API-HEALTH-001 Health endpoint returns service status
- Priority: Important
- Preconditions: service running
- Expected: `200` with healthy payload.

### API-HEALTH-002 Health reports degraded state on dependency issues
- Priority: Important
- Preconditions: simulated DB/S3 connectivity issue
- Expected: status indicates degraded/unhealthy according to route contract.
